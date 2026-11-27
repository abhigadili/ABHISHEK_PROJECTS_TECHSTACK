import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import type { SearchParams, SearchResult, Station } from '../core/models/models';
import { TrainService } from '../core/services/catalog.services';
import { toApiError } from '../core/interceptors/error.interceptor';

export interface SearchFilters { sort: SearchParams['sort']; type: string; departAfter: string; coachTypeId: number | null }
interface SearchState { criteria: { from: Station; to: Station; date: string; passengers: number } | null; filters: SearchFilters; results: SearchResult[]; loading: boolean; error: string | null; searched: boolean }
const initial: SearchState = { criteria: null, filters: { sort: 'departure', type: '', departAfter: '', coachTypeId: null }, results: [], loading: false, error: null, searched: false };

/**
 * NgRx SignalStore for the search page: criteria + filters are signals; `run` is an rxMethod whose switchMap cancels the previous
 * request whenever the criteria / filters change. Availability is NOT cached as truth - every search re-asks the backend.
 */
export const SearchStore = signalStore(
  { providedIn: 'root' },
  withState(initial),
  withComputed((s) => ({
    params: computed<SearchParams | null>(() => {
      const c = s.criteria(); const f = s.filters(); if (!c) return null;
      return { from: c.from.id, to: c.to.id, date: c.date, sort: f.sort, minSeats: c.passengers, ...(f.type ? { type: f.type } : {}), ...(f.departAfter ? { departAfter: f.departAfter } : {}), ...(f.coachTypeId ? { coachTypeId: f.coachTypeId } : {}) };
    }),
    count: computed(() => s.results().length),
  })),
  withMethods((store, trains = inject(TrainService)) => {
    const run = rxMethod<SearchParams | null>(pipe(
      tap((p) => patchState(store, p ? { loading: true, error: null } : {})),
      switchMap((p) => (p ? trains.search(p).pipe(
        tap((results) => patchState(store, { results, loading: false, searched: true })),
        catchError((e) => { patchState(store, { loading: false, searched: true, results: [], error: toApiError(e).message }); return of(null); }),
      ) : of(null))),
    ));
    return {
      search(criteria: NonNullable<SearchState['criteria']>) { patchState(store, { criteria }); run(store.params()); },
      setFilters(filters: Partial<SearchFilters>) { patchState(store, (s) => ({ filters: { ...s.filters, ...filters } })); if (store.criteria()) run(store.params()); },
      refresh() { run(store.params()); },
      clear() { patchState(store, initial); },
    };
  }),
);
