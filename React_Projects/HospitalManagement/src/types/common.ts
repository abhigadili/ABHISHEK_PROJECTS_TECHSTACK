/** Shared API shapes (verified against the gateway at :30080). */

/** Spring-style page envelope returned by every paged endpoint. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Error body used by the gateway and every service. */
export interface ApiErrorBody {
  timestamp?: string;
  status: number;
  error?: string;
  message: string;
  path?: string;
  /** Validation failures: "field: message" strings. */
  details?: string[];
}

export interface PageParams {
  page?: number;
  size?: number;
}

export type ISODate = string; // 2026-11-16
export type HHmm = string; // 09:30
export type ISODateTime = string; // 2026-11-11T13:37:22.229Z

export type Role = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'LAB_STAFF' | 'PHARMACIST' | 'BILLING_STAFF';
export const ALL_ROLES: readonly Role[] = ['ADMIN', 'DOCTOR', 'PATIENT', 'LAB_STAFF', 'PHARMACIST', 'BILLING_STAFF'] as const;
