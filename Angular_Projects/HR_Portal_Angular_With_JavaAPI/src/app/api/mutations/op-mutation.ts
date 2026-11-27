import { inject } from '@angular/core';
import { injectMutation, QueryClient } from '@tanstack/angular-query-experimental';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient, OPERATION_MAP, type CallCtx } from '../client/api-client.service';
import { ApiError } from '../../core/models/api-error';
import { ToastService } from '../../core/services/toast.service';

export interface MutOpts<T> { successMessage?: string | false; invalidate?: string[]; onSuccess?: (data: T) => void; silentError?: boolean }

/** Mutation bound to one backend operation: invalidates the service's cached queries, toasts the result. */
export function injectOpMutation<T = any>(opId: string | (() => string), o: MutOpts<T> | (() => MutOpts<T>) = {}) {
  const api = inject(ApiClient); const qc = inject(QueryClient); const toast = inject(ToastService); const tr = inject(TranslateService);
  const id = () => (typeof opId === 'function' ? opId() : opId);
  const opts = () => (typeof o === 'function' ? o() : o);
  return injectMutation<T, ApiError, CallCtx>(() => ({
    mutationFn: (ctx: CallCtx) => firstValueFrom(api.call<T>(id(), ctx)),
    onSuccess: (data: T) => {
      const co = opts(); const svc = OPERATION_MAP[id()]?.service;
      [svc, ...(co.invalidate ?? [])].filter(Boolean).forEach((s) => qc.invalidateQueries({ queryKey: ['api', s] }));
      if (co.successMessage !== false) toast.success(co.successMessage ?? tr.instant('common.saved'));
      co.onSuccess?.(data);
    },
    onError: (e: ApiError) => { if (!opts().silentError) toast.error(e.message); },
  }));
}
