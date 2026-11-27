import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { addEntity, setAllEntities, updateEntity, withEntities } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { PharmacyApiService } from '../../core/api/pharmacy-api.service';
import { errorMessage } from '../../core/models/api-error';
import type { Medicine, MedicineInput, StockLevel } from '../../core/models';

export type MedicineSort = 'name' | 'unitPrice' | 'stockQuantity';
export const stockLevel = (m: Medicine): StockLevel => (m.stockQuantity <= 0 ? 'OUT' : m.stockQuantity <= m.reorderLevel ? 'LOW' : 'OK');

/**
 * NgRx SIGNAL STORE (@ngrx/signals): the pharmacy catalogue.
 *   withEntities     → normalised medicines (setAllEntities, addEntity, updateEntity)
 *   withState        → UI state (search, filters, sort, paging, pinned ids)
 *   withComputed     → derived signals (filtered, pageRows, counts)
 *   withMethods      → intent methods; rxMethod() bridges RxJS (switchMap request cancellation) into the store
 *   withHooks        → onInit loads the catalogue; persists pinned ids
 */
interface PharmacyUi { search: string; stock: StockLevel | 'ALL'; sort: MedicineSort; sortDir: 'asc' | 'desc'; page: number; pageSize: number; pinned: number[]; loading: boolean; error: string | null }
const PINNED_KEY = 'hms.ng.pharmacy.pinned';
const readPinned = (): number[] => { try { return JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]') as number[]; } catch { return []; } };

export const PharmacyStore = signalStore(
  { providedIn: 'root' },
  withEntities<Medicine>(),
  withState<PharmacyUi>({ search: '', stock: 'ALL', sort: 'name', sortDir: 'asc', page: 0, pageSize: 10, pinned: [], loading: false, error: null }),
  withComputed((s) => {
    const filtered = computed(() => {
      const q = s.search().toLowerCase();
      const dir = s.sortDir() === 'asc' ? 1 : -1;
      const key = s.sort();
      return s.entities().filter((m) => m.active && (s.stock() === 'ALL' || stockLevel(m) === s.stock()) && (!q || m.name.toLowerCase().includes(q) || (m.genericName ?? '').toLowerCase().includes(q) || m.sku.toLowerCase().includes(q)))
        .sort((a, b) => (key === 'name' ? a.name.localeCompare(b.name) : (a[key] as number) - (b[key] as number)) * dir);
    });
    const pages = computed(() => Math.max(1, Math.ceil(filtered().length / s.pageSize())));
    return {
      filtered,
      pages,
      pageRows: computed(() => filtered().slice(Math.min(s.page(), pages() - 1) * s.pageSize(), (Math.min(s.page(), pages() - 1) + 1) * s.pageSize())),
      counts: computed(() => s.entities().filter((m) => m.active).reduce((c, m) => ({ ...c, [stockLevel(m)]: c[stockLevel(m)] + 1 }), { OK: 0, LOW: 0, OUT: 0 } as Record<StockLevel, number>)),
      pinnedMedicines: computed(() => s.entities().filter((m) => s.pinned().includes(m.id))),
      lowStock: computed(() => s.entities().filter((m) => m.active && stockLevel(m) !== 'OK').sort((a, b) => a.stockQuantity - b.stockQuantity)),
    };
  }),
  withMethods((store, api = inject(PharmacyApiService)) => ({
    setSearch: (search: string) => patchState(store, { search, page: 0 }),
    setStock: (stock: StockLevel | 'ALL') => patchState(store, { stock, page: 0 }),
    setSort: (sort: MedicineSort) => patchState(store, (s) => ({ sort, sortDir: (s.sort === sort && s.sortDir === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' })),
    setPage: (page: number) => patchState(store, { page }),
    togglePin: (id: number) => patchState(store, (s) => { const pinned = s.pinned.includes(id) ? s.pinned.filter((x) => x !== id) : [...s.pinned, id]; try { localStorage.setItem(PINNED_KEY, JSON.stringify(pinned)); } catch { /* ignore */ } return { pinned }; }),
    /** rxMethod: each call (or signal change when a signal is passed) triggers the pipeline; switchMap cancels a running request. */
    load: rxMethod<void>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(() => api.medicines().pipe(tapResponse({ next: (m) => patchState(store, setAllEntities(m), { loading: false }), error: (e) => patchState(store, { loading: false, error: errorMessage(e) }) }))),
    )),
    /** Optimistic restock: updateEntity immediately, roll back on error. */
    restock: rxMethod<{ id: number; quantity: number }>(pipe(
      tap(({ id, quantity }) => patchState(store, updateEntity({ id, changes: (m) => ({ stockQuantity: m.stockQuantity + quantity }) }))),
      switchMap(({ id, quantity }) => api.restock(id, quantity).pipe(tapResponse({
        next: (m) => patchState(store, updateEntity({ id: m.id, changes: m })),
        error: () => patchState(store, updateEntity({ id, changes: (m) => ({ stockQuantity: m.stockQuantity - quantity }) })),
      }))),
    )),
    saved: (m: Medicine) => patchState(store, store.entityMap()[m.id] ? updateEntity({ id: m.id, changes: m }) : addEntity(m)),
    create: (b: MedicineInput) => api.createMedicine(b),
    update: (id: number, b: MedicineInput) => api.updateMedicine(id, b),
  })),
  withHooks({
    onInit(store) {
      patchState(store, { pinned: readPinned() });
      store.load();
    },
  }),
);
