import { describe, it, expect } from 'vitest';
import { inferSchema, mergeSchemas, stripPropertyExamples } from '../src/schema';
import type { JSONSchema } from '../src/types';

describe('inferSchema', () => {
  it('infers null as nullable', () => {
    expect(inferSchema(null)).toEqual({ nullable: true });
  });

  it('infers string type', () => {
    expect(inferSchema('hello')).toEqual({ type: 'string' });
  });

  it('infers integer type', () => {
    expect(inferSchema(42)).toEqual({ type: 'integer' });
  });

  it('infers number type for floats', () => {
    expect(inferSchema(3.14)).toEqual({ type: 'number' });
  });

  it('infers boolean type', () => {
    expect(inferSchema(true)).toEqual({ type: 'boolean' });
  });

  it('infers empty array', () => {
    expect(inferSchema([])).toEqual({ type: 'array', items: {} });
  });

  it('infers array of strings', () => {
    expect(inferSchema(['a', 'b'])).toEqual({
      type: 'array',
      items: { type: 'string' },
    });
  });

  it('infers object with nested properties', () => {
    const result = inferSchema({ name: 'test', count: 5, active: true });
    expect(result).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'integer' },
        active: { type: 'boolean' },
      },
    });
  });

  it('infers nested objects and arrays', () => {
    const result = inferSchema({ items: [{ id: 1 }] });
    expect(result).toEqual({
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'integer' } },
          },
        },
      },
    });
  });
});

describe('mergeSchemas', () => {
  it('returns empty schema for empty array', () => {
    expect(mergeSchemas([])).toEqual({});
  });

  it('returns single schema unchanged', () => {
    const schema: JSONSchema = { type: 'string' };
    expect(mergeSchemas([schema])).toBe(schema);
  });

  it('merges object schemas by union of properties', () => {
    const a: JSONSchema = { type: 'object', properties: { name: { type: 'string' } } };
    const b: JSONSchema = { type: 'object', properties: { age: { type: 'integer' } } };
    expect(mergeSchemas([a, b])).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    });
  });

  it('merges array schemas by merging items', () => {
    const a: JSONSchema = {
      type: 'array',
      items: { type: 'object', properties: { x: { type: 'integer' } } },
    };
    const b: JSONSchema = {
      type: 'array',
      items: { type: 'object', properties: { y: { type: 'string' } } },
    };
    expect(mergeSchemas([a, b])).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          x: { type: 'integer' },
          y: { type: 'string' },
        },
      },
    });
  });

  it('produces oneOf for mixed types', () => {
    const a: JSONSchema = { type: 'string' };
    const b: JSONSchema = { type: 'integer' };
    expect(mergeSchemas([a, b])).toEqual({ oneOf: [a, b] });
  });

  it('recursively merges overlapping object properties', () => {
    const a: JSONSchema = {
      type: 'object',
      properties: { data: { type: 'object', properties: { id: { type: 'integer' } } } },
    };
    const b: JSONSchema = {
      type: 'object',
      properties: { data: { type: 'object', properties: { name: { type: 'string' } } } },
    };
    expect(mergeSchemas([a, b])).toEqual({
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
          },
        },
      },
    });
  });
});

describe('stripPropertyExamples', () => {
  it('removes top-level example', () => {
    expect(stripPropertyExamples({ type: 'string', example: 'test' })).toEqual({ type: 'string' });
  });

  it('removes examples from nested properties', () => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John' },
        age: { type: 'integer', example: 30 },
      },
    };
    expect(stripPropertyExamples(schema)).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    });
  });

  it('strips examples from array items', () => {
    const schema: JSONSchema = {
      type: 'array',
      items: { type: 'string', example: 'foo' },
    };
    expect(stripPropertyExamples(schema)).toEqual({
      type: 'array',
      items: { type: 'string' },
    });
  });

  it('strips examples from oneOf/anyOf/allOf', () => {
    const schema: JSONSchema = {
      oneOf: [
        { type: 'string', example: 'a' },
        { type: 'integer', example: 1 },
      ],
    };
    expect(stripPropertyExamples(schema)).toEqual({
      oneOf: [{ type: 'string' }, { type: 'integer' }],
    });
  });

  it('preserves non-example fields', () => {
    const schema: JSONSchema = {
      type: 'object',
      nullable: true,
      format: 'date-time',
    };
    expect(stripPropertyExamples(schema)).toEqual(schema);
  });
});
