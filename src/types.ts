// ---------------------------------------------------------------------------
// OpenAPI 3.0.x types (subset relevant for normalization)
// ---------------------------------------------------------------------------

export interface OpenAPIDocument {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths?: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
  tags?: OpenAPITag[];
  security?: OpenAPISecurityRequirement[];
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  contact?: Record<string, unknown>;
  license?: { name: string; url?: string };
}

export interface OpenAPIServer {
  url: string;
  description?: string;
  'x-postman-variable'?: string;
}

export interface OpenAPITag {
  name: string;
  description?: string;
}

export type OpenAPIPathItem = {
  [method in HttpMethod]?: OpenAPIOperation;
} & {
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
};

export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  security?: OpenAPISecurityRequirement[];
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: JSONSchema;
  example?: unknown;
}

export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIResponse {
  description: string;
  headers?: Record<string, OpenAPIHeader>;
  content?: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIHeader {
  description?: string;
  schema?: JSONSchema;
  example?: unknown;
}

export interface OpenAPIMediaType {
  schema?: JSONSchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
}

export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value?: unknown;
}

export interface OpenAPIComponents {
  schemas?: Record<string, JSONSchema>;
  securitySchemes?: Record<string, unknown>;
  [key: string]: unknown;
}

export type OpenAPISecurityRequirement = Record<string, string[]>;

export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

export const HTTP_METHODS: HttpMethod[] = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
];

// ---------------------------------------------------------------------------
// JSON Schema types (subset used for inference)
// ---------------------------------------------------------------------------

export interface JSONSchema {
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
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Postman Collection v2.0/v2.1 types
// ---------------------------------------------------------------------------

export interface PostmanCollection {
  info: PostmanInfo;
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

export interface PostmanInfo {
  _postman_id?: string;
  name: string;
  schema: string;
  description?: string;
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
}

export type PostmanItem = PostmanFolder | PostmanRequest;

export interface PostmanFolder {
  name: string;
  item: PostmanItem[];
  description?: string;
}

export interface PostmanRequest {
  name: string;
  id?: string;
  request: PostmanRequestDef;
  response: PostmanResponse[];
  protocolProfileBehavior?: Record<string, unknown>;
}

export interface PostmanRequestDef {
  method: string;
  header: PostmanHeader[];
  body?: PostmanBody;
  url: string | PostmanUrl;
  auth?: PostmanAuth;
  description?: string;
}

export interface PostmanUrl {
  raw?: string;
  host?: string[];
  path?: string[];
  protocol?: string;
  query?: PostmanQueryParam[];
}

export interface PostmanQueryParam {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface PostmanHeader {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanBody {
  mode: 'raw' | 'formdata' | 'urlencoded' | 'file' | 'graphql' | 'none';
  raw?: string;
  formdata?: PostmanFormDataField[];
  urlencoded?: PostmanUrlencodedField[];
  options?: {
    raw?: { language?: string };
  };
}

export interface PostmanFormDataField {
  key: string;
  value?: string;
  type: 'text' | 'file';
  src?: string;
  disabled?: boolean;
  uuid?: string;
}

export interface PostmanUrlencodedField {
  key: string;
  value?: string;
  disabled?: boolean;
}

export interface PostmanAuth {
  type: string;
  [key: string]: unknown;
}

export interface PostmanResponse {
  id?: string;
  name: string;
  originalRequest?: PostmanRequestDef;
  status?: string;
  code?: number;
  header?: PostmanHeader[];
  body?: string;
  cookie?: unknown[];
  responseTime?: number | null;
  _postman_previewlanguage?: string | null;
}

// ---------------------------------------------------------------------------
// Guard functions
// ---------------------------------------------------------------------------

export function isPostmanFolder(item: PostmanItem): item is PostmanFolder {
  return 'item' in item && Array.isArray((item as PostmanFolder).item);
}

export function isPostmanRequest(item: PostmanItem): item is PostmanRequest {
  return 'request' in item;
}
