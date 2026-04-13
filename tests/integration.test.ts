import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { normalize } from '../src/normalizer';
import { convertCollection } from '../src/converter';
import type { OpenAPIDocument } from '../src/types';
import { HTTP_METHODS } from '../src/types';
import type { PostmanCollection } from '../src/types';

const ROOT = path.resolve(__dirname, '..');
const OPENAPI_FIXTURE = path.join(ROOT, 'openapi-example.json');
const COLLECTION_FIXTURE = path.join(ROOT, 'postman-collection.json');

// ---------------------------------------------------------------------------
// Helpers to validate OpenAPI structural correctness
// ---------------------------------------------------------------------------

function assertValidOpenAPI(doc: OpenAPIDocument, label: string) {
  // Required top-level fields
  expect(doc.openapi, `${label}: missing openapi version`).toMatch(/^3\.0\./);
  expect(doc.info, `${label}: missing info`).toBeDefined();
  expect(doc.info.title, `${label}: missing info.title`).toBeTruthy();
  expect(doc.info.version, `${label}: missing info.version`).toBeTruthy();

  // Paths
  expect(doc.paths, `${label}: missing paths`).toBeDefined();

  for (const [pathStr, pathItem] of Object.entries(doc.paths!)) {
    expect(pathStr, `${label}: path must start with /`).toMatch(/^\//);

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      // Every operation should have responses
      expect(
        operation.responses,
        `${label}: ${method.toUpperCase()} ${pathStr} missing responses`,
      ).toBeDefined();

      for (const [code, response] of Object.entries(operation.responses!)) {
        // Status code should be a valid HTTP code or 'default'
        expect(
          code === 'default' || /^[1-5]\d{2}$/.test(code),
          `${label}: invalid status code "${code}" at ${method.toUpperCase()} ${pathStr}`,
        ).toBe(true);

        // Response must have description
        expect(
          typeof response.description,
          `${label}: response ${code} at ${method.toUpperCase()} ${pathStr} missing description`,
        ).toBe('string');

        // If content exists, media types should be valid
        if (response.content) {
          for (const [mediaType, mediaObj] of Object.entries(response.content)) {
            expect(
              mediaType,
              `${label}: empty media type at ${method.toUpperCase()} ${pathStr} ${code}`,
            ).toBeTruthy();

            // Schema or example should exist if content is present
            expect(
              mediaObj.schema || mediaObj.example !== undefined || mediaObj.examples,
              `${label}: content at ${method.toUpperCase()} ${pathStr} ${code} ${mediaType} has no schema/example`,
            ).toBeTruthy();
          }
        }
      }

      // If parameters exist, validate structure
      if (operation.parameters) {
        for (const param of operation.parameters) {
          expect(param.name, `${label}: parameter missing name`).toBeTruthy();
          expect(
            ['query', 'header', 'path', 'cookie'],
            `${label}: invalid param.in "${param.in}"`,
          ).toContain(param.in);
        }
      }

      // If requestBody exists, validate content
      if (operation.requestBody) {
        expect(
          operation.requestBody.content,
          `${label}: requestBody missing content`,
        ).toBeDefined();
        expect(
          Object.keys(operation.requestBody.content).length,
          `${label}: requestBody has empty content`,
        ).toBeGreaterThan(0);
      }
    }
  }

  // Tags should be unique
  if (doc.tags) {
    const tagNames = doc.tags.map((t) => t.name);
    expect(
      new Set(tagNames).size,
      `${label}: duplicate tags found`,
    ).toBe(tagNames.length);
  }

  // Servers should have url
  if (doc.servers) {
    for (const server of doc.servers) {
      expect(server.url, `${label}: server missing url`).toBeTruthy();
    }
  }
}

// ---------------------------------------------------------------------------
// Integration: Normalizer
// ---------------------------------------------------------------------------

