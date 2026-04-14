import type {
  OpenAPIDocument,
  OpenAPIServer,
  OpenAPITag,
  OpenAPIPathItem,
  OpenAPIOperation,
  OpenAPIResponse,
  OpenAPIMediaType,
  OpenAPIParameter,
  OpenAPIRequestBody,
  PostmanCollection,
  PostmanHeader,
  JSONSchema,
} from './types';
import { inferSchema, mergeSchemas } from './schema';
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
  mainBody: ReturnType<typeof parseBody>;
  responses: CollectedResponse[];
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
export function convertCollection(collection: PostmanCollection): OpenAPIDocument {
  const info = collection.info ?? ({} as PostmanCollection['info']);

  // Collect all items and server variables
  const allItems = flattenItems(collection.item ?? []);
  const serverVarSet = new Set<string>();

  for (const item of allItems) {
    const req = item.request;
    const { serverVar } = parsePostmanUrl(req?.url);
    if (serverVar) serverVarSet.add(serverVar);
  }

  const servers: OpenAPIServer[] =
    serverVarSet.size > 0
      ? [...serverVarSet].map((v) => ({
          url: '/',
          description: `${v} — set this URL in your environment`,
          'x-postman-variable': `{{${v}}}`,
        }))
      : [{ url: '/' }];

  // Group items by method + path → one operation each
  const pathMap = new Map<string, OperationBuilder>();

  for (const item of allItems) {
    const req = item.request;
    if (!req) continue;

    const method = (req.method || 'POST').toLowerCase();
    const { path } = parsePostmanUrl(req.url);
    const mapKey = `${method.toUpperCase()} ${path}`;

    if (!pathMap.has(mapKey)) {
      pathMap.set(mapKey, {
        method,
        path,
        serverVar: parsePostmanUrl(req.url).serverVar,
        tags: [...item._tags],
        summary: item.name,
        parameters: headersToParameters(req.header),
        mainBody: parseBody(req.body),
        responses: [],
      });
    } else {
      const existing = pathMap.get(mapKey)!;
      for (const t of item._tags) {
        if (!existing.tags.includes(t)) existing.tags.push(t);
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
        'application/json';

      const reqExamples = op.responses
        .filter((r) => r.reqExampleValue !== undefined)
        .map((r) => ({ key: r.exKey, value: r.reqExampleValue }));

      const allReqPayloads: unknown[] = [
        ...(op.mainBody?.exampleValue !== undefined ? [op.mainBody.exampleValue] : []),
        ...reqExamples.map((e) => e.value),
      ];

      const reqSchema: JSONSchema =
        allReqPayloads.length > 0
          ? mergeSchemas(allReqPayloads.map(inferSchema))
          : (op.mainBody?.schema ?? {});

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
      const respSchema: JSONSchema =
        allRespPayloads.length > 0 ? mergeSchemas(allRespPayloads.map(inferSchema)) : {};

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
    for (const p of op.parameters) {
      paramMap.set(`${p.in}:${p.name}`, p as OpenAPIParameter);
    }
    const parameters = [...paramMap.values()];

    // --- Assemble operation (deduplicate operationId) ---
    let opId = toOperationId(op.summary, op.method, op.path);
    if (usedOperationIds.has(opId)) {
      let suffix = 1;
      while (usedOperationIds.has(`${opId}${suffix}`)) suffix++;
      opId = `${opId}${suffix}`;
    }
    usedOperationIds.add(opId);

    const operation: OpenAPIOperation = {
      tags: op.tags,
      summary: op.summary,
      operationId: opId,
      responses: builtResponses,
    };

    if (parameters.length > 0) operation.parameters = parameters;
    if (requestBody) operation.requestBody = requestBody;

    (paths[op.path] as Record<string, OpenAPIOperation>)[op.method] = operation;
  }

  // Build deduplicated tags from folder structure
  const tagSet = new Map<string, OpenAPITag>();
  for (const item of allItems) {
    for (const tag of item._tags) {
      if (!tagSet.has(tag)) tagSet.set(tag, { name: tag });
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: info.name || 'API',
      version: '1.0.0',
    },
    servers,
    paths,
    tags: [...tagSet.values()],
  };
}
