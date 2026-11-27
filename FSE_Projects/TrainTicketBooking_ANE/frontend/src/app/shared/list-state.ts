import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { BehaviorSubject, Observable, catchError, combineLatest, debounceTime, distinctUntilChanged, of, startWith, switchMap, tap } from 'rxjs';
import type { PageMeta, PageQuery, Paged } from '../core/models/models';
import { toApiError } from '../core/interceptors/error.interceptor';

/**
 * Server-side list state shared by the admin tables. Must be called in an injection context.
 * search (debounced) + extra filters + paging + sorting -> combineLatest -> switchMap (stale requests are cancelled).
 */
export function listState<T extends object>(fetch: (q: PageQuery) => Observable<Paged<T>>, init: { sort?: string; dir?: 'asc' | 'desc'; size?: number } = {}, extra$: Observable<Record<string, unknown>> = of({})) {
  const search = new FormControl('', { nonNullable: true });
  const page$ = new BehaviorSubject<PageEvent>({ pageIndex: 0, pageSize: init.size ?? 10, length: 0 });
  const sort$ = new BehaviorSubject<Sort>({ active: init.sort ?? '', direction: init.sort ? (init.dir ?? 'asc') : '' });
  const retry$ = new BehaviorSubject(0);
  const rows = signal<T[]>([]); const meta = signal<PageMeta | null>(null); const loading = signal(true); const error = signal<string | null>(null);
  let lastKey = '';
  combineLatest([search.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()), extra$.pipe(startWith({} as Record<string, unknown>)), page$, sort$, retry$]).pipe(
    tap(() => { loading.set(true); error.set(null); }),
    switchMap(([q, extra, page, sort]) => {
      const key = JSON.stringify([q, extra, sort]); const pageIndex = key === lastKey ? page.pageIndex : 0; lastKey = key;
      return fetch({ ...extra as PageQuery, q: q.trim(), page: pageIndex, size: page.pageSize, ...(sort.direction ? { sort: sort.active, dir: sort.direction } : {}) }).pipe(catchError((e) => { error.set(toApiError(e).message); return of(null); }));
    }),
    takeUntilDestroyed(),
  ).subscribe((r) => { loading.set(false); if (r) { rows.set(r.items); meta.set(r.meta); } });
  return { search, page$, sort$, retry$, rows, meta, loading, error, reload: () => retry$.next(retry$.value + 1), sortActive: init.sort ?? '', sortDir: init.sort ? (init.dir ?? 'asc') : '' as const };
}
