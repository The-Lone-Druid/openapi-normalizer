---
layout: home

hero:
  name: OpenAPI Normalizer
  text: Postman Collections → Clean OpenAPI 3.x
  tagline: Convert Postman Collections and normalize bloated Postman-exported specs into clean, standard-compliant OpenAPI — ready for Swagger UI, Redocly, Stoplight, and any API client generator.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/The-Lone-Druid/openapi-normalizer

features:
  - icon: 🔄
    title: Convert Postman Collections
    details: Turn any Postman Collection (v2.0/v2.1) into an OpenAPI 3.0.3 document with correlated request/response examples — something Postman's own export never does.
  - icon: 🧹
    title: Normalize Exported Specs
    details: Strip noisy headers, collapse redundant examples, infer and merge schemas from example values, and reduce file size by 60%+ on typical Postman exports.
  - icon: 🚀
    title: Git-Versioned API Workflow
    details: Commit your Postman Collection to git, run a single script to generate a normalized OpenAPI spec, and feed it into any code generator for web, mobile, or desktop clients.
  - icon: ⌨️
    title: CLI & Programmatic API
    details: Use from the command line or import as a library in any Node.js project. Chain convert + normalize in one pipeline.
  - icon: 📦
    title: TypeScript-first, Zero Dependencies
    details: Full type definitions for OpenAPI and Postman types. Dual CJS/ESM package with absolutely no runtime dependencies.
---
