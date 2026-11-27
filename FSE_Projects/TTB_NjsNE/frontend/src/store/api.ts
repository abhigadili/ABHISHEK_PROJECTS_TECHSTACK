import { createApi, type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { api, toApiError } from '@/services/api-client';
import type { CoachType, Envelope, NotificationItem, Station } from '@/types';

/** RTK Query base query that reuses the shared Axios client (BFF + single-flight refresh). */
const axiosBaseQuery = (): BaseQueryFn<{ url: string; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; params?: object }, unknown, { message: string; status: number }> =>
  async ({ url, method = 'GET', body, params }) => {
    try { const r = await api.request<Envelope<unknown>>({ url, method, data: body, params }); return { data: r.data.data, meta: r.data.meta }; }
    catch (e) { const x = toApiError(e); return { error: { message: x.message, status: x.status } }; }
  };

export const catalogApi = createApi({
  reducerPath: 'catalogApi', baseQuery: axiosBaseQuery(), tagTypes: ['Notification'], keepUnusedDataFor: 300,
  endpoints: (b) => ({
    stations: b.query<Station[], void>({ query: () => ({ url: '/stations', params: { size: 100 } }) }),
    coachTypes: b.query<CoachType[], void>({ query: () => ({ url: '/lookups/coach-types' }) }),
    notifications: b.query<{ items: NotificationItem[]; unread: number }, void>({ query: () => ({ url: '/notifications', params: { size: 8 } }), providesTags: ['Notification'] }),
    markAllRead: b.mutation<unknown, void>({ query: () => ({ url: '/notifications/read-all', method: 'PATCH' }), invalidatesTags: ['Notification'] }),
  }),
});
export const { useStationsQuery, useCoachTypesQuery, useNotificationsQuery, useMarkAllReadMutation } = catalogApi;
