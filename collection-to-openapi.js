#!/usr/bin/env node
'use strict';

/**
 * collection-to-openapi.js
 *
 * Converts a Postman Collection JSON (v2.0 / v2.1) directly to a clean,
 * standard-compliant OpenAPI 3.0.3 file.
 *
 * Key advantage over the Postman → "Export as OpenAPI" approach:
 *   Each saved response in Postman stores the exact request payload
 *   (originalRequest) that produced it. This converter uses that data to
 *   emit properly CORRELATED named examples — the same key appears in both
 *   requestBody.content[*].examples  and  response.content[*].examples,
 *   so tooling (Swagger UI, Stoplight, Redocly) can show the full
 *   request ↔ response pair for each scenario.
 *
 * Usage:
 *   node collection-to-openapi.js <collection.json> [output.json]
 *   node collection-to-openapi.js postman-collection.json
 *   node collection-to-openapi.js postman-collection.json api.openapi.json
 */

const fs = require('fs');

// ---------------------------------------------------------------------------
// HTTP transport headers that carry no API contract meaning — strip them
// ---------------------------------------------------------------------------
const NOISY_HEADER_KEYS = new Set([
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
  'authorization', // response token — not a contract header
]);

// Headers that become OpenAPI parameters rather than request headers
const PARAM_HEADER_KEYS = new Set([
  'apikey',
  'username',
  'jid',
  'apiKey',
  'userName',
]);

// ---------------------------------------------------------------------------
// Schema inference from a runtime JSON value
// ---------------------------------------------------------------------------
function inferSchema(value) {
  if (value === null) return { nullable: true };
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: 'array', items: {} };
    return { type: 'array', items: mergeSchemas(value.map(inferSchema)) };
  }
  if (typeof value === 'object') {
    const properties = {};
    for (const [k, v] of Object.entries(value)) {
      properties[k] = inferSchema(v);
    }
    return { type: 'object', properties };
  }
  if (typeof value === 'string') return { type: 'string' };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
  }
  if (typeof value === 'boolean') return { type: 'boolean' };
  return {};
}

function mergeSchemas(schemas) {
  schemas = schemas.filter((s) => s && Object.keys(s).length > 0);
  if (schemas.length === 0) return {};
  if (schemas.length === 1) return schemas[0];

  const types = [...new Set(schemas.map((s) => s.type).filter(Boolean))];

  if (types.length === 1 && types[0] === 'object') {
    const allProps = {};
    for (const schema of schemas) {
      for (const [k, v] of Object.entries(schema.properties || {})) {
        allProps[k] = allProps[k] ? mergeSchemas([allProps[k], v]) : v;
      }
    }
    return { type: 'object', properties: allProps };
  }
  if (types.length === 1 && types[0] === 'array') {
    const itemSchemas = schemas.map((s) => s.items).filter(Boolean);
    return { type: 'array', items: mergeSchemas(itemSchemas) };
  }
  if (types.length <= 1) return schemas[0];
  return { oneOf: schemas };
}

