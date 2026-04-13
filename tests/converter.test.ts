import { describe, it, expect } from 'vitest';
import { convertCollection } from '../src/converter';
import type { PostmanCollection } from '../src/types';

function minimalCollection(overrides: Partial<PostmanCollection> = {}): PostmanCollection {
  return {
    info: {
      name: 'Test API',
      schema: 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json',
    },
    item: [],
    ...overrides,
  };
}

describe('convertCollection', () => {
  it('produces valid OpenAPI 3.0.3 for empty collection', () => {
    const result = convertCollection(minimalCollection());
    expect(result.openapi).toBe('3.0.3');
    expect(result.info.title).toBe('Test API');
    expect(result.paths).toEqual({});
  });

  it('converts a simple POST request', () => {
    const collection = minimalCollection({
      item: [
        {
          name: 'createUser',
          request: {
            method: 'POST',
            url: { raw: '{{API}}/v1/users' },
            header: [],
            body: {
              mode: 'raw',
              raw: '{"name":"John","age":30}',
              options: { raw: { language: 'json' } },
            },
          },
          response: [],
        },
      ],
    });

    const result = convertCollection(collection);
    expect(result.paths!['/v1/users']).toBeDefined();
    expect(result.paths!['/v1/users']!.post).toBeDefined();

    const op = result.paths!['/v1/users']!.post!;
    expect(op.operationId).toBe('createuser');
    expect(op.requestBody).toBeDefined();
    expect(op.requestBody!.content['application/json']).toBeDefined();
    expect(op.requestBody!.content['application/json'].schema).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    });
  });

  it('correlates request and response examples with the same key', () => {
    const collection = minimalCollection({
      item: [
        {
          name: 'getUser',
          request: {
            method: 'GET',
            url: { raw: '{{API}}/v1/users' },
            header: [],
          },
          response: [
            {
              name: 'Success Case',
              code: 200,
              header: [{ key: 'Content-Type', value: 'application/json' }],
              body: '{"id":1,"name":"John"}',
              originalRequest: {
                method: 'GET',
                url: { raw: '{{API}}/v1/users' },
                header: [],
                body: {
                  mode: 'raw',
                  raw: '{"filter":"active"}',
                  options: { raw: { language: 'json' } },
                },
              },
            },
            {
              name: 'Error Case',
              code: 200,
              header: [{ key: 'Content-Type', value: 'application/json' }],
              body: '{"error":"not found"}',
              originalRequest: {
                method: 'GET',
                url: { raw: '{{API}}/v1/users' },
                header: [],
                body: {
                  mode: 'raw',
                  raw: '{"filter":"invalid"}',
                  options: { raw: { language: 'json' } },
                },
              },
            },
          ],
        },
      ],
    });

    const result = convertCollection(collection);
    const op = result.paths!['/v1/users']!.get!;

    // Request body should have named examples
    const reqMedia = op.requestBody!.content['application/json'];
    expect(reqMedia.examples).toBeDefined();
    const reqKeys = Object.keys(reqMedia.examples!);
    expect(reqKeys).toHaveLength(2);

    // Response should have matching named examples
    const respMedia = op.responses!['200'].content!['application/json'];
    expect(respMedia.examples).toBeDefined();
    const respKeys = Object.keys(respMedia.examples!);

    // Keys should match for correlation
    expect(reqKeys).toEqual(respKeys);
  });

  it('extracts tags from folder structure', () => {
    const collection = minimalCollection({
      item: [
        {
          name: 'Users',
          item: [
            {
              name: 'listUsers',
              request: {
                method: 'GET',
                url: { raw: '{{API}}/v1/users' },
                header: [],
              },
              response: [],
            },
          ],
        },
        {
          name: 'Orders',
          item: [
            {
              name: 'listOrders',
              request: {
                method: 'GET',
                url: { raw: '{{API}}/v1/orders' },
                header: [],
              },
              response: [],
            },
          ],
        },
      ],
    });

    const result = convertCollection(collection);
    const tagNames = result.tags!.map((t) => t.name);
    expect(tagNames).toContain('Users');
    expect(tagNames).toContain('Orders');

    expect(result.paths!['/v1/users']!.get!.tags).toContain('Users');
    expect(result.paths!['/v1/orders']!.get!.tags).toContain('Orders');
  });

  it('deduplicates operationIds', () => {
    const collection = minimalCollection({
      item: [
        {
          name: 'getUser',
          request: {
            method: 'GET',
            url: { raw: '{{API}}/v1/users' },
            header: [],
          },
          response: [],
        },
        {
          name: 'getUser',
          request: {
            method: 'POST',
            url: { raw: '{{API}}/v1/users/search' },
            header: [],
          },
          response: [],
        },
      ],
    });

    const result = convertCollection(collection);
    const opIds = Object.values(result.paths!)
      .flatMap((pathItem) =>
        Object.values(pathItem as Record<string, { operationId?: string }>)
          .filter((o): o is { operationId: string } => typeof o === 'object' && !!o?.operationId)
          .map((o) => o.operationId),
      );

    // All operationIds should be unique
    expect(new Set(opIds).size).toBe(opIds.length);
  });

  it('detects server variables from {{VAR}} URLs', () => {
    const collection = minimalCollection({
      item: [
        {
          name: 'test',
          request: {
            method: 'GET',
            url: { raw: '{{MY_API}}/test' },
            header: [],
          },
          response: [],
        },
      ],
    });

    const result = convertCollection(collection);
    expect(result.servers).toHaveLength(1);
    expect(result.servers![0].url).toBe('/');
    expect(result.servers![0].description).toContain('MY_API');
  });

  it('infers response schema from response body', () => {
    const collection = minimalCollection({
      item: [
        {
          name: 'getStatus',
          request: {
            method: 'GET',
            url: { raw: '{{API}}/status' },
            header: [],
          },
          response: [
            {
              name: 'OK',
              code: 200,
              header: [{ key: 'Content-Type', value: 'application/json' }],
              body: '{"status":"healthy","uptime":12345}',
            },
          ],
        },
      ],
    });

    const result = convertCollection(collection);
    const respMedia = result.paths!['/status']!.get!.responses!['200'].content!['application/json'];
    expect(respMedia.schema).toEqual({
      type: 'object',
      properties: {
        status: { type: 'string' },
        uptime: { type: 'integer' },
      },
    });
  });

  it('handles formdata body mode', () => {
    const collection = minimalCollection({
      item: [
        {
          name: 'uploadFile',
          request: {
            method: 'POST',
            url: { raw: '{{API}}/upload' },
            header: [],
            body: {
              mode: 'formdata',
              formdata: [
                { key: 'file', type: 'file', src: '/path/to/file' },
                { key: 'description', type: 'text', value: 'A test file' },
              ],
            },
          },
          response: [],
        },
      ],
    });

    const result = convertCollection(collection);
    const reqContent = result.paths!['/upload']!.post!.requestBody!.content;
    expect(reqContent['multipart/form-data']).toBeDefined();
    expect(reqContent['multipart/form-data'].schema!.properties!.file).toEqual({
      type: 'string',
      format: 'binary',
    });
  });
});
