import type {
  PostmanBody,
  PostmanHeader,
  PostmanItem,
  PostmanRequestDef,
  PostmanResponse,
  JSONSchema,
} from './types';
import { isPostmanFolder } from './types';
import { inferSchema } from './schema';

// ---------------------------------------------------------------------------
// Noisy HTTP headers that carry no API-contract meaning
// ---------------------------------------------------------------------------
const NOISY_HEADERS_LOWER = new Set([
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-allow-origin',
  'access-control-expose-headers',
  'access-control-max-age',
  'connection',
  'content-encoding',
  'content-length',
  'content-security-policy',
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'date',
  'etag',
  'keep-alive',
  'origin-agent-cluster',
  'referrer-policy',
  'server',
  'set-cookie',
  'strict-transport-security',
  'transfer-encoding',
  'vary',
  'x-content-type-options',
  'x-dns-prefetch-control',
  'x-download-options',
  'x-frame-options',
  'x-permitted-cross-domain-policies',
  'x-xss-protection',
  'x-request-id',
  'authorization',
]);

/**
 * Returns true if a header name is a noisy HTTP transport header.
 * Comparison is case-insensitive.
 */
export function isNoisyHeader(name: string): boolean {
  return NOISY_HEADERS_LOWER.has(name.toLowerCase());
}

/**
 * Parse a raw JSON string safely. Returns undefined on failure.
 */
export function tryParseJSON(raw: string | undefined | null): unknown {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * Parse an example value that may be a raw JSON string or already an object.
 */
export function parseExampleValue(val: unknown): unknown {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

// ---------------------------------------------------------------------------
// Postman URL parsing
// ---------------------------------------------------------------------------

export interface ParsedPostmanUrl {
  serverVar: string | null;
  path: string;
}

/**
 * Parse a Postman URL (string or object) into { serverVar, path }.
 * "{{SAI_SF_GATEWAY}}/v1/common/master/getState"
 *   → { serverVar: 'SAI_SF_GATEWAY', path: '/v1/common/master/getState' }
 */
export function parsePostmanUrl(url: string | { raw?: string } | undefined): ParsedPostmanUrl {
  if (!url) return { serverVar: null, path: '/' };

  const raw = typeof url === 'object' ? (url.raw ?? '') : url;
  const match = raw.match(/^\{\{([^}]+)\}\}(\/.*)?$/);
  if (match) {
    return { serverVar: match[1], path: match[2] || '/' };
  }

  try {
    const u = new URL(raw);
    return { serverVar: null, path: u.pathname || '/' };
  } catch {
    return { serverVar: null, path: raw.startsWith('/') ? raw : `/${raw}` };
  }
}

// ---------------------------------------------------------------------------
// Postman body → schema + example
// ---------------------------------------------------------------------------

export interface ParsedBody {
  mediaType: string;
  schema: JSONSchema;
  exampleValue: unknown;
}

/**
 * Convert a Postman body object to { mediaType, schema, exampleValue }.
 */
export function parseBody(body: PostmanBody | undefined | null): ParsedBody | null {
  if (!body || body.mode === 'none') return null;

  if (body.mode === 'raw') {
    const isJson = body.options?.raw?.language === 'json';
    const parsed = isJson ? tryParseJSON(body.raw) : undefined;
    return {
      mediaType: 'application/json',
      schema: parsed !== undefined ? inferSchema(parsed) : { type: 'string' },
      exampleValue: parsed,
    };
  }

  if (body.mode === 'formdata') {
    const properties: Record<string, JSONSchema> = {};
    for (const field of body.formdata ?? []) {
      if (field.disabled) continue;
      properties[field.key] =
        field.type === 'file' ? { type: 'string', format: 'binary' } : { type: 'string' };
    }
    return {
      mediaType: 'multipart/form-data',
      schema: { type: 'object', properties },
      exampleValue: undefined,
    };
  }

  if (body.mode === 'urlencoded') {
    const properties: Record<string, JSONSchema> = {};
    for (const field of body.urlencoded ?? []) {
      if (field.disabled) continue;
      properties[field.key] = { type: 'string' };
    }
    return {
      mediaType: 'application/x-www-form-urlencoded',
      schema: { type: 'object', properties },
      exampleValue: undefined,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Header helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Postman header array to OpenAPI parameter objects.
 */
export function headersToParameters(
  headers: PostmanHeader[] | undefined,
): { name: string; in: 'header'; schema: JSONSchema; example?: string }[] {
  if (!Array.isArray(headers)) return [];
  return headers
    .filter((h) => !h.disabled && h.key && !isNoisyHeader(h.key))
    .map((h) => ({
      name: h.key,
      in: 'header' as const,
      schema: { type: 'string' } as JSONSchema,
      ...(h.value && !h.value.startsWith('{{') ? { example: h.value } : {}),
    }));
}

/**
 * Detect the Content-Type from a Postman response header array.
 */
export function getContentType(headers: PostmanHeader[] | undefined): string {
  if (!Array.isArray(headers)) return 'application/json';
  const ct = headers.find((h) => h.key?.toLowerCase() === 'content-type');
  if (!ct) return 'application/json';
  return ct.value.split(';')[0].trim();
}

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

/**
 * Derive a camelCase operationId from a Postman request name.
 * "master/getState" → "masterGetstate"
 * "set-mpin"        → "setMpin"
 */
export function toOperationId(name: string, method: string, path: string): string {
  const src = name || path;
  const parts = src
    .replace(/^\/+/, '')
    .split(/[/\-_]+/)
    .filter(Boolean);
  if (parts.length === 0) return method.toLowerCase();
  return parts
    .map((p, i) =>
      i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(),
    )
    .join('');
}

/**
 * Build a safe example key from a Postman response name.
 */
export function toExampleKey(name: string | undefined, index: number): string {
  const key = (name || `example_${index}`)
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return key || `example_${index}`;
}

// ---------------------------------------------------------------------------
// Flatten Postman items recursively
// ---------------------------------------------------------------------------

export interface FlatPostmanItem {
  name: string;
  id?: string;
  request: PostmanRequestDef;
  response: PostmanResponse[];
  _tags: string[];
}

/**
 * Recursively flatten Postman items, tracking folder names as tags.
 */
export function flattenItems(items: PostmanItem[], tags: string[] = []): FlatPostmanItem[] {
  const result: FlatPostmanItem[] = [];
  for (const item of items) {
    if (isPostmanFolder(item)) {
      result.push(...flattenItems(item.item, [...tags, item.name]));
    } else if ('request' in item && !isPostmanFolder(item)) {
      result.push({
        name: item.name,
        id: item.id,
        request: item.request,
        response: item.response ?? [],
        _tags: tags,
      });
    }
  }
  return result;
}
