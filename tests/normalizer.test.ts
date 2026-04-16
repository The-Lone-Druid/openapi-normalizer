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

  it('should preserve headers listed in preserveHeaders option', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            responses: {
              '200': {
                description: 'OK',
                headers: {
                  'X-Request-Id': { schema: { type: 'string' } },
                  'X-Custom': { schema: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    });

    const result = normalize(doc, { preserveHeaders: ['X-Request-Id'] });
    const headers = result.paths!['/test']!.get!.responses!['200'].headers;
    expect(headers!['X-Request-Id']).toBeDefined();
    expect(headers!['X-Custom']).toBeDefined();
  });

  it('should strip additional noisy headers from additionalNoisyHeaders option', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            responses: {
              '200': {
                description: 'OK',
                headers: {
                  'X-Custom-Noisy': { schema: { type: 'string' } },
                  'X-Keep-This': { schema: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    });

    const result = normalize(doc, { additionalNoisyHeaders: ['X-Custom-Noisy'] });
    const headers = result.paths!['/test']!.get!.responses!['200'].headers;
    expect(headers!['X-Custom-Noisy']).toBeUndefined();
    expect(headers!['X-Keep-This']).toBeDefined();
  });

  it('should strip x-* extension keys when stripXExtensions is true', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
      'x-postman-id': 'abc123',
    } as Partial<OpenAPIDocument>);

    const result = normalize(doc, { stripXExtensions: true });
    expect((result as Record<string, unknown>)['x-postman-id']).toBeUndefined();
  });

  it('should keep examples when keepExamples is true', () => {
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
                    examples: {
                      ex1: { value: { a: 1 } },
                      ex2: { value: { a: 2 } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = normalize(doc, { keepExamples: true });
    const media = result.paths!['/test']!.get!.responses!['200'].content!['application/json'];
    expect(media.examples).toBeDefined();
    expect(media.example).toBeUndefined();
  });

  it('should skip schema inference when inferSchemas is false', () => {
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

    const result = normalize(doc, { inferSchemas: false });
    const media = result.paths!['/test']!.get!.responses!['200'].content!['application/json'];
    expect(media.schema).toBeUndefined();
  });

  it('should return undefined headers when all headers are noisy', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            responses: {
              '200': {
                description: 'OK',
                headers: {
                  'X-Request-Id': { schema: { type: 'string' } },
                  'Content-Length': { schema: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    });

    const result = normalize(doc);
    const resp = result.paths!['/test']!.get!.responses!['200'];
    expect(resp.headers).toBeUndefined();
  });

  it('should handle missing response description gracefully', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            responses: {
              '200': {} as { description: string },
            },
          },
        },
      },
    });

    const result = normalize(doc);
    expect(result.paths!['/test']!.get!.responses!['200'].description).toBe('');
  });

  it('should retain meaningful security entries', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            security: [{ bearerAuth: [] }],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    });

    const result = normalize(doc);
    expect(result.paths!['/test']!.get!.security).toEqual([{ bearerAuth: [] }]);
  });

  it('should handle response with no content', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            responses: {
              '204': { description: 'No Content' },
            },
          },
        },
      },
    });

    const result = normalize(doc);
    const resp = result.paths!['/test']!.get!.responses!['204'];
    expect(resp.description).toBe('No Content');
    expect(resp.content).toBeUndefined();
  });

  it('should handle empty contact object in info', () => {
    const doc = minimalDoc({
      info: { title: 'Test', version: '1.0.0', contact: {} },
    });

    const result = normalize(doc);
    expect(result.info.contact).toBeUndefined();
  });

  it('should keep non-empty components', () => {
    const doc = minimalDoc({
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
    });

    const result = normalize(doc);
    expect(result.components).toBeDefined();
    expect(result.components!.securitySchemes!['bearerAuth']).toBeDefined();
  });

  it('should strip x-* keys from nested objects and arrays', () => {
    const doc = minimalDoc({
      paths: {
        '/test': {
          get: {
            operationId: 'getTest',
            'x-internal': true,
            responses: { '200': { description: 'OK' } },
          },
        },
      },
      tags: [{ name: 'test', 'x-tag-meta': true } as OpenAPITag & Record<string, unknown>],
    } as Partial<OpenAPIDocument>);

    const result = normalize(doc, { stripXExtensions: true });
    const op = result.paths!['/test']!.get!;
    expect((op as Record<string, unknown>)['x-internal']).toBeUndefined();
  });

  it('should handle examples with null values gracefully', () => {
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
                      ex1: { value: null },
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
    // null is filtered out from parsedValues, so no schema inferred
    expect(media.schema).toBeUndefined();
  });

  it('should not have schemas when no examples have valid values', () => {
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
                      ex1: { value: undefined },
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
    expect(media.schema).toBeUndefined();
  });
});
