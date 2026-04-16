import type {
  OpenAPIDocument,
  OpenAPIInfo,
  OpenAPIServer,
  OpenAPITag,
  OpenAPIComponents,
  OpenAPIOperation,
  OpenAPIResponse,
  OpenAPIMediaType,
  OpenAPIPathItem,
  NormalizeOptions,
} from './types';
import { HTTP_METHODS } from './types';
import { inferSchema, mergeSchemas, stripPropertyExamples } from './schema';
import { isNoisyHeader, parseExampleValue } from './utils';

// ---------------------------------------------------------------------------
// Resolved options (with defaults applied)
// ---------------------------------------------------------------------------

interface ResolvedNormalizeOptions {
  preserveHeaders: Set<string>;
  additionalNoisyHeaders: Set<string>;
  stripXExtensions: boolean;
  keepExamples: boolean;
  inferSchemas: boolean;
}

function resolveOptions(options?: NormalizeOptions): ResolvedNormalizeOptions {
  return {
    preserveHeaders: new Set((options?.preserveHeaders ?? []).map((h) => h.toLowerCase())),
    additionalNoisyHeaders: new Set(
      (options?.additionalNoisyHeaders ?? []).map((h) => h.toLowerCase()),
    ),
    stripXExtensions: options?.stripXExtensions ?? false,
    keepExamples: options?.keepExamples ?? false,
    inferSchemas: options?.inferSchemas ?? true,
  };
}

function isHeaderNoisy(name: string, opts: ResolvedNormalizeOptions): boolean {
  const lower = name.toLowerCase();
  if (opts.preserveHeaders.has(lower)) return false;
  if (opts.additionalNoisyHeaders.has(lower)) return true;
  return isNoisyHeader(name);
}

// ---------------------------------------------------------------------------
// Media-type normalization
// ---------------------------------------------------------------------------

function normalizeMediaTypeObject(
  mediaObj: OpenAPIMediaType,
  opts: ResolvedNormalizeOptions,
): OpenAPIMediaType {
  const result: OpenAPIMediaType = { ...mediaObj };
  const hasExamples = result.examples && Object.keys(result.examples).length > 0;

  if (hasExamples) {
    const exampleEntries = Object.values(result.examples!);
    const parsedValues = exampleEntries
      .map((ex) => parseExampleValue(ex.value))
      .filter((v): v is NonNullable<typeof v> => v !== undefined && v !== null);

    const schemaIsEmpty = !result.schema || Object.keys(result.schema).length === 0;

    if (opts.inferSchemas && schemaIsEmpty && parsedValues.length > 0) {
      const inferred = mergeSchemas(parsedValues.map((v) => inferSchema(v)));
      if (Object.keys(inferred).length > 0) {
        result.schema = inferred;
      }
    }

    if (!opts.keepExamples) {
      if (parsedValues[0] !== undefined) {
        result.example = parsedValues[0];
      }
      delete result.examples;
    }
  }

  if (result.schema && Object.keys(result.schema).length === 0) {
    delete result.schema;
  }

  if (result.schema) {
    result.schema = stripPropertyExamples(result.schema);
  }

  return result;
}

