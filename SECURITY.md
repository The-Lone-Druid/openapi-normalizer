# Security Policy

## Supported Versions

Only the latest published version of `openapi-normalizer` on npm receives security fixes.

| Version        | Supported |
| -------------- | --------- |
| Latest         | ✅        |
| Older releases | ❌        |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately using [GitHub's private vulnerability reporting](https://github.com/The-Lone-Druid/openapi-normalizer/security/advisories/new).

Include as much detail as possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a minimal proof-of-concept
- Affected versions
- Suggested fix if you have one

You can expect an acknowledgement within **72 hours** and a fix or mitigation plan within **14 days** depending on severity.

## Scope

`openapi-normalizer` is a **zero-dependency** library that processes JSON documents in memory. It does not make network requests, access the file system (except through the CLI), or evaluate arbitrary code. Attack surface is limited to:

- Maliciously crafted Postman Collection or OpenAPI JSON input passed to `convertCollection()` or `normalize()`
- CLI path traversal via the `-o` / `--output` flag

If you discover a vulnerability within this scope, please report it as described above.
