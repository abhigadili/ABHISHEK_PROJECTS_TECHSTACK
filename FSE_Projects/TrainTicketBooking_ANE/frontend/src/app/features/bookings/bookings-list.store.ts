import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { catchError, EMPTY, switchMap, tap } from 'rxjs';
import type { Booking, PageMeta } from '../../core/models/models';
import { BookingService } from '../../core/services/account.services';
import { toApiError } from '../../core/interceptors/error.interceptor';

interface State { items: Booking[]; meta: PageMeta | null; loading: boolean; error: string | null; status: string; scope: string; page: number; size: number; q: string }
/** NgRx ComponentStore: list state for the booking history (filters, paging) with a cancellable effect. */
@Injectable()
export class BookingsListStore extends ComponentStore<State> {
  private readonly api = inject(BookingService);
  constructor() { super({ items: [], meta: null, loading: false, error: null, status: '', scope: '', page: 0, size: 10, q: '' }); }
  readonly vm$ = this.select((s) => s);
  /** Composed from primitive selectors: it re-emits ONLY when a filter really changes (not on loading/items patches). */
  readonly query$ = this.select(this.select((s) => s.status), this.select((s) => s.scope), this.select((s) => s.page), this.select((s) => s.size), this.select((s) => s.q),
    (status, scope, page, size, q) => ({ status, scope, page, size, q }), { debounce: true });
  readonly setFilter = this.updater((s, f: Partial<Pick<State, 'status' | 'scope' | 'q' | 'page' | 'size'>>) => ({ ...s, ...f, page: f.page ?? 0 }));
  readonly load = this.effect<void>((trigger$) => trigger$.pipe(
    tap(() => this.patchState({ loading: true, error: null })),
    switchMap(() => this.query$.pipe(
      switchMap((q) => { this.patchState({ loading: true, error: null }); return this.api.list({ status: q.status, scope: q.scope, q: q.q, page: q.page, size: q.size }).pipe(
        tap((r) => this.patchState({ items: r.items, meta: r.meta, loading: false })),
        catchError((e) => { this.patchState({ loading: false, error: toApiError(e).message }); return EMPTY; }),
      ); }),
    )),
  ));
}
