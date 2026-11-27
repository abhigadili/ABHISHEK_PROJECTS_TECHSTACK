import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/i18n';
import { call, OPERATION_MAP, type CallCtx } from '@/api/client/call';
import { ApiError } from '@/api/client/errors';

/** Query key convention: ['api', service, opId, path, query] - a mutation invalidates the whole ['api', service] subtree. */
export const opKey = (opId: string, ctx?: CallCtx) => ['api', OPERATION_MAP[opId]?.service ?? 'unknown', opId, ctx?.path ?? null, ctx?.query ?? null] as const;

export function useOp<T = any>(opId: string, ctx?: Omit<CallCtx, 'body'>, opts?: Omit<UseQueryOptions<T, ApiError, T, any>, 'queryKey' | 'queryFn'>) {
  return useQuery<T, ApiError, T, any>({ queryKey: opKey(opId, ctx), queryFn: () => call<T>(opId, ctx), staleTime: 30_000, retry: (n, e) => !(e instanceof ApiError && (e.status >= 400 && e.status < 500 || e.network)) && n < 1, ...opts });
}

export interface MutOpts<T> { successMessage?: string | false; invalidate?: string[]; onSuccess?: (data: T) => void; silentError?: boolean }
export function useOpMutation<T = any>(opId: string, o: MutOpts<T> = {}) {
  const qc = useQueryClient();
  return useMutation<T, ApiError, CallCtx>({
    mutationFn: (ctx) => call<T>(opId, ctx),
    onSuccess: (data) => {
      const svc = OPERATION_MAP[opId]?.service;
      [svc, ...(o.invalidate ?? [])].filter(Boolean).forEach((s) => qc.invalidateQueries({ queryKey: ['api', s] }));
      if (o.successMessage !== false) toast.success(o.successMessage ?? i18n.t('common.saved'), { toastId: `ok-${opId}` });
      o.onSuccess?.(data);
    },
    onError: (e) => { if (!o.silentError) toast.error(e.message, { toastId: `err-${opId}-${e.status}` }); },
  });
}
