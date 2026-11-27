import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '@/services/axios/client';

/** Shared typed helpers so endpoint modules stay one-liners and every call supports cancellation (AbortSignal). */
type Params = Record<string, string | number | boolean | undefined | null>;

const clean = (p?: Params) => (p ? Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== '')) : undefined);

export const http = {
  get: <T>(url: string, params?: Params, signal?: AbortSignal, cfg?: AxiosRequestConfig) =>
    apiClient.get<T>(url, { params: clean(params), signal, ...cfg }).then((r) => r.data),
  post: <T>(url: string, body?: unknown, cfg?: AxiosRequestConfig) => apiClient.post<T>(url, body, cfg).then((r) => r.data),
  put: <T>(url: string, body?: unknown, cfg?: AxiosRequestConfig) => apiClient.put<T>(url, body, cfg).then((r) => r.data),
  patch: <T>(url: string, body?: unknown, cfg?: AxiosRequestConfig) => apiClient.patch<T>(url, body, cfg).then((r) => r.data),
  delete: <T = void>(url: string, cfg?: AxiosRequestConfig) => apiClient.delete<T>(url, cfg).then((r) => r.data),
};
