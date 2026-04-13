import { describe, it, expect } from 'vitest';
import {
  isNoisyHeader,
  tryParseJSON,
  parseExampleValue,
  parsePostmanUrl,
  parseBody,
  headersToParameters,
  getContentType,
  toOperationId,
  toExampleKey,
  flattenItems,
} from '../src/utils';

describe('isNoisyHeader', () => {
  it('returns true for noisy headers (case-insensitive)', () => {
    expect(isNoisyHeader('X-Request-Id')).toBe(true);
    expect(isNoisyHeader('content-length')).toBe(true);
    expect(isNoisyHeader('SET-COOKIE')).toBe(true);
  });

  it('returns false for API-relevant headers', () => {
    expect(isNoisyHeader('X-Custom-Header')).toBe(false);
    expect(isNoisyHeader('Accept')).toBe(false);
  });
});

describe('tryParseJSON', () => {
  it('parses valid JSON', () => {
    expect(tryParseJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns undefined for invalid JSON', () => {
    expect(tryParseJSON('not json')).toBeUndefined();
  });

  it('returns undefined for null/undefined/empty', () => {
    expect(tryParseJSON(null)).toBeUndefined();
    expect(tryParseJSON(undefined)).toBeUndefined();
    expect(tryParseJSON('')).toBeUndefined();
    expect(tryParseJSON('   ')).toBeUndefined();
  });
});

describe('parseExampleValue', () => {
  it('parses JSON strings', () => {
    expect(parseExampleValue('{"x":1}')).toEqual({ x: 1 });
  });

  it('returns original string for non-JSON', () => {
    expect(parseExampleValue('hello')).toBe('hello');
  });

  it('passes through non-string values', () => {
    const obj = { a: 1 };
    expect(parseExampleValue(obj)).toBe(obj);
    expect(parseExampleValue(42)).toBe(42);
  });
});

describe('parsePostmanUrl', () => {
  it('extracts server variable and path', () => {
    expect(parsePostmanUrl('{{API}}/v1/users')).toEqual({
      serverVar: 'API',
      path: '/v1/users',
    });
  });

  it('handles server variable with no path', () => {
    expect(parsePostmanUrl('{{API}}')).toEqual({
      serverVar: 'API',
      path: '/',
    });
  });

  it('handles object URL format', () => {
    expect(parsePostmanUrl({ raw: '{{GW}}/test' })).toEqual({
      serverVar: 'GW',
      path: '/test',
    });
  });

  it('handles absolute URLs', () => {
    const result = parsePostmanUrl('https://api.example.com/v1/users');
    expect(result.serverVar).toBeNull();
    expect(result.path).toBe('/v1/users');
  });

  it('handles bare paths', () => {
    expect(parsePostmanUrl('v1/users')).toEqual({
      serverVar: null,
      path: '/v1/users',
    });
  });

  it('handles paths starting with /', () => {
    expect(parsePostmanUrl('/v1/users')).toEqual({
      serverVar: null,
      path: '/v1/users',
    });
  });

  it('returns default for undefined', () => {
    expect(parsePostmanUrl(undefined)).toEqual({
      serverVar: null,
      path: '/',
    });
  });

  it('handles object with empty raw', () => {
    expect(parsePostmanUrl({ raw: '' })).toEqual({
      serverVar: null,
      path: '/',
    });
  });
});

describe('parseBody', () => {
  it('returns null for undefined/none', () => {
    expect(parseBody(undefined)).toBeNull();
    expect(parseBody(null)).toBeNull();
    expect(parseBody({ mode: 'none' })).toBeNull();
  });

  it('parses raw JSON body', () => {
    const result = parseBody({
      mode: 'raw',
      raw: '{"name":"test"}',
      options: { raw: { language: 'json' } },
    });
    expect(result).toEqual({
      mediaType: 'application/json',
      schema: { type: 'object', properties: { name: { type: 'string' } } },
      exampleValue: { name: 'test' },
    });
  });

  it('handles raw non-JSON body', () => {
    const result = parseBody({ mode: 'raw', raw: 'plain text' });
    expect(result).toEqual({
      mediaType: 'application/json',
      schema: { type: 'string' },
      exampleValue: undefined,
    });
  });

  it('parses urlencoded body', () => {
    const result = parseBody({
      mode: 'urlencoded',
      urlencoded: [
        { key: 'username', value: 'test' },
        { key: 'disabled_field', value: 'x', disabled: true },
      ],
    });
    expect(result!.mediaType).toBe('application/x-www-form-urlencoded');
    expect(result!.schema.properties!['username']).toEqual({ type: 'string' });
    expect(result!.schema.properties!['disabled_field']).toBeUndefined();
  });

  it('parses formdata with disabled fields', () => {
    const result = parseBody({
      mode: 'formdata',
      formdata: [
        { key: 'file', type: 'file' },
        { key: 'skip', type: 'text', disabled: true },
      ],
    });
    expect(result!.mediaType).toBe('multipart/form-data');
    expect(result!.schema.properties!['file']).toEqual({ type: 'string', format: 'binary' });
    expect(result!.schema.properties!['skip']).toBeUndefined();
  });

  it('returns null for unknown body mode', () => {
    expect(parseBody({ mode: 'graphql' as never })).toBeNull();
  });
});

describe('headersToParameters', () => {
  it('returns empty for undefined', () => {
    expect(headersToParameters(undefined)).toEqual([]);
  });

  it('filters noisy and disabled headers', () => {
    const params = headersToParameters([
      { key: 'X-Custom', value: 'val' },
      { key: 'Content-Length', value: '100' },
      { key: 'Disabled-H', value: 'x', disabled: true },
    ]);
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe('X-Custom');
    expect(params[0].example).toBe('val');
  });

  it('omits example for template values', () => {
    const params = headersToParameters([
      { key: 'apiKey', value: '{{API_KEY}}' },
    ]);
    expect(params[0].example).toBeUndefined();
  });
});

describe('getContentType', () => {
  it('defaults to application/json', () => {
    expect(getContentType(undefined)).toBe('application/json');
    expect(getContentType([])).toBe('application/json');
  });

  it('extracts content type without charset', () => {
    expect(
      getContentType([{ key: 'Content-Type', value: 'text/html; charset=utf-8' }]),
    ).toBe('text/html');
  });
});

describe('toOperationId', () => {
  it('derives from name with slashes', () => {
    expect(toOperationId('master/getState', 'POST', '/v1/master')).toBe('masterGetstate');
  });

  it('derives from name with dashes', () => {
    expect(toOperationId('set-mpin', 'POST', '/v1/mpin')).toBe('setMpin');
  });

  it('falls back to method when name is empty', () => {
    expect(toOperationId('', 'GET', '')).toBe('get');
  });
});

describe('toExampleKey', () => {
  it('sanitizes name', () => {
    expect(toExampleKey('Success! (200)', 0)).toBe('Success_200');
  });

  it('falls back to index-based key', () => {
    expect(toExampleKey(undefined, 3)).toBe('example_3');
  });
});

describe('flattenItems', () => {
  it('flattens nested folders with tags', () => {
    const items = flattenItems([
      {
        name: 'Users',
        item: [
          {
            name: 'getUser',
            request: { method: 'GET', url: '/users', header: [] },
            response: [],
          },
        ],
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('getUser');
    expect(items[0]._tags).toEqual(['Users']);
  });
});
