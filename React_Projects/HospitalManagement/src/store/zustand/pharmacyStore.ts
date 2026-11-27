import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StockLevel } from '@/types';

/** Zustand store for the pharmacy catalogue: search/sort/stock filters, page and the prescription lookup list. */
export type MedicineSort = 'name' | 'unitPrice' | 'stockQuantity';

interface PharmacyState {
  search: string;
  stock: StockLevel | 'ALL';
  sort: MedicineSort;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
  /** ids of medicines the pharmacist pinned while matching a prescription */
  pinned: number[];
  setSearch: (s: string) => void;
  setStock: (s: StockLevel | 'ALL') => void;
  setSort: (s: MedicineSort) => void;
  setPage: (p: number) => void;
  togglePin: (id: number) => void;
  clearPins: () => void;
}

export const usePharmacyStore = create<PharmacyState>()(
  persist(
    (set) => ({
      search: '',
      stock: 'ALL',
      sort: 'name',
      sortDir: 'asc',
      page: 0,
      pageSize: 10,
      pinned: [],
      setSearch: (search) => set({ search, page: 0 }),
      setStock: (stock) => set({ stock, page: 0 }),
      setSort: (sort) => set((s) => ({ sort, sortDir: s.sort === sort && s.sortDir === 'asc' ? 'desc' : 'asc' })),
      setPage: (page) => set({ page }),
      togglePin: (id) => set((s) => ({ pinned: s.pinned.includes(id) ? s.pinned.filter((x) => x !== id) : [...s.pinned, id] })),
      clearPins: () => set({ pinned: [] }),
    }),
    { name: 'hms.pharmacy-ui', partialize: (s) => ({ pinned: s.pinned, pageSize: s.pageSize }) },
  ),
);
