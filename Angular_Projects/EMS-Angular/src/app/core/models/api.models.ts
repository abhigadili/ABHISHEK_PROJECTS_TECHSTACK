/** Envelope returned by every successful Express endpoint. */
export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: PageMeta;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface ValidationDetail {
  field: string;
  message: string;
  location?: string;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ValidationDetail[];
    requestId?: string;
  };
}

/** Normalised error surfaced to the UI by the error interceptor. */
export interface AppError {
  status: number;
  code: string;
  message: string;
  details: ValidationDetail[];
  requestId?: string;
}

export type SortDirection = 'asc' | 'desc';
export type QueryParams = Record<string, string | number | boolean | null | undefined>;
