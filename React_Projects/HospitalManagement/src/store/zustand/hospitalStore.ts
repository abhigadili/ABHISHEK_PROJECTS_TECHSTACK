import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Zustand store for the Hospital directory UI: view mode, filters and the comparison tray (persisted preferences only). */
interface HospitalUiState {
  view: 'grid' | 'table';
  search: string;
  city: string;
  showInactive: boolean;
  compareIds: number[];
  setView: (v: 'grid' | 'table') => void;
  setSearch: (s: string) => void;
  setCity: (c: string) => void;
  setShowInactive: (b: boolean) => void;
  toggleCompare: (id: number) => void;
  clearCompare: () => void;
  reset: () => void;
}

export const useHospitalStore = create<HospitalUiState>()(
  persist(
    (set) => ({
      view: 'grid',
      search: '',
      city: '',
      showInactive: false,
      compareIds: [],
      setView: (view) => set({ view }),
      setSearch: (search) => set({ search }),
      setCity: (city) => set({ city }),
      setShowInactive: (showInactive) => set({ showInactive }),
      toggleCompare: (id) =>
        set((s) => ({ compareIds: s.compareIds.includes(id) ? s.compareIds.filter((x) => x !== id) : s.compareIds.length < 3 ? [...s.compareIds, id] : s.compareIds })),
      clearCompare: () => set({ compareIds: [] }),
      reset: () => set({ search: '', city: '', showInactive: false }),
    }),
    { name: 'hms.hospital-ui', partialize: (s) => ({ view: s.view, showInactive: s.showInactive }) },
  ),
);
