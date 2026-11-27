export interface FieldError { field: string; message: string }
/** Normalised backend error (the Java services answer with the shared `ApiError` JSON). */
export class ApiError extends Error {
  status: number; code?: string; fieldErrors: FieldError[]; correlationId?: string; network: boolean;
  constructor(init: { message: string; status: number; code?: string; fieldErrors?: FieldError[]; correlationId?: string; network?: boolean }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status; this.code = init.code; this.fieldErrors = init.fieldErrors ?? []; this.correlationId = init.correlationId; this.network = !!init.network;
  }
}
export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : 'Unexpected error');
