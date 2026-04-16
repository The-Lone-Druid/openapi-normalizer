import type {
  OpenAPIDocument,
  OpenAPIServer,
  OpenAPIServerVariable,
  OpenAPITag,
  OpenAPIPathItem,
  OpenAPIOperation,
  OpenAPIResponse,
  OpenAPIMediaType,
  OpenAPIParameter,
  OpenAPIRequestBody,
  OpenAPIComponents,
  OpenAPISecurityRequirement,
  PostmanCollection,
  PostmanHeader,
  PostmanAuth,
  JSONSchema,
  ConvertOptions,
} from './types';
import { inferSchema, mergeSchemas, inferRequired, type InferSchemaOptions } from './schema';
import {
  parsePostmanUrl,
  parseBody,
  headersToParameters,
  getContentType,
  toOperationId,
  toExampleKey,
  flattenItems,
  tryParseJSON,
} from './utils';

// ---------------------------------------------------------------------------
// Resolved options (with defaults applied)
// ---------------------------------------------------------------------------

interface ResolvedConvertOptions {
  inferRequired: boolean;
  inferFormats: boolean;
  tagFromFolder: boolean;
  operationIdStyle: 'camelCase' | 'snake_case' | 'kebab-case';
  defaultContentType: string;
}

function resolveConvertOptions(options?: ConvertOptions): ResolvedConvertOptions {
  return {
    inferRequired: options?.inferRequired ?? false,
    inferFormats: options?.inferFormats ?? false,
    tagFromFolder: options?.tagFromFolder ?? true,
    operationIdStyle: options?.operationIdStyle ?? 'camelCase',
    defaultContentType: options?.defaultContentType ?? 'application/json',
  };
}

// ---------------------------------------------------------------------------
// OperationId styling
// ---------------------------------------------------------------------------

function formatOperationId(
  name: string,
  method: string,
  path: string,
  style: 'camelCase' | 'snake_case' | 'kebab-case',
): string {
  if (style === 'camelCase') return toOperationId(name, method, path);

  const src = name || path;
  const parts = src
    .replace(/^\/+/, '')
    .split(/[/\-_\s]+/)
    .filter(Boolean)
    .map((p) => p.toLowerCase());
  if (parts.length === 0) return method.toLowerCase();

  if (style === 'snake_case') return parts.join('_');
  return parts.join('-'); // kebab-case
}

// ---------------------------------------------------------------------------
// Auth mapping: Postman → OpenAPI securitySchemes
// ---------------------------------------------------------------------------

interface MappedAuth {
  schemeName: string;
  scheme: Record<string, unknown>;
}

