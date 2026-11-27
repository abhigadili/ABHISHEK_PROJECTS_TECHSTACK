import { inject, type Signal } from '@angular/core';
import { injectQuery, keepPreviousData } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { ApiClient, OPERATION_MAP, type CallCtx } from '../client/api-client.service';
import { ApiError } from '../../core/models/api-error';

/** Query key convention: ['api', service, opId, path, query] - a mutation invalidates the whole ['api', service] subtree. */
export const opKey = (opId: string, ctx?: Omit<CallCtx, 'body'>) => ['api', OPERATION_MAP[opId]?.service ?? 'unknown', opId, ctx?.path ?? null, ctx?.query ?? null] as const;

export interface OpQueryOpts { enabled?: boolean; staleTime?: number; refetchInterval?: number | false; keepPrevious?: boolean }
type Src<T> = T | (() => T) | Signal<T>;
const val = <T>(s: Src<T>): T => (typeof s === 'function' ? (s as () => T)() : s);

/**
 * TanStack Query bound to one backend operation. `opId`, `ctx` and `opts` may be plain values or signal-reading functions,
 * so the query refetches whenever a signal they read changes (paging, filters, selected employee ...).
 */
export function injectOp<T = any>(opId: Src<string>, ctx: () => Omit<CallCtx, 'body'> | undefined = () => undefined, opts: () => OpQueryOpts = () => ({})) {
  const api = inject(ApiClient);
  return injectQuery(() => {
    const id = val(opId); const c = ctx(); const o = opts();
    return {
      queryKey: opKey(id, c),
      queryFn: () => firstValueFrom(api.call<T>(id, c)),
      staleTime: o.staleTime ?? 30_000,
      enabled: o.enabled ?? true,
      refetchInterval: o.refetchInterval ?? false,
      placeholderData: o.keepPrevious ? keepPreviousData : undefined,
      retry: (n: number, e: unknown) => !(e instanceof ApiError && ((e.status >= 400 && e.status < 500) || e.network)) && n < 1,
    };
  });
}
