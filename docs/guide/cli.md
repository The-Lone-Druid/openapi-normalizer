# CLI

The CLI provides two commands: `normalize` and `convert`.

## Installation

```sh
# Global install
npm install -g openapi-normalizer

# Or use directly with npx
npx openapi-normalizer --help
```

## Commands

### `normalize`

Normalize a Postman-exported OpenAPI file.

```sh
openapi-normalizer normalize <input.json> [output.json]
```

If no output path is given, writes to `<input>.normalized.json`.

**Example:**
```sh
$ openapi-normalizer normalize api-export.json

✓ Normalized → api-export.normalized.json  (4470 KB → 1647 KB)
```

### `convert`

Convert a Postman Collection to OpenAPI.

```sh
openapi-normalizer convert <collection.json> [output.json]
```

If no output path is given, writes to `<input>.openapi.json`.

**Example:**
```sh
$ openapi-normalizer convert postman-collection.json api.json

✓ Converted → api.json  (2301 KB → 1894 KB)
```

## Options

| Flag | Description |
|---|---|
| `-h`, `--help` | Show help message |
| `-v`, `--version` | Show version number |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Invalid arguments, file not found, or JSON parse error |