// ---------------------------------------------------------------------------
// Parse a raw JSON string safely; return undefined on failure
// ---------------------------------------------------------------------------
function tryParseJSON(raw) {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Derive a clean operationId from method + path
// e.g.  POST /v1/common/master/getState  →  postV1CommonMasterGetState
// ---------------------------------------------------------------------------
function toOperationId(method, path) {
  const parts = path
    .replace(/^\//, '')
    .split('/')
    .map((seg, i) => (i === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)));
  return method.toLowerCase() + parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

// ---------------------------------------------------------------------------
// Parse a Postman URL string into { serverVar, path }
// "{{SAI_SF_GATEWAY}}/v1/common/master/getState"
//   → { serverVar: 'SAI_SF_GATEWAY', path: '/v1/common/master/getState' }
// ---------------------------------------------------------------------------
function parsePostmanUrl(url) {
  if (!url) return { serverVar: null, path: '/' };

  // Handle both string and Postman URL object format
  const raw = typeof url === 'object' ? (url.raw || '') : url;

  const match = raw.match(/^\{\{([^}]+)\}\}(\/.*)?$/);
  if (match) {
    return { serverVar: match[1], path: match[2] || '/' };
  }

  // Absolute URL — extract path
  try {
    const u = new URL(raw);
    return { serverVar: null, path: u.pathname || '/' };
  } catch {
    return { serverVar: null, path: raw.startsWith('/') ? raw : `/${raw}` };
  }
}

// ---------------------------------------------------------------------------
// Convert Postman header array to OpenAPI parameters
// Only include headers that are actual API parameters (not auth tokens)
// ---------------------------------------------------------------------------
function headersToParameters(headers) {
  if (!Array.isArray(headers)) return [];
  return headers
    .filter((h) => !h.disabled && h.key && !NOISY_HEADER_KEYS.has(h.key.toLowerCase()))
    .map((h) => ({
      name: h.key,
      in: 'header',
      schema: { type: 'string' },
      ...(h.value && !h.value.startsWith('{{') ? { example: h.value } : {}),
    }));
}

// ---------------------------------------------------------------------------
// Convert Postman body to OpenAPI requestBody structure
// Returns { mediaType, schema, exampleValue } or null
// ---------------------------------------------------------------------------
function parseBody(body) {
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
    const properties = {};
    for (const field of (body.formdata || [])) {
      if (field.disabled) continue;
      if (field.type === 'file') {
        properties[field.key] = { type: 'string', format: 'binary' };
      } else {
        properties[field.key] = { type: 'string' };
      }
    }
    return {
      mediaType: 'multipart/form-data',
      schema: { type: 'object', properties },
      exampleValue: undefined, // binary data — no meaningful example
    };
  }

  if (body.mode === 'urlencoded') {
    const properties = {};
    for (const field of (body.urlencoded || [])) {
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
// Detect the Content-Type from a Postman response header array
// ---------------------------------------------------------------------------
function getContentType(headers) {
  if (!Array.isArray(headers)) return 'application/json';
  const ct = headers.find((h) => h.key?.toLowerCase() === 'content-type');
  if (!ct) return 'application/json';
  return ct.value.split(';')[0].trim();
}

// ---------------------------------------------------------------------------
// Flatten all Postman items recursively, tracking folder tags
// ---------------------------------------------------------------------------
function flattenItems(items, tags = []) {
  const result = [];
  for (const item of (items || [])) {
    if (item.item) {
      // This is a folder — recurse with folder name added to tags
      result.push(...flattenItems(item.item, [...tags, item.name]));
    } else {
      result.push({ ...item, _tags: tags });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Build a safe example key from a response name
// ---------------------------------------------------------------------------
function toExampleKey(name, index) {
  const key = (name || `example_${index}`)
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return key || `example_${index}`;
}

// ---------------------------------------------------------------------------
// Main converter: Postman Collection → OpenAPI 3.0.3
// ---------------------------------------------------------------------------
function convertCollection(collection) {
  const info = collection.info || {};

  // Collect all server variables
  const allItems = flattenItems(collection.item);
  const serverVarSet = new Set();
  for (const item of allItems) {
    const { serverVar } = parsePostmanUrl(item.request?.url);
    if (serverVar) serverVarSet.add(serverVar);
  }

  const servers = serverVarSet.size > 0
    ? [...serverVarSet].map((v) => ({
        url: '/',
        description: `${v} — set this URL in your environment`,
        'x-postman-variable': `{{${v}}}`,
      }))
    : [{ url: '/' }];

  // Group items by (serverVar + path + method) → one operation each
  // Multiple items can map to the same path (e.g. COMMON and GATEWAY folders),
  // so we use path as the key and merge tags.
  const pathMap = new Map(); // key: `METHOD path` → operation builder object

  for (const item of allItems) {
    const req = item.request;
    if (!req) continue;

    const method = (req.method || 'POST').toLowerCase();
    const { serverVar, path } = parsePostmanUrl(req.url);
    const mapKey = `${method.toUpperCase()} ${path}`;

    if (!pathMap.has(mapKey)) {
      pathMap.set(mapKey, {
        method,
        path,
        serverVar,
        tags: [...item._tags],
        summary: item.name,
        parameters: headersToParameters(req.header),
        mainBody: parseBody(req.body),
        responses: [], // structured response objects
      });
    } else {
      // Merge tags from duplicate path entries
      const existing = pathMap.get(mapKey);
      for (const t of item._tags) {
        if (!existing.tags.includes(t)) existing.tags.push(t);
      }
    }

    const op = pathMap.get(mapKey);

    // Process each saved response
    for (let i = 0; i < (item.response || []).length; i++) {
      const resp = item.response[i];
      const exKey = toExampleKey(resp.name, i);

      // Parse the originalRequest body (the correlated request for this response)
      const origBody = parseBody(resp.originalRequest?.body);
      const origHeaders = resp.originalRequest?.header || [];

      // Parse the response body
      const contentType = getContentType(resp.header);
      const respBodyParsed = tryParseJSON(resp.body);

      op.responses.push({
        exKey,
        name: resp.name,
        code: String(resp.code || 200),
        contentType: contentType.startsWith('application/json') ? 'application/json' : contentType,
        reqExampleValue: origBody?.exampleValue,
        reqMediaType: origBody?.mediaType,
        respExampleValue: respBodyParsed,
        origHeaders: origHeaders,
      });
    }
  }

  // Build OpenAPI paths
  const paths = {};

  for (const [, op] of pathMap) {
    if (!paths[op.path]) paths[op.path] = {};

    // Group saved responses by status code
    const responsesByCode = {};
    for (const r of op.responses) {
      if (!responsesByCode[r.code]) responsesByCode[r.code] = [];
      responsesByCode[r.code].push(r);
    }

    // --- Build request body ---
    let requestBody = undefined;
    if (op.mainBody || op.responses.length > 0) {
      const mediaType = op.mainBody?.mediaType
        || op.responses.find((r) => r.reqMediaType)?.reqMediaType
        || 'application/json';

      // Collect all request example values (from correlated originalRequests)
      const reqExamples = op.responses
        .filter((r) => r.reqExampleValue !== undefined)
        .map((r) => ({ key: r.exKey, value: r.reqExampleValue }));

      // Infer schema from all known request payloads
      const allReqPayloads = [
        ...(op.mainBody?.exampleValue !== undefined ? [op.mainBody.exampleValue] : []),
        ...reqExamples.map((e) => e.value),
      ];
      const reqSchema = allReqPayloads.length > 0
        ? mergeSchemas(allReqPayloads.map(inferSchema))
        : (op.mainBody?.schema || {});

      // Build the media type object
      const mediaObj = { schema: reqSchema };

      if (reqExamples.length > 1) {
        // Multiple distinct examples → named examples (correlated with responses)
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
    const builtResponses = {};

    if (Object.keys(responsesByCode).length === 0) {
      builtResponses['200'] = { description: '' };
    }

    for (const [code, resps] of Object.entries(responsesByCode)) {
      const description = [...new Set(resps.map((r) => r.name))].join(' / ');
      const contentType = resps[0].contentType;

      const respExamples = resps.filter((r) => r.respExampleValue !== undefined);
      const allRespPayloads = respExamples.map((r) => r.respExampleValue);
      const respSchema = allRespPayloads.length > 0
        ? mergeSchemas(allRespPayloads.map(inferSchema))
        : {};

      const mediaObj = { schema: respSchema };

      if (respExamples.length > 1) {
        // Named examples — same keys as the request examples for correlation
        mediaObj.examples = {};
        for (const r of respExamples) {
          mediaObj.examples[r.exKey] = { value: r.respExampleValue };
        }
      } else if (respExamples.length === 1) {
        mediaObj.example = respExamples[0].respExampleValue;
      }

      const responseObj = { description };
      if (Object.keys(respSchema).length > 0 || respExamples.length > 0) {
        responseObj.content = { [contentType]: mediaObj };
      }

      builtResponses[code] = responseObj;
    }

    // --- Build parameters (deduplicate by name+in) ---
    const paramMap = new Map();
    for (const p of op.parameters) {
      paramMap.set(`${p.in}:${p.name}`, p);
    }
    const parameters = [...paramMap.values()];

    // --- Assemble operation ---
    const operation = {
      tags: op.tags.filter((t) => t !== 'COMMON' && t !== 'GATEWAY').length > 0
        ? op.tags
        : op.tags,
      summary: op.summary,
      operationId: toOperationId(op.method, op.path),
    };

    if (parameters.length > 0) operation.parameters = parameters;
    if (requestBody) operation.requestBody = requestBody;
    operation.responses = builtResponses;

    paths[op.path][op.method] = operation;
  }

  // Build deduplicated tags from folder structure
  const tagSet = new Map();
  for (const item of allItems) {
    for (const tag of item._tags) {
      if (!tagSet.has(tag)) tagSet.set(tag, { name: tag });
    }
  }

  const openapi = {
    openapi: '3.0.3',
    info: {
      title: info.name || 'API',
      version: '1.0.0',
    },
    servers,
    paths,
    tags: [...tagSet.values()],
  };

  return openapi;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    'Usage: node collection-to-openapi.js <collection.json> [output.json]\n' +
    '       node collection-to-openapi.js postman-collection.json',
  );
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] || inputFile.replace(/(\.[^.]+)$/, '.openapi$1');

let raw;
try {
  raw = fs.readFileSync(inputFile, 'utf-8');
} catch (err) {
  console.error(`Cannot read "${inputFile}": ${err.message}`);
  process.exit(1);
}

let collection;
try {
  collection = JSON.parse(raw);
} catch (err) {
  console.error(`Invalid JSON in "${inputFile}": ${err.message}`);
  process.exit(1);
}

const openapi = convertCollection(collection);
const outputRaw = JSON.stringify(openapi, null, 2);

try {
  fs.writeFileSync(outputFile, outputRaw);
} catch (err) {
  console.error(`Cannot write "${outputFile}": ${err.message}`);
  process.exit(1);
}

const inputKB = (Buffer.byteLength(raw, 'utf-8') / 1024).toFixed(1);
const outputKB = (Buffer.byteLength(outputRaw, 'utf-8') / 1024).toFixed(1);

console.log('Postman Collection → OpenAPI Converter');
console.log(`  Input  : ${inputFile} (${inputKB} KB)`);
console.log(`  Output : ${outputFile} (${outputKB} KB)`);
console.log('Done.');
