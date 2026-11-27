import type { ApiErrorBody } from '@/types';

/** One error type for the whole app (server fetch, Axios, Server Actions, Route Handlers). */
export class ApiError extends Error {
  status: number;
  details: string[];
  fieldErrors: Record<string, string>;
  isNetworkError: boolean;
  constructor(status: number, message: string, details: string[] = [], isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.isNetworkError = isNetworkError;
    this.fieldErrors = ApiError.parseDetails(details);
  }
  /** Backend validation details look like "email: must be a well-formed email address". */
  static parseDetails(details: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of details) {
      const i = d.indexOf(':');
      if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    return out;
  }
  static fromBody(status: number, body: Partial<ApiErrorBody> | null): ApiError {
    return new ApiError(status, body?.message || `Request failed (${status})`, body?.details ?? []);
  }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  toJSON() { return { status: this.status, message: this.message, details: this.details, fieldErrors: this.fieldErrors }; }
}

export const errorMessage = (e: unknown): string => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong');
