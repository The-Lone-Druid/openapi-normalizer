import type { JSONSchema } from './types';

// ---------------------------------------------------------------------------
// Format detection patterns
// ---------------------------------------------------------------------------

const FORMAT_PATTERNS: [RegExp, string][] = [
  [/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'uuid'],
  [/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i, 'date-time'],
  [/^\d{4}-\d{2}-\d{2}$/, 'date'],
  [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'email'],
  [/^https?:\/\//i, 'uri'],
  [/^(\d{1,3}\.){3}\d{1,3}$/, 'ipv4'],
  [/^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i, 'ipv6'],
];

/**
 * Detect a JSON Schema `format` from a string value.
 * Returns undefined if no known format matches.
 */
export function inferFormat(value: string): string | undefined {
  for (const [pattern, format] of FORMAT_PATTERNS) {
    if (pattern.test(value)) return format;
  }
  return undefined;
}

/**
 * Determine which property names appear in ALL provided example objects.
 * Only considers top-level keys of plain objects; non-object values are ignored.
 */
export function inferRequired(examples: unknown[]): string[] {
  const objects = examples.filter(
    (v): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v),
  );
  if (objects.length < 2) return [];

  const firstKeys = Object.keys(objects[0]);
  return firstKeys.filter((key) => objects.every((obj) => key in obj));
}

// ---------------------------------------------------------------------------
// Schema inference options
// ---------------------------------------------------------------------------

export interface InferSchemaOptions {
  /** Detect string formats (uuid, date-time, email, etc.) */
  detectFormats?: boolean;
}

/**
 * Infer a JSON Schema from a runtime JSON value.
 * Used when Postman exports only example data without a schema.
 */
export function inferSchema(value: unknown, options?: InferSchemaOptions): JSONSchema {
  if (value === null) return { nullable: true };

  if (Array.isArray(value)) {
    if (value.length === 0) return { type: 'array', items: {} };
    return { type: 'array', items: mergeSchemas(value.map((v) => inferSchema(v, options))) };
  }

  if (typeof value === 'object') {
    const properties: Record<string, JSONSchema> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = inferSchema(v, options);
    }
    return { type: 'object', properties };
  }

  if (typeof value === 'string') {
    if (options?.detectFormats) {
      const format = inferFormat(value);
      if (format) return { type: 'string', format };
    }
    return { type: 'string' };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
  }
  if (typeof value === 'boolean') return { type: 'boolean' };
  return {};
}

/**
 * Deeply merge an array of JSON Schema objects into one representative schema.
 * Objects → union of properties; arrays → merged items; mixed types → oneOf.
 */
export function mergeSchemas(schemas: JSONSchema[]): JSONSchema {
  const filtered = schemas.filter((s) => s && Object.keys(s).length > 0);
  if (filtered.length === 0) return {};
  if (filtered.length === 1) return filtered[0];

  const types = [...new Set(filtered.map((s) => s.type).filter(Boolean))];

  if (types.length === 1 && types[0] === 'object') {
    const allProps: Record<string, JSONSchema> = {};
    for (const schema of filtered) {
      for (const [k, v] of Object.entries(schema.properties ?? {})) {
        allProps[k] = allProps[k] ? mergeSchemas([allProps[k], v]) : v;
      }
    }
    return { type: 'object', properties: allProps };
  }

  if (types.length === 1 && types[0] === 'array') {
    const itemSchemas = filtered.map((s) => s.items).filter(Boolean) as JSONSchema[];
    return { type: 'array', items: mergeSchemas(itemSchemas) };
  }

  if (types.length === 0) return filtered[0];

  // Deduplicate identical schemas before producing oneOf
  const unique: JSONSchema[] = [];
  const seen = new Set<string>();
  for (const s of filtered) {
    const key = JSON.stringify(s);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }
  if (unique.length === 1) return unique[0];

  return { oneOf: unique };
}

/**
 * Recursively strip `example` values from schema property definitions.
 * Per-property examples are redundant when a top-level media-type example exists.
 */
export function stripPropertyExamples(schema: JSONSchema): JSONSchema {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema; // shouldn't happen at top level

  const result: JSONSchema = {};

  for (const [k, v] of Object.entries(schema)) {
    if (k === 'example') continue;

    if (k === 'properties' && v && typeof v === 'object') {
      const cleaned: Record<string, JSONSchema> = {};
      for (const [propName, propSchema] of Object.entries(v as Record<string, JSONSchema>)) {
        cleaned[propName] = stripPropertyExamples(propSchema);
      }
      result[k] = cleaned;
    } else if (k === 'items') {
      result.items =
        typeof v === 'object' && v !== null
          ? stripPropertyExamples(v as JSONSchema)
          : (v as JSONSchema);
    } else if (k === 'additionalProperties') {
      result.additionalProperties =
        typeof v === 'object' && v !== null
          ? stripPropertyExamples(v as JSONSchema)
          : (v as JSONSchema | boolean);
    } else if (k === 'oneOf' || k === 'anyOf' || k === 'allOf') {
      result[k] = (v as JSONSchema[]).map(stripPropertyExamples);
    } else {
      result[k] = v;
    }
  }

  return result;
}
