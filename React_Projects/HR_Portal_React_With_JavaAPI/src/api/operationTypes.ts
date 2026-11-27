export interface SchemaDef {
  type?: string;
  format?: string;
  enum?: unknown[];
  properties?: Record<string, SchemaDef>;
  required?: string[];
  items?: SchemaDef;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  additionalProperties?: SchemaDef | boolean;
  description?: string;
  default?: unknown;
  uniqueItems?: boolean;
  example?: unknown;
}
export interface ParamDef { name: string; required: boolean; schema: SchemaDef }
export interface OperationDef {
  id: string;            // "<service>.<fn>" - unique, used by the coverage registry
  service: string;
  fn: string;            // function name in <service>Api
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  tag: string;
  summary: string;
  operationId: string;
  pathParams: string[];
  query: ParamDef[];
  multipart: boolean;
  bodyType: string | null;
  bodySchema: SchemaDef | null;
  responseType: string | null;
  responseStatus: string | null;
  binary: boolean;
  public: boolean;
  authorize: string | null; // raw @PreAuthorize expression found in the Java controller
}
