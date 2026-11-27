import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { env } from '@/constants/env';
import { tokenStore } from '@/api/tokenStore';
import { handleSessionExpired, refreshSession } from '@/api/httpClient';
import { toApiError, type ApiError } from '@/api/errors';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.apiBaseUrl,
  prepareHeaders: (headers) => {
    const token = tokenStore.getAccess();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

interface Envelope {
  success: boolean;
  data: unknown;
  meta?: unknown;
}

/** What every RTK Query endpoint rejects with: a serialisable plain object (Redux state must stay serialisable). */
export interface QueryError {
  status: number;
  code: string;
  message: string;
  details?: ApiError['details'];
  requestId?: string;
}

const toQueryError = (e: FetchBaseQueryError): QueryError => {
  const status = typeof e.status === 'number' ? e.status : 0;
  const err = toApiError(status, 'data' in e ? e.data : undefined);
  return {
    status: err.status,
    code: err.code,
    message: err.message,
    details: err.details,
    requestId: err.requestId,
  };
};

/**
 * fetchBaseQuery + (1) unwrap the backend envelope, (2) refresh the access token once on 401 using the SAME single-flight
 * promise as the Axios interceptor, (3) normalise errors.
 */
export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, QueryError> = async (
  args,
  api,
  extra,
) => {
  let result = await rawBaseQuery(args, api, extra);
  if (result.error?.status === 401 && tokenStore.hasRefresh()) {
    try {
      await refreshSession();
      result = await rawBaseQuery(args, api, extra);
    } catch {
      handleSessionExpired();
    }
  }
  if (result.error) {
    const err = toQueryError(result.error);
    if (err.status === 401) handleSessionExpired();
    return { error: err };
  }
  const body = result.data as Envelope | null;
  // lists carry `meta`; keep it next to the items so callers get pagination for free
  if (body && typeof body === 'object' && 'meta' in body && body.meta)
    return { data: { items: body.data, meta: body.meta }, meta: result.meta };
  // CSV/empty responses are not enveloped
  return { data: body && typeof body === 'object' && 'data' in body ? body.data : body, meta: result.meta };
};
