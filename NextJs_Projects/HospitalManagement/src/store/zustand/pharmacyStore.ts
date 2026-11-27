'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Medicine, StockLevel } from '@/types';

/** Zustand - Pharmacy module: filter/sort state, persisted, with a pure derived-state selector. */
export type MedicineSort = 'name' | 'price' | 'stock';
interface PharmacyState {
  search: string; stock: StockLevel | 'ALL'; sort: MedicineSort; pageSize: number;
  setSearch: (s: string) => void; setStock: (s: PharmacyState['stock']) => void; setSort: (s: MedicineSort) => void; setPageSize: (n: number) => void; reset: () => void;
}
export const usePharmacyStore = create<PharmacyState>()(
  persist(
    (set) => ({
      search: '', stock: 'ALL', sort: 'name', pageSize: 12,
      setSearch: (search) => set({ search }), setStock: (stock) => set({ stock }), setSort: (sort) => set({ sort }), setPageSize: (pageSize) => set({ pageSize }),
      reset: () => set({ search: '', stock: 'ALL', sort: 'name' }),
    }),
    { name: 'hms-pharmacy', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ sort: s.sort, pageSize: s.pageSize }), skipHydration: true },
  ),
);

export const stockLevel = (m: Medicine): StockLevel => (m.stockQuantity <= 0 ? 'OUT' : m.stockQuantity <= m.reorderLevel ? 'LOW' : 'OK');
/** Derived state: filtering + sorting computed from store values, not stored. */
export function deriveMedicines(all: Medicine[], s: Pick<PharmacyState, 'search' | 'stock' | 'sort'>) {
  const q = s.search.trim().toLowerCase();
  const rows = all.filter((m) => m.active && (s.stock === 'ALL' || stockLevel(m) === s.stock) && (!q || `${m.name} ${m.genericName ?? ''} ${m.sku}`.toLowerCase().includes(q)));
  return rows.sort((a, b) => (s.sort === 'price' ? a.unitPrice - b.unitPrice : s.sort === 'stock' ? a.stockQuantity - b.stockQuantity : a.name.localeCompare(b.name)));
}
