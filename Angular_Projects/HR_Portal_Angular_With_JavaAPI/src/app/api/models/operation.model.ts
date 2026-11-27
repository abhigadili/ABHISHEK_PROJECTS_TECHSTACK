export interface SchemaDef {
  type?: string; format?: string; enum?: unknown[]; properties?: Record<string, SchemaDef>; required?: string[];
  items?: SchemaDef; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; minItems?: number; maxItems?: number;
  pattern?: string; additionalProperties?: SchemaDef | boolean; description?: string; default?: unknown; uniqueItems?: boolean; example?: unknown;
}
export interface ParamDef { name: string; required: boolean; schema: SchemaDef }
export interface OperationDef {
  /** `<service>.<fn>` - unique, used by the coverage registry */
  id: string; service: string; fn: string; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; tag: string;
  summary: string; operationId: string; pathParams: string[]; query: ParamDef[]; multipart: boolean;
  bodyType: string | null; bodySchema: SchemaDef | null; responseType: string | null; responseStatus: string | null;
  binary: boolean; public: boolean;
  /** raw @PreAuthorize expression found in the Java controller */
  authorize: string | null;
  /** Java controller class that serves the endpoint */
  controller?: string;
}
