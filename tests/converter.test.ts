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
    const opIds = Object.values(result.paths!).flatMap((pathItem) =>
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
    expect(result.servers![0].url).toBe('{MY_API}');
    expect(result.servers![0].description).toContain('MY_API');
    expect(result.servers![0].variables!['MY_API']).toBeDefined();
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

  describe('options', () => {
    it('should use snake_case operationId style when specified', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Get All Users',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/v1/users' },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection, { operationIdStyle: 'snake_case' });
      const op = result.paths!['/v1/users']!.get!;
      expect(op.operationId).toMatch(/_/);
      expect(op.operationId).not.toMatch(/[A-Z]/);
    });

    it('should use kebab-case operationId style when specified', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Get All Users',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/v1/users' },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection, { operationIdStyle: 'kebab-case' });
      const op = result.paths!['/v1/users']!.get!;
      expect(op.operationId).toMatch(/-/);
      expect(op.operationId).not.toMatch(/[A-Z]/);
    });

    it('should not generate tags when tagFromFolder is false', () => {
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
        ],
      });

      const result = convertCollection(collection, { tagFromFolder: false });
      expect(result.tags).toBeUndefined();
      expect(result.paths!['/v1/users']!.get!.tags).toBeUndefined();
    });

    it('should detect string formats when inferFormats is true', () => {
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
                name: 'Success',
                code: 200,
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: '{"id":"550e8400-e29b-41d4-a716-446655440000","email":"user@test.com"}',
              },
            ],
          },
        ],
      });

      const result = convertCollection(collection, { inferFormats: true });
      const schema =
        result.paths!['/v1/users']!.get!.responses!['200'].content!['application/json'].schema!;
      expect(schema.properties!.id.format).toBe('uuid');
      expect(schema.properties!.email.format).toBe('email');
    });

    it('should infer required fields when inferRequired is true and multiple examples exist', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'getUsers',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/v1/users' },
              header: [],
            },
            response: [
              {
                name: 'User 1',
                code: 200,
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: '{"id":1,"name":"Alice","email":"alice@test.com"}',
              },
              {
                name: 'User 2',
                code: 200,
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: '{"id":2,"name":"Bob"}',
              },
            ],
          },
        ],
      });

      const result = convertCollection(collection, { inferRequired: true });
      const schema =
        result.paths!['/v1/users']!.get!.responses!['200'].content!['application/json'].schema!;
      expect(schema.required).toContain('id');
      expect(schema.required).toContain('name');
      expect(schema.required).not.toContain('email');
    });

    it('should use defaultContentType when no body is present but responses have request examples', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'createUser',
            request: {
              method: 'POST',
              url: { raw: '{{API}}/v1/users' },
              header: [],
            },
            response: [
              {
                name: 'Success',
                code: 201,
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: '{"id":1}',
                originalRequest: {
                  method: 'POST',
                  url: { raw: '{{API}}/v1/users' },
                  header: [],
                  body: {
                    mode: 'raw',
                    raw: '{"name":"John"}',
                    options: { raw: { language: 'json' } },
                  },
                },
              },
            ],
          },
        ],
      });

      // defaultContentType applies only when no media type is inferred
      const result = convertCollection(collection);
      const reqContent = result.paths!['/v1/users']!.post!.requestBody!.content;
      expect(reqContent['application/json']).toBeDefined();
    });
  });

  describe('auth mapping', () => {
    it('should map bearer auth to securitySchemes', () => {
      const collection = minimalCollection({
        auth: { type: 'bearer', bearer: [{ key: 'token', value: 'abc' }] },
        item: [
          {
            name: 'test',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/test' },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.components?.securitySchemes).toBeDefined();
      expect(result.components!.securitySchemes!['bearerAuth']).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });
      expect(result.security).toEqual([{ bearerAuth: [] }]);
    });

    it('should map basic auth to securitySchemes', () => {
      const collection = minimalCollection({
        auth: { type: 'basic' },
        item: [
          {
            name: 'test',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/test' },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.components!.securitySchemes!['basicAuth']).toEqual({
        type: 'http',
        scheme: 'basic',
      });
    });

    it('should map apikey auth to securitySchemes', () => {
      const collection = minimalCollection({
        auth: {
          type: 'apikey',
          apikey: [
            { key: 'key', value: 'Authorization' },
            { key: 'in', value: 'header' },
          ],
        },
        item: [
          {
            name: 'test',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/test' },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.components!.securitySchemes!['apiKeyAuth']).toEqual({
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
      });
    });

    it('should cascade auth from folder to items', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Protected',
            auth: { type: 'bearer', bearer: [{ key: 'token', value: 'x' }] },
            item: [
              {
                name: 'protectedEndpoint',
                request: {
                  method: 'GET',
                  url: { raw: '{{API}}/protected' },
                  header: [],
                },
                response: [],
              },
            ],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.components?.securitySchemes?.['bearerAuth']).toBeDefined();
      expect(result.paths!['/protected']!.get!.security).toEqual([{ bearerAuth: [] }]);
    });
  });

  describe('parameter extraction', () => {
    it('should extract query parameters from Postman URL', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'searchUsers',
            request: {
              method: 'GET',
              url: {
                raw: '{{API}}/v1/users?status=active&limit=10',
                path: ['v1', 'users'],
                query: [
                  { key: 'status', value: 'active' },
                  { key: 'limit', value: '10' },
                ],
              },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      // The path may include query string; find the matching path key
      const pathKey = Object.keys(result.paths!).find((p) => p.includes('users'))!;
      const params = result.paths![pathKey]!.get!.parameters!;
      const queryParams = params.filter((p) => p.in === 'query');
      expect(queryParams).toHaveLength(2);
      expect(queryParams.find((p) => p.name === 'status')).toBeDefined();
      expect(queryParams.find((p) => p.name === 'limit')).toBeDefined();
    });

    it('should extract path parameters from :param syntax', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'getUser',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/v1/users/:userId/posts/:postId' },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      const normalizedPath = Object.keys(result.paths!).find((p) => p.includes('{userId}'));
      expect(normalizedPath).toBeDefined();
      const params = result.paths![normalizedPath!]!.get!.parameters!;
      const pathParams = params.filter((p) => p.in === 'path');
      expect(pathParams).toHaveLength(2);
      expect(pathParams.find((p) => p.name === 'userId')!.required).toBe(true);
      expect(pathParams.find((p) => p.name === 'postId')!.required).toBe(true);
    });

    it('should skip disabled query parameters', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'test',
            request: {
              method: 'GET',
              url: {
                raw: '{{API}}/test?active=true&debug=1',
                query: [
                  { key: 'active', value: 'true' },
                  { key: 'debug', value: '1', disabled: true },
                ],
              },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      const pathKey = Object.keys(result.paths!).find((p) => p.includes('test'))!;
      const params = result.paths![pathKey]!.get!.parameters!;
      const queryParams = params.filter((p) => p.in === 'query');
      expect(queryParams).toHaveLength(1);
      expect(queryParams[0].name).toBe('active');
    });
  });

  describe('server variables', () => {
    it('should build server variables with defaults from collection variables', () => {
      const collection = minimalCollection({
        variable: [{ key: 'API', value: 'https://api.example.com' }],
        item: [
          {
            name: 'test',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/test' },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.servers).toHaveLength(1);
      expect(result.servers![0].url).toBe('{API}');
      expect(result.servers![0].variables).toBeDefined();
      expect(result.servers![0].variables!['API'].default).toBe('https://api.example.com');
    });
  });

  describe('auto-parameterization of hardcoded IDs', () => {
    it('should replace MongoDB ObjectIDs in paths with parameters', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'getUser',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/user/5ddccbec6b55da001759722c/avatar' },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.paths!['/user/{userId}/avatar']).toBeDefined();
      const params = result.paths!['/user/{userId}/avatar']!.get!.parameters!;
      const pathParam = params.find((p) => p.name === 'userId');
      expect(pathParam).toBeDefined();
      expect(pathParam!.in).toBe('path');
      expect(pathParam!.required).toBe(true);
    });

    it('should replace UUIDs in paths with parameters', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'getOrder',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/orders/550e8400-e29b-41d4-a716-446655440000' },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.paths!['/orders/{orderId}']).toBeDefined();
    });

    it('should replace numeric IDs in paths with parameters', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'getPost',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/posts/12345' },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.paths!['/posts/{postId}']).toBeDefined();
    });
  });

  describe('query parameter merging', () => {
    it('should merge query params from duplicate method+path items', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Get All Tasks',
            request: {
              method: 'GET',
              url: { raw: '{{API}}/task' },
              header: [],
            },
            response: [],
          },
          {
            name: 'Get Tasks by Status',
            request: {
              method: 'GET',
              url: {
                raw: '{{API}}/task?completed=true',
                query: [{ key: 'completed', value: 'true' }],
              },
              header: [],
            },
            response: [],
          },
          {
            name: 'Get Tasks Paginated',
            request: {
              method: 'GET',
              url: {
                raw: '{{API}}/task?limit=10&skip=0',
                query: [
                  { key: 'limit', value: '10' },
                  { key: 'skip', value: '0' },
                ],
              },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      // All three should merge into a single GET /task
      expect(Object.keys(result.paths!)).toEqual(['/task']);
      const params = result.paths!['/task']!.get!.parameters!;
      const queryParams = params.filter((p) => p.in === 'query');
      expect(queryParams).toHaveLength(3);
      expect(queryParams.map((p) => p.name).sort()).toEqual(['completed', 'limit', 'skip']);
    });
  });

  describe('auth mapping', () => {
    it('should map apikey auth to securitySchemes', () => {
      const collection = minimalCollection({
        auth: {
          type: 'apikey',
          apikey: [
            { key: 'key', value: 'X-Api-Token' },
            { key: 'in', value: 'header' },
          ],
        },
        item: [
          {
            name: 'Test',
            request: { method: 'GET', url: '/test', header: [] },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.components?.securitySchemes?.['apiKeyAuth']).toEqual({
        type: 'apiKey',
        in: 'header',
        name: 'X-Api-Token',
      });
    });

    it('should map oauth2 auth to securitySchemes', () => {
      const collection = minimalCollection({
        auth: {
          type: 'oauth2',
        },
        item: [
          {
            name: 'Test',
            request: { method: 'GET', url: '/test', header: [] },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.components?.securitySchemes?.['oauth2Auth']).toBeDefined();
      const scheme = result.components!.securitySchemes!['oauth2Auth'] as Record<string, unknown>;
      expect(scheme.type).toBe('oauth2');
    });

    it('should not add securitySchemes for unknown auth type', () => {
      const collection = minimalCollection({
        auth: {
          type: 'digest' as 'basic',
        },
        item: [
          {
            name: 'Test',
            request: { method: 'GET', url: '/test', header: [] },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.components).toBeUndefined();
    });

    it('should map apikey auth with defaults when entries are missing', () => {
      const collection = minimalCollection({
        auth: {
          type: 'apikey',
          apikey: [],
        },
        item: [
          {
            name: 'Test',
            request: { method: 'GET', url: '/test', header: [] },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      const scheme = result.components?.securitySchemes?.['apiKeyAuth'] as Record<string, unknown>;
      expect(scheme.name).toBe('X-API-Key');
      expect(scheme.in).toBe('header');
    });
  });

  describe('operationId styles', () => {
    it('should generate snake_case operationIds', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Get User Profile',
            request: { method: 'GET', url: '/user/profile', header: [] },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection, { operationIdStyle: 'snake_case' });
      expect(result.paths!['/user/profile']!.get!.operationId).toBe('get_user_profile');
    });

    it('should generate kebab-case operationIds', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Get User Profile',
            request: { method: 'GET', url: '/user/profile', header: [] },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection, { operationIdStyle: 'kebab-case' });
      expect(result.paths!['/user/profile']!.get!.operationId).toBe('get-user-profile');
    });

    it('should fallback to method for empty operationId parts', () => {
      const collection = minimalCollection({
        item: [
          {
            name: '',
            request: { method: 'GET', url: '/', header: [] },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection, { operationIdStyle: 'snake_case' });
      const op = Object.values(result.paths!)[0]!.get!;
      expect(op.operationId).toBeDefined();
    });
  });

  describe('convert options', () => {
    it('should disable tagFromFolder when option is false', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Users',
            item: [
              {
                name: 'Get Users',
                request: { method: 'GET', url: '/users', header: [] },
                response: [],
              },
            ],
          },
        ],
      });

      const result = convertCollection(collection, { tagFromFolder: false });
      const op = result.paths!['/users']!.get!;
      expect(op.tags).toBeUndefined();
      expect(result.tags).toBeUndefined();
    });

    it('should use defaultContentType option', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Send XML',
            request: {
              method: 'POST',
              url: '/data',
              header: [],
              body: { mode: 'raw', raw: '<data/>' },
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection, { defaultContentType: 'application/xml' });
      const reqBody = result.paths!['/data']!.post!.requestBody!;
      expect(reqBody.content['application/xml']).toBeUndefined();
    });

    it('should infer required fields when inferRequired is true and multiple examples exist', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Create User',
            request: {
              method: 'POST',
              url: '/users',
              header: [],
              body: {
                mode: 'raw',
                raw: '{"name":"a","email":"b"}',
                options: { raw: { language: 'json' } },
              },
            },
            response: [
              {
                name: 'success',
                code: 200,
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: '{"id":1,"name":"a","email":"b"}',
                originalRequest: {
                  method: 'POST',
                  url: '/users',
                  header: [],
                  body: {
                    mode: 'raw',
                    raw: '{"name":"a","email":"b"}',
                    options: { raw: { language: 'json' } },
                  },
                },
              },
              {
                name: 'success2',
                code: 200,
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: '{"id":2,"name":"c","email":"d"}',
                originalRequest: {
                  method: 'POST',
                  url: '/users',
                  header: [],
                  body: {
                    mode: 'raw',
                    raw: '{"name":"c","email":"d"}',
                    options: { raw: { language: 'json' } },
                  },
                },
              },
            ],
          },
        ],
      });

      const result = convertCollection(collection, { inferRequired: true });
      const respSchema =
        result.paths!['/users']!.post!.responses!['200'].content!['application/json'].schema!;
      expect(respSchema.required).toBeDefined();
      expect(respSchema.required).toContain('id');
    });

    it('should handle items with no request gracefully', () => {
      const collection = minimalCollection({
        item: [{ name: 'Empty Item' } as { name: string; request: undefined; response: never[] }],
      });

      const result = convertCollection(collection);
      expect(Object.keys(result.paths!)).toHaveLength(0);
    });

    it('should deduplicate operationIds with suffix', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'getUsers',
            request: { method: 'GET', url: '/users', header: [] },
            response: [],
          },
          {
            name: 'getUsers',
            request: { method: 'GET', url: '/admin/users', header: [] },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      const opIds = Object.values(result.paths!)
        .flatMap((p) => Object.values(p!))
        .map((op) => (op as { operationId: string }).operationId);
      // All unique
      expect(new Set(opIds).size).toBe(opIds.length);
    });

    it('should handle query params with Postman variables', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Search',
            request: {
              method: 'GET',
              url: {
                raw: '{{API}}/search',
                query: [
                  { key: 'q', value: '{{searchTerm}}' },
                  { key: 'limit', value: '10' },
                ],
              },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      const params = result.paths!['/search']!.get!.parameters!;
      const qParam = params.find((p) => p.name === 'q');
      expect(qParam).toBeDefined();
      expect(qParam!.example).toBeUndefined(); // Postman variable should not be example
      const limitParam = params.find((p) => p.name === 'limit');
      expect(limitParam!.example).toBe('10');
    });

    it('should handle disabled query params', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Search',
            request: {
              method: 'GET',
              url: {
                raw: '{{API}}/search',
                query: [
                  { key: 'q', value: 'test' },
                  { key: 'debug', value: 'true', disabled: true },
                ],
              },
              header: [],
            },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      const params = result.paths!['/search']!.get!.parameters!;
      const queryParams = params.filter((p) => p.in === 'query');
      expect(queryParams).toHaveLength(1);
      expect(queryParams[0].name).toBe('q');
    });

    it('should handle response with no saved responses', () => {
      const collection = minimalCollection({
        item: [
          {
            name: 'Ping',
            request: { method: 'GET', url: '/ping', header: [] },
            response: [],
          },
        ],
      });

      const result = convertCollection(collection);
      expect(result.paths!['/ping']!.get!.responses!['200']).toEqual({ description: '' });
    });
  });
});