function normalizeContent(
  content: Record<string, OpenAPIMediaType>,
  opts: ResolvedNormalizeOptions,
): Record<string, OpenAPIMediaType> {
  const result: Record<string, OpenAPIMediaType> = {};
  for (const [mediaType, mediaObj] of Object.entries(content)) {
    result[mediaType] = normalizeMediaTypeObject(mediaObj, opts);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Header stripping
// ---------------------------------------------------------------------------

function stripNoisyHeaders(
  headers: Record<string, unknown> | undefined,
  opts: ResolvedNormalizeOptions,
): Record<string, unknown> | undefined {
  if (!headers) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [name, headerObj] of Object.entries(headers)) {
    if (!isHeaderNoisy(name, opts)) {
      cleaned[name] = headerObj;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

// ---------------------------------------------------------------------------
// Response normalization
// ---------------------------------------------------------------------------

function normalizeResponse(
  response: OpenAPIResponse,
  opts: ResolvedNormalizeOptions,
): OpenAPIResponse {
  const result: OpenAPIResponse = { description: response.description ?? '' };

  const headers = stripNoisyHeaders(response.headers, opts);
  if (headers) result.headers = headers as Record<string, never>;

  if (response.content) {
    result.content = normalizeContent(response.content, opts);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Operation normalization
// ---------------------------------------------------------------------------

function normalizeOperation(
  operation: OpenAPIOperation,
  opts: ResolvedNormalizeOptions,
): OpenAPIOperation {
  const result: OpenAPIOperation = { ...operation };

  if (result.description && result.summary && result.description.trim() === result.summary.trim()) {
    delete result.description;
  }

  if (Array.isArray(result.security)) {
    const meaningful = result.security.filter((s) => s && Object.keys(s).length > 0);
    if (meaningful.length === 0) delete result.security;
    else result.security = meaningful;
  }

  if (result.requestBody?.content) {
    result.requestBody = {
      ...result.requestBody,
      content: normalizeContent(result.requestBody.content, opts),
    };
  }

  if (result.responses) {
    const normalizedResponses: Record<string, OpenAPIResponse> = {};
    for (const [code, response] of Object.entries(result.responses)) {
      normalizedResponses[code] = normalizeResponse(response, opts);
    }
    result.responses = normalizedResponses;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Paths normalization
// ---------------------------------------------------------------------------

function normalizePaths(
  paths: Record<string, OpenAPIPathItem>,
  opts: ResolvedNormalizeOptions,
): Record<string, OpenAPIPathItem> {
  const result: Record<string, OpenAPIPathItem> = {};
  for (const [pathStr, pathItem] of Object.entries(paths)) {
    const normalizedItem: OpenAPIPathItem = { ...pathItem };
    for (const method of HTTP_METHODS) {
      if (normalizedItem[method]) {
        normalizedItem[method] = normalizeOperation(normalizedItem[method]!, opts);
      }
    }
    result[pathStr] = normalizedItem;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tags, servers, info, components normalization
// ---------------------------------------------------------------------------

function normalizeTags(tags: OpenAPITag[]): OpenAPITag[] {
  const seen = new Map<string, OpenAPITag>();
  for (const tag of tags) {
    const existing = seen.get(tag.name);
    if (!existing || tag.description) {
      seen.set(tag.name, tag);
    }
  }
  return [...seen.values()];
}

function normalizeServers(servers: OpenAPIServer[]): OpenAPIServer[] {
  return servers.map((server) => {
    const match = server.url?.match(/^\{\{(.+)\}\}$/);
    if (match) {
      return {
        url: '/',
        description: `${match[1]} — set this URL in your environment`,
        'x-postman-variable': server.url,
      };
    }
    return server;
  });
}

function normalizeInfo(info: OpenAPIInfo): OpenAPIInfo {
  const result: OpenAPIInfo = { ...info };
  if (result.contact && Object.keys(result.contact).length === 0) {
    delete result.contact;
  }
  return result;
}

function normalizeComponents(components: OpenAPIComponents): OpenAPIComponents | undefined {
  const result: OpenAPIComponents = { ...components };
  if (result.securitySchemes && Object.keys(result.securitySchemes).length === 0) {
    delete result.securitySchemes;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ---------------------------------------------------------------------------
// Strip x-* vendor extensions
// ---------------------------------------------------------------------------

function stripXExtensionKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('x-')) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = stripXExtensionKeys(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? stripXExtensionKeys(item as Record<string, unknown>)
          : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a Postman-exported OpenAPI document.
 *
 * - Strips noisy HTTP transport response headers
 * - Collapses named `examples` → single `example`
 * - Infers schemas from example values when missing
 * - Strips per-property inline `example` values
 * - Removes empty `security: [{}]`
 * - Removes `description` duplicating `summary`
 * - Deduplicates tags
 * - Annotates Postman `{{VAR}}` server URLs
 * - Removes empty `contact`, `components.securitySchemes`, etc.
 */
export function normalize(openapi: OpenAPIDocument, options?: NormalizeOptions): OpenAPIDocument {
  const opts = resolveOptions(options);
  let result: OpenAPIDocument = { ...openapi };

  if (result.info) result.info = normalizeInfo(result.info);
  if (result.servers) result.servers = normalizeServers(result.servers);
  if (result.paths) result.paths = normalizePaths(result.paths, opts);
  if (result.tags) result.tags = normalizeTags(result.tags);

  const components = result.components ? normalizeComponents(result.components) : undefined;
  if (components) result.components = components;
  else delete result.components;

  if (opts.stripXExtensions) {
    result = stripXExtensionKeys(
      result as unknown as Record<string, unknown>,
    ) as unknown as OpenAPIDocument;
  }

  return result;
}
