# Types

All types are exported from the main package entry point.

```ts
import type {
  OpenAPIDocument,
  OpenAPIOperation,
  PostmanCollection,
  JSONSchema,
  // ... etc
} from 'openapi-normalizer';
```

## OpenAPI Types

### `OpenAPIDocument`

```ts
interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths?: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
  tags?: OpenAPITag[];
  security?: OpenAPISecurityRequirement[];
}
```

### `OpenAPIInfo`

```ts
interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  contact?: Record<string, unknown>;
  license?: { name: string; url?: string };
}
```

### `OpenAPIOperation`

```ts
interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  security?: OpenAPISecurityRequirement[];
}
```

### `OpenAPIParameter`

```ts
interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: JSONSchema;
  example?: unknown;
}
```

### `OpenAPIMediaType`

```ts
interface OpenAPIMediaType {
  schema?: JSONSchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
}
```

### `JSONSchema`

```ts
interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  additionalProperties?: JSONSchema | boolean;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  nullable?: boolean;
  example?: unknown;
  format?: string;
  enum?: unknown[];
}
```

## Postman Types

### `PostmanCollection`

```ts
interface PostmanCollection {
  info: PostmanInfo;
  item: PostmanItem[];
  variable?: PostmanVariable[];
}
```

### `PostmanItem`

```ts
// A PostmanItem is either a folder or a request
type PostmanItem = PostmanFolder | PostmanRequest;

interface PostmanFolder {
  name: string;
  item: PostmanItem[];
  description?: string;
}

interface PostmanRequest {
  name: string;
  id?: string;
  request: PostmanRequestDef;
  response: PostmanResponse[];
}
```

### `PostmanResponse`

```ts
interface PostmanResponse {
  id?: string;
  name: string;
  originalRequest?: PostmanRequestDef;
  status?: string;
  code?: number;
  header?: PostmanHeader[];
  body?: string;
}
```

## Utility Types

### `HttpMethod`

```ts
type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';
```
