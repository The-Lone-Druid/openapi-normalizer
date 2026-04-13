#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { normalize } from './normalizer';
import { convertCollection } from './converter';
import type { OpenAPIDocument } from './types';
import type { PostmanCollection } from './types';

function usage(): never {
  console.error(`openapi-normalizer — Normalize & convert OpenAPI / Postman files

Commands:
  normalize <input.json> [output.json]   Normalize a Postman-exported OpenAPI file
  convert   <collection.json> [output.json]  Convert a Postman Collection to OpenAPI

Options:
  -h, --help     Show this help message
  -v, --version  Show version number

Examples:
  openapi-normalizer normalize openapi-example.json
  openapi-normalizer convert postman-collection.json api.json`);
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

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  usage();
}

if (args.includes('-v') || args.includes('--version')) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'),
  );
  console.log(pkg.version);
  process.exit(0);
}

const command = args[0];
const inputFile = args[1];
const outputFile = args[2];

if (!inputFile) {
  console.error(`Error: missing <input> argument for "${command}"`);
  usage();
}

if (command === 'normalize') {
  const openapi = readJSON<OpenAPIDocument>(inputFile);
  const result = normalize(openapi);
  const out = outputFile ?? defaultOutput(inputFile, 'normalized');
  writeJSON(out, result);

  const inSize = (fs.statSync(path.resolve(inputFile)).size / 1024).toFixed(0);
  const outSize = (Buffer.byteLength(JSON.stringify(result, null, 2)) / 1024).toFixed(0);
  console.log(`✓ Normalized → ${out}  (${inSize} KB → ${outSize} KB)`);
} else if (command === 'convert') {
  const collection = readJSON<PostmanCollection>(inputFile);
  const result = convertCollection(collection);
  const out = outputFile ?? defaultOutput(inputFile, 'openapi');
  writeJSON(out, result);

  const inSize = (fs.statSync(path.resolve(inputFile)).size / 1024).toFixed(0);
  const outSize = (Buffer.byteLength(JSON.stringify(result, null, 2)) / 1024).toFixed(0);
  console.log(`✓ Converted → ${out}  (${inSize} KB → ${outSize} KB)`);
} else {
  console.error(`Unknown command: "${command}"`);
  usage();
}