function mapPostmanAuth(auth: PostmanAuth | undefined): MappedAuth | null {
  if (!auth || !auth.type) return null;

  switch (auth.type) {
    case 'bearer':
      return {
        schemeName: 'bearerAuth',
        scheme: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      };
    case 'basic':
      return {
        schemeName: 'basicAuth',
        scheme: { type: 'http', scheme: 'basic' },
      };
    case 'apikey': {
      const apiKeyArr = auth.apikey as { key: string; value: string }[] | undefined;
      const keyEntry = apiKeyArr?.find((e) => e.key === 'key');
      const inEntry = apiKeyArr?.find((e) => e.key === 'in');
      return {
        schemeName: 'apiKeyAuth',
        scheme: {
          type: 'apiKey',
          in: inEntry?.value || 'header',
          name: keyEntry?.value || 'X-API-Key',
        },
      };
    }
    case 'oauth2':
      return {
        schemeName: 'oauth2Auth',
        scheme: {
          type: 'oauth2',
          flows: {
            implicit: {
              authorizationUrl: '',
              scopes: {},
            },
          },
        },
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Query parameter extraction from Postman URL
// ---------------------------------------------------------------------------

function extractQueryParameters(
  url:
    | string
    | { raw?: string; query?: { key: string; value: string; disabled?: boolean }[] }
    | undefined,
): OpenAPIParameter[] {
  if (!url || typeof url === 'string') return [];

  const queryArr = url.query;
  if (!Array.isArray(queryArr)) return [];

  return queryArr
    .filter((q) => !q.disabled && q.key)
    .map((q) => {
      const param: OpenAPIParameter = {
        name: q.key,
        in: 'query',
        schema: { type: 'string' },
      };
      if (q.value && !q.value.startsWith('{{')) {
        param.example = q.value;
      }
      return param;
    });
}

// ---------------------------------------------------------------------------
// Path parameter extraction
// ---------------------------------------------------------------------------

function extractPathParameters(path: string): {
  normalizedPath: string;
  params: OpenAPIParameter[];
} {
  // Convert :param to {param}
  let normalizedPath = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');

  // Auto-parameterize hardcoded IDs (MongoDB ObjectIDs, UUIDs, numeric IDs)
  const idPattern =
    /\/([0-9a-f]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)(?=\/|$)/gi;
  normalizedPath = normalizedPath.replace(idPattern, (fullMatch, _id, offset) => {
    // Derive param name from the preceding path segment
    const before = normalizedPath.slice(0, offset);
    const segments = before.split('/').filter(Boolean);
    const prev = segments[segments.length - 1] || 'id';
    // Simple singularization: strip trailing 's' and append 'Id'
    const base = prev.endsWith('s') ? prev.slice(0, -1) : prev;
    const paramName = base + 'Id';
    return `/{${paramName}}`;
  });

  const params: OpenAPIParameter[] = [];
  const paramPattern = /\{([^}]+)\}/g;
  let match;
  const seen = new Set<string>();
  while ((match = paramPattern.exec(normalizedPath)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      params.push({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });
    }
  }

  return { normalizedPath, params };
}

// ---------------------------------------------------------------------------
// Internal types for the grouping map
// ---------------------------------------------------------------------------

interface CollectedResponse {
  exKey: string;
  name: string;
  code: string;
  contentType: string;
  reqExampleValue: unknown;
  reqMediaType: string | undefined;
  respExampleValue: unknown;
  origHeaders: PostmanHeader[];
}

interface OperationBuilder {
  method: string;
  path: string;
  serverVar: string | null;
  tags: string[];
  summary: string;
  parameters: ReturnType<typeof headersToParameters>;
  queryParameters: OpenAPIParameter[];
  pathParameters: OpenAPIParameter[];
  mainBody: ReturnType<typeof parseBody>;
  responses: CollectedResponse[];
  auth: PostmanAuth | undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a Postman Collection (v2.0 / v2.1) to an OpenAPI 3.0.3 document.
 *
 * Key feature: correlated named examples – the same key appears in both
 * `requestBody.content[*].examples` and `response.content[*].examples`
 * so tooling (Swagger UI, Stoplight, Redocly) can show the full
 * request ↔ response pair for each scenario.
 */
export function convertCollection(
  collection: PostmanCollection,
  options?: ConvertOptions,
): OpenAPIDocument {
  const opts = resolveConvertOptions(options);
  const schemaOpts: InferSchemaOptions = { detectFormats: opts.inferFormats };
  const info = collection.info ?? ({} as PostmanCollection['info']);

  // Collect all items and server variables
  const allItems = flattenItems(collection.item ?? []);
  const serverVarSet = new Set<string>();

  for (const item of allItems) {
    const req = item.request;
    const { serverVar } = parsePostmanUrl(req?.url);
    if (serverVar) serverVarSet.add(serverVar);
  }

  // Build server variables from collection.variable[]
  const collectionVarMap = new Map<string, string>();
  for (const v of collection.variable ?? []) {
    if (v.key && v.value) collectionVarMap.set(v.key, v.value);
  }

  const servers: OpenAPIServer[] =
    serverVarSet.size > 0
      ? [...serverVarSet].map((varName) => {
          const defaultVal = collectionVarMap.get(varName);
          const variables: Record<string, OpenAPIServerVariable> = {
            [varName]: {
              default: defaultVal || '',
              description: `${varName} — set this URL in your environment`,
            },
          };
          return {
            url: `{${varName}}`,
            description: `${varName} server`,
            variables,
            'x-postman-variable': `{{${varName}}}`,
          };
        })
      : [{ url: '/' }];

  // Collect auth from collection level
  const collectionAuth = collection.auth;

  // Group items by method + path → one operation each
  const pathMap = new Map<string, OperationBuilder>();

  for (const item of allItems) {
    const req = item.request;
    if (!req) continue;

    const method = (req.method || 'POST').toLowerCase();
    const { path: rawPath } = parsePostmanUrl(req.url);
    const { normalizedPath, params: pathParams } = extractPathParameters(rawPath);
    const mapKey = `${method.toUpperCase()} ${normalizedPath}`;

    if (!pathMap.has(mapKey)) {
      pathMap.set(mapKey, {
        method,
        path: normalizedPath,
        serverVar: parsePostmanUrl(req.url).serverVar,
        tags: opts.tagFromFolder ? [...item._tags] : [],
        summary: item.name,
        parameters: headersToParameters(req.header),
        queryParameters: extractQueryParameters(req.url),
        pathParameters: pathParams,
        mainBody: parseBody(req.body),
        responses: [],
        auth: req.auth ?? item._auth,
      });
    } else {
      const existing = pathMap.get(mapKey)!;
      if (opts.tagFromFolder) {
        for (const t of item._tags) {
          if (!existing.tags.includes(t)) existing.tags.push(t);
        }
      }
      // Merge query parameters from duplicate path entries
      const newQueryParams = extractQueryParameters(req.url);
      for (const qp of newQueryParams) {
        if (!existing.queryParameters.some((p) => p.name === qp.name)) {
          existing.queryParameters.push(qp);
        }
      }
      // Merge path parameters
      const { params: newPathParams } = extractPathParameters(rawPath);
      for (const pp of newPathParams) {
        if (!existing.pathParameters.some((p) => p.name === pp.name)) {
          existing.pathParameters.push(pp);
        }
      }
    }

    const op = pathMap.get(mapKey)!;

    // Process each saved response
    const responses = item.response ?? [];
    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i];
      const exKey = toExampleKey(resp.name, i);

      const origReq = resp.originalRequest;
      const origBody = origReq ? parseBody(origReq.body) : null;
      const origHeaders = origReq?.header ?? [];

      const contentType = getContentType(resp.header);
      const respBodyParsed = tryParseJSON(resp.body);

      op.responses.push({
        exKey,
        name: resp.name ?? `Response ${i}`,
        code: String(resp.code || 200),
        contentType: contentType.startsWith('application/json') ? 'application/json' : contentType,
        reqExampleValue: origBody?.exampleValue,
        reqMediaType: origBody?.mediaType,
        respExampleValue: respBodyParsed,
        origHeaders,
      });
    }
  }

  // Build OpenAPI paths
  const paths: Record<string, OpenAPIPathItem> = {};
  const usedOperationIds = new Set<string>();
  const securitySchemes: Record<string, unknown> = {};

  for (const [, op] of pathMap) {
    if (!paths[op.path]) paths[op.path] = {};

    // Group saved responses by status code
    const responsesByCode: Record<string, CollectedResponse[]> = {};
    for (const r of op.responses) {
      if (!responsesByCode[r.code]) responsesByCode[r.code] = [];
      responsesByCode[r.code].push(r);
    }

    // --- Build request body ---
    let requestBody: OpenAPIRequestBody | undefined;

    if (op.mainBody || op.responses.length > 0) {
      const mediaType =
        op.mainBody?.mediaType ||
        op.responses.find((r) => r.reqMediaType)?.reqMediaType ||
        opts.defaultContentType;

      const reqExamples = op.responses
        .filter((r) => r.reqExampleValue !== undefined)
        .map((r) => ({ key: r.exKey, value: r.reqExampleValue }));

      const allReqPayloads: unknown[] = [
        ...(op.mainBody?.exampleValue !== undefined ? [op.mainBody.exampleValue] : []),
        ...reqExamples.map((e) => e.value),
      ];

      let reqSchema: JSONSchema =
        allReqPayloads.length > 0
          ? mergeSchemas(allReqPayloads.map((v) => inferSchema(v, schemaOpts)))
          : (op.mainBody?.schema ?? {});

      // Infer required fields
      if (opts.inferRequired && allReqPayloads.length >= 2) {
        const required = inferRequired(allReqPayloads);
        if (required.length > 0 && reqSchema.type === 'object') {
          reqSchema = { ...reqSchema, required };
        }
      }

      const mediaObj: OpenAPIMediaType = { schema: reqSchema };

      if (reqExamples.length > 1) {
        mediaObj.examples = {};
        for (const { key, value } of reqExamples) {
          mediaObj.examples[key] = { value };
        }
      } else if (reqExamples.length === 1) {
        mediaObj.example = reqExamples[0].value;
      } else if (op.mainBody?.exampleValue !== undefined) {
        mediaObj.example = op.mainBody.exampleValue;
      }

      requestBody = { content: { [mediaType]: mediaObj } };
    }

    // --- Build responses ---
    const builtResponses: Record<string, OpenAPIResponse> = {};

    if (Object.keys(responsesByCode).length === 0) {
      builtResponses['200'] = { description: '' };
    }

    for (const [code, resps] of Object.entries(responsesByCode)) {
      const description = [...new Set(resps.map((r) => r.name))].join(' / ');
      const contentType = resps[0].contentType;

      const respExamples = resps.filter((r) => r.respExampleValue !== undefined);
      const allRespPayloads = respExamples.map((r) => r.respExampleValue);
      let respSchema: JSONSchema =
        allRespPayloads.length > 0
          ? mergeSchemas(allRespPayloads.map((v) => inferSchema(v, schemaOpts)))
          : {};

      // Infer required fields for response schemas
      if (opts.inferRequired && allRespPayloads.length >= 2) {
        const required = inferRequired(allRespPayloads);
        if (required.length > 0 && respSchema.type === 'object') {
          respSchema = { ...respSchema, required };
        }
      }

      const mediaObj: OpenAPIMediaType = { schema: respSchema };

      if (respExamples.length > 1) {
        mediaObj.examples = {};
        for (const r of respExamples) {
          mediaObj.examples[r.exKey] = { value: r.respExampleValue };
        }
      } else if (respExamples.length === 1) {
        mediaObj.example = respExamples[0].respExampleValue;
      }

      const responseObj: OpenAPIResponse = { description };
      if (Object.keys(respSchema).length > 0 || respExamples.length > 0) {
        responseObj.content = { [contentType]: mediaObj };
      }

      builtResponses[code] = responseObj;
    }

    // --- Build parameters (deduplicate by name+in) ---
    const paramMap = new Map<string, OpenAPIParameter>();

    // Path parameters first
    for (const p of op.pathParameters) {
      paramMap.set(`${p.in}:${p.name}`, p);
    }

    // Query parameters
    for (const p of op.queryParameters) {
      paramMap.set(`${p.in}:${p.name}`, p);
    }

    // Header parameters
    for (const p of op.parameters) {
      paramMap.set(`${p.in}:${p.name}`, p as OpenAPIParameter);
    }
    const parameters = [...paramMap.values()];

    // --- Assemble operation (deduplicate operationId) ---
    let opId = formatOperationId(op.summary, op.method, op.path, opts.operationIdStyle);
    if (usedOperationIds.has(opId)) {
      let suffix = 1;
      while (usedOperationIds.has(`${opId}${suffix}`)) suffix++;
      opId = `${opId}${suffix}`;
    }
    usedOperationIds.add(opId);

    const operation: OpenAPIOperation = {
      tags: op.tags.length > 0 ? op.tags : undefined,
      summary: op.summary,
      operationId: opId,
      responses: builtResponses,
    };

    if (parameters.length > 0) operation.parameters = parameters;
    if (requestBody) operation.requestBody = requestBody;

    // Map auth for this operation (request-level > folder-level > collection-level)
    const effectiveAuth = op.auth ?? collectionAuth;
    const mapped = mapPostmanAuth(effectiveAuth);
    if (mapped) {
      securitySchemes[mapped.schemeName] = mapped.scheme;
      operation.security = [{ [mapped.schemeName]: [] }];
    }

    (paths[op.path] as Record<string, OpenAPIOperation>)[op.method] = operation;
  }

  // Build deduplicated tags from folder structure
  const tagSet = new Map<string, OpenAPITag>();
  if (opts.tagFromFolder) {
    for (const item of allItems) {
      for (const tag of item._tags) {
        if (!tagSet.has(tag)) tagSet.set(tag, { name: tag });
      }
    }
  }

  // Build components if we have security schemes
  const components: OpenAPIComponents | undefined =
    Object.keys(securitySchemes).length > 0 ? { securitySchemes } : undefined;

  // Build top-level security if collection-level auth exists
  let topLevelSecurity: OpenAPISecurityRequirement[] | undefined;
  if (collectionAuth) {
    const mapped = mapPostmanAuth(collectionAuth);
    if (mapped) {
      topLevelSecurity = [{ [mapped.schemeName]: [] }];
    }
  }

  const result: OpenAPIDocument = {
    openapi: '3.0.3',
    info: {
      title: info.name || 'API',
      version: '1.0.0',
    },
    servers,
    paths,
  };

  if (tagSet.size > 0) result.tags = [...tagSet.values()];
  if (components) result.components = components;
  if (topLevelSecurity) result.security = topLevelSecurity;

  return result;
}
