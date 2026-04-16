#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { normalize } from './normalizer';
import { convertCollection } from './converter';
import type { OpenAPIDocument, NormalizeOptions, ConvertOptions } from './types';
import type { PostmanCollection } from './types';

function usage(): never {
  console.error(`openapi-normalizer — Normalize & convert OpenAPI / Postman files

Commands:
  normalize <input.json> [output.json]   Normalize a Postman-exported OpenAPI file
  convert   <collection.json> [output.json]  Convert a Postman Collection to OpenAPI

Normalize options:
  --preserve-headers <h1,h2>  Keep specific noisy headers
  --additional-noisy-headers <h1,h2>  Add extra headers to strip
  --strip-x-extensions        Remove all x-* vendor extensions
  --keep-examples             Keep named examples (don't collapse)
  --no-infer-schemas          Disable schema inference from examples

Convert options:
  --infer-required            Mark properties in all examples as required
  --infer-formats             Detect string formats (uuid, date-time, email, ...)
  --no-tags                   Don't generate tags from folder names
  --operation-id-style <s>    camelCase (default), snake_case, or kebab-case
  --default-content-type <t>  Override fallback Content-Type

General options:
  -h, --help     Show this help message
  -v, --version  Show version number

Examples:
  openapi-normalizer normalize openapi-example.json
  openapi-normalizer convert postman-collection.json api.json
  openapi-normalizer convert collection.json --infer-required --infer-formats
  openapi-normalizer normalize api.json --strip-x-extensions`);
  process.exit(1);
}

function readJSON<T>(filePath: string): T {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
  return JSON.parse(raw) as T;
}

function writeJSON(filePath: string, data: unknown): void {
  const output = JSON.stringify(data, null, 2);
  fs.writeFileSync(path.resolve(filePath), output);
}

function defaultOutput(inputFile: string, suffix: string): string {
  const ext = path.extname(inputFile);
  const base = path.basename(inputFile, ext);
  return path.join(path.dirname(inputFile), `${base}.${suffix}${ext}`);
}

function getFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function parseNormalizeOptions(args: string[]): NormalizeOptions {
  const opts: NormalizeOptions = {};

  const preserveHeaders = getFlagValue(args, '--preserve-headers');
  if (preserveHeaders) {
    opts.preserveHeaders = preserveHeaders.split(',').map((h) => h.trim());
  }

  const additionalNoisy = getFlagValue(args, '--additional-noisy-headers');
  if (additionalNoisy) {
    opts.additionalNoisyHeaders = additionalNoisy.split(',').map((h) => h.trim());
  }

  if (getFlag(args, '--strip-x-extensions')) opts.stripXExtensions = true;
  if (getFlag(args, '--keep-examples')) opts.keepExamples = true;
  if (getFlag(args, '--no-infer-schemas')) opts.inferSchemas = false;

  return opts;
}

function parseConvertOptions(args: string[]): ConvertOptions {
  const opts: ConvertOptions = {};

  if (getFlag(args, '--infer-required')) opts.inferRequired = true;
  if (getFlag(args, '--infer-formats')) opts.inferFormats = true;
  if (getFlag(args, '--no-tags')) opts.tagFromFolder = false;

  const style = getFlagValue(args, '--operation-id-style');
  if (style === 'camelCase' || style === 'snake_case' || style === 'kebab-case') {
    opts.operationIdStyle = style;
  }

  const contentType = getFlagValue(args, '--default-content-type');
  if (contentType) opts.defaultContentType = contentType;

  return opts;
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  usage();
}

if (args.includes('-v') || args.includes('--version')) {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
  console.log(pkg.version);
  process.exit(0);
}

const command = args[0];
const inputFile = args[1];

// Find output file: first positional arg after input that doesn't start with --
const outputFile = args[2] && !args[2].startsWith('--') ? args[2] : undefined;

if (!inputFile) {
  console.error(`Error: missing <input> argument for "${command}"`);
  usage();
}

if (command === 'normalize') {
  const openapi = readJSON<OpenAPIDocument>(inputFile);
  const opts = parseNormalizeOptions(args);
  const result = normalize(openapi, opts);
  const out = outputFile ?? defaultOutput(inputFile, 'normalized');
  writeJSON(out, result);

  const inSize = (fs.statSync(path.resolve(inputFile)).size / 1024).toFixed(0);
  const outSize = (Buffer.byteLength(JSON.stringify(result, null, 2)) / 1024).toFixed(0);
  console.log(`✓ Normalized → ${out}  (${inSize} KB → ${outSize} KB)`);
} else if (command === 'convert') {
  const collection = readJSON<PostmanCollection>(inputFile);
  const opts = parseConvertOptions(args);
  const result = convertCollection(collection, opts);
  const out = outputFile ?? defaultOutput(inputFile, 'openapi');
  writeJSON(out, result);

  const inSize = (fs.statSync(path.resolve(inputFile)).size / 1024).toFixed(0);
  const outSize = (Buffer.byteLength(JSON.stringify(result, null, 2)) / 1024).toFixed(0);
  console.log(`✓ Converted → ${out}  (${inSize} KB → ${outSize} KB)`);
} else {
  console.error(`Unknown command: "${command}"`);
  usage();
}