describe('integration: normalize', () => {
  const hasFixture = fs.existsSync(OPENAPI_FIXTURE);

  it.skipIf(!hasFixture)('normalizes the real OpenAPI fixture into valid output', () => {
    const raw = JSON.parse(fs.readFileSync(OPENAPI_FIXTURE, 'utf-8')) as OpenAPIDocument;
    const result = normalize(raw);

    assertValidOpenAPI(result, 'normalize');
  });

  it.skipIf(!hasFixture)('reduces file size significantly', () => {
    const rawStr = fs.readFileSync(OPENAPI_FIXTURE, 'utf-8');
    const raw = JSON.parse(rawStr) as OpenAPIDocument;
    const result = normalize(raw);

    const inputSize = Buffer.byteLength(rawStr);
    const outputSize = Buffer.byteLength(JSON.stringify(result, null, 2));

    // Normalized output should be at least 40% smaller
    expect(outputSize).toBeLessThan(inputSize * 0.6);
  });

  it.skipIf(!hasFixture)('removes noisy headers from all responses', () => {
    const raw = JSON.parse(fs.readFileSync(OPENAPI_FIXTURE, 'utf-8')) as OpenAPIDocument;
    const result = normalize(raw);

    const noisyNames = new Set([
      'X-Request-Id', 'Content-Length', 'Connection', 'Date',
      'Set-Cookie', 'Transfer-Encoding', 'Server',
    ]);

    for (const pathItem of Object.values(result.paths!)) {
      for (const method of HTTP_METHODS) {
        const op = pathItem[method];
        if (!op?.responses) continue;
        for (const resp of Object.values(op.responses)) {
          if (!resp.headers) continue;
          for (const headerName of Object.keys(resp.headers)) {
            expect(
              noisyNames.has(headerName),
              `noisy header "${headerName}" was not stripped`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it.skipIf(!hasFixture)('collapses all named examples to single example', () => {
    const raw = JSON.parse(fs.readFileSync(OPENAPI_FIXTURE, 'utf-8')) as OpenAPIDocument;
    const result = normalize(raw);

    for (const pathItem of Object.values(result.paths!)) {
      for (const method of HTTP_METHODS) {
        const op = pathItem[method];
        if (!op?.responses) continue;
        for (const resp of Object.values(op.responses)) {
          if (!resp.content) continue;
          for (const mediaObj of Object.values(resp.content)) {
            expect(
              mediaObj.examples,
              'named examples should be collapsed',
            ).toBeUndefined();
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: Converter
// ---------------------------------------------------------------------------

describe('integration: convertCollection', () => {
  const hasFixture = fs.existsSync(COLLECTION_FIXTURE);

  it.skipIf(!hasFixture)('converts the real Postman collection into valid OpenAPI', () => {
    const raw = JSON.parse(fs.readFileSync(COLLECTION_FIXTURE, 'utf-8')) as PostmanCollection;
    const result = convertCollection(raw);

    assertValidOpenAPI(result, 'convert');
  });

  it.skipIf(!hasFixture)('produces non-empty paths from collection', () => {
    const raw = JSON.parse(fs.readFileSync(COLLECTION_FIXTURE, 'utf-8')) as PostmanCollection;
    const result = convertCollection(raw);

    expect(Object.keys(result.paths!).length).toBeGreaterThan(0);
  });

  it.skipIf(!hasFixture)('generates unique operationIds across all operations', () => {
    const raw = JSON.parse(fs.readFileSync(COLLECTION_FIXTURE, 'utf-8')) as PostmanCollection;
    const result = convertCollection(raw);

    const operationIds: string[] = [];
    for (const pathItem of Object.values(result.paths!)) {
      for (const method of HTTP_METHODS) {
        const op = pathItem[method];
        if (op?.operationId) operationIds.push(op.operationId);
      }
    }

    expect(new Set(operationIds).size, 'duplicate operationIds').toBe(operationIds.length);
  });

  it.skipIf(!hasFixture)('correlates request and response example keys', () => {
    const raw = JSON.parse(fs.readFileSync(COLLECTION_FIXTURE, 'utf-8')) as PostmanCollection;
    const result = convertCollection(raw);

    let correlatedCount = 0;

    for (const pathItem of Object.values(result.paths!)) {
      for (const method of HTTP_METHODS) {
        const op = pathItem[method];
        if (!op?.requestBody?.content || !op?.responses) continue;

        for (const reqMedia of Object.values(op.requestBody.content)) {
          if (!reqMedia.examples) continue;
          const reqKeys = new Set(Object.keys(reqMedia.examples));

          for (const resp of Object.values(op.responses)) {
            if (!resp.content) continue;
            for (const respMedia of Object.values(resp.content)) {
              if (!respMedia.examples) continue;
              const respKeys = Object.keys(respMedia.examples);

              for (const key of respKeys) {
                if (reqKeys.has(key)) correlatedCount++;
              }
            }
          }
        }
      }
    }

    // Should have at least some correlated examples
    expect(correlatedCount, 'no correlated request/response examples found').toBeGreaterThan(0);
  });

  it.skipIf(!hasFixture)('infers schemas for responses with body data', () => {
    const raw = JSON.parse(fs.readFileSync(COLLECTION_FIXTURE, 'utf-8')) as PostmanCollection;
    const result = convertCollection(raw);

    let schemasFound = 0;
    for (const pathItem of Object.values(result.paths!)) {
      for (const method of HTTP_METHODS) {
        const op = pathItem[method];
        if (!op?.responses) continue;
        for (const resp of Object.values(op.responses)) {
          if (!resp.content) continue;
          for (const mediaObj of Object.values(resp.content)) {
            if (mediaObj.schema && Object.keys(mediaObj.schema).length > 0) {
              schemasFound++;
            }
          }
        }
      }
    }

    expect(schemasFound, 'no schemas inferred from response bodies').toBeGreaterThan(0);
  });
});
