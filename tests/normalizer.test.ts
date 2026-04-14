import { describe, it, expect } from 'vitest';
import { normalize } from '../src/normalizer';
import type { OpenAPIDocument } from '../src/types';

function minimalDoc(overrides: Partial<OpenAPIDocument> = {}): OpenAPIDocument {
  return {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
    ...overrides,
  };
}

describe('normalize', () => {
  it('returns a valid OpenAPI doc with no paths', () => {
    const doc = minimalDoc();
    const result = normalize(doc);
    expect(result.openapi).toBe('3.0.3');
    expect(result.paths).toEqual({});
  });

  it('strips noisy response headers', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          post: {
            operationId: 'test',
            responses: {
              '200': {
                description: 'OK',
                headers: {
                  'X-Request-Id': { schema: { type: 'string' } },
                  'Content-Length': { schema: { type: 'string' } },
                  'X-Custom-Header': { schema: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    });

    const result = normalize(doc);
    const headers = result.paths!['/test']!.post!.responses!['200'].headers;
    expect(headers).toBeDefined();
    expect(headers!['X-Custom-Header']).toBeDefined();
    expect(headers!['X-Request-Id']).toBeUndefined();
    expect(headers!['Content-Length']).toBeUndefined();
  });

  it('collapses named examples to a single example', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          post: {
            operationId: 'test',
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    examples: {
                      ex1: { value: { status: 'ok' } },
                      ex2: { value: { status: 'fail' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = normalize(doc);
    const media = result.paths!['/test']!.post!.responses!['200'].content!['application/json'];
    expect(media.example).toEqual({ status: 'ok' });
    expect(media.examples).toBeUndefined();
  });

  it('infers schema from examples when schema is missing', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {},
                    examples: {
                      ex1: { value: { id: 1, name: 'foo' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = normalize(doc);
    const media = result.paths!['/test']!.get!.responses!['200'].content!['application/json'];
    expect(media.schema).toEqual({
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
    });
  });

  it('strips per-property example values from schemas', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', example: 'John' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = normalize(doc);
    const schema =
      result.paths!['/test']!.get!.responses!['200'].content!['application/json'].schema!;
    expect(schema.properties!.name.example).toBeUndefined();
  });

  it('removes description that duplicates summary', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            summary: 'Get test',
            description: 'Get test',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    });

    const result = normalize(doc);
    expect(result.paths!['/test']!.get!.description).toBeUndefined();
    expect(result.paths!['/test']!.get!.summary).toBe('Get test');
  });

  it('removes empty security arrays', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            security: [{}],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    });

    const result = normalize(doc);
    expect(result.paths!['/test']!.get!.security).toBeUndefined();
  });

  it('deduplicates tags', () => {
    const doc = minimalDoc({
      tags: [
        { name: 'users' },
        { name: 'users', description: 'User operations' },
        { name: 'orders' },
      ],
    });

    const result = normalize(doc);
    expect(result.tags).toHaveLength(2);
    expect(result.tags!.find((t) => t.name === 'users')!.description).toBe('User operations');
  });

  it('annotates Postman {{VAR}} server URLs', () => {
    const doc = minimalDoc({
      servers: [{ url: '{{API_GATEWAY}}' }],
    });

    const result = normalize(doc);
    expect(result.servers![0].url).toBe('/');
    expect(result.servers![0].description).toContain('API_GATEWAY');
  });

  it('removes empty components.securitySchemes', () => {
    const doc = minimalDoc({
      components: { securitySchemes: {} },
    });

    const result = normalize(doc);
    expect(result.components).toBeUndefined();
  });

  it('normalizes request body examples too', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          post: {
            operationId: 'postTest',
            requestBody: {
              content: {
                'application/json': {
                  examples: {
                    ex1: { value: '{"key": "value"}' },
                  },
                },
              },
            },
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    });

    const result = normalize(doc);
    const media = result.paths!['/test']!.post!.requestBody!.content['application/json'];
    expect(media.example).toEqual({ key: 'value' });
    expect(media.examples).toBeUndefined();
  });
});
