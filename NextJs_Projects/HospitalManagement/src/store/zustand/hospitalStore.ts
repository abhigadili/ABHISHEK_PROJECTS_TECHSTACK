'use client';
import { create } from 'zustand';
import { persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware';

/** Zustand - Hospital module: selected hospital + view prefs, persisted to localStorage (persist middleware) and observable (subscribe). */
interface HospitalState {
  selectedHospitalId: number | null;
  view: 'cards' | 'table';
  search: string;
  city: string;
  select: (id: number | null) => void;
  setView: (v: 'cards' | 'table') => void;
  setSearch: (s: string) => void;
  setCity: (c: string) => void;
  reset: () => void;
}
export const useHospitalStore = create<HospitalState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        selectedHospitalId: null, view: 'cards', search: '', city: '',
        select: (id) => set({ selectedHospitalId: id }),
        setView: (view) => set({ view }),
        setSearch: (search) => set({ search }),
        setCity: (city) => set({ city }),
        reset: () => set({ search: '', city: '' }),
      }),
      { name: 'hms-hospital', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ selectedHospitalId: s.selectedHospitalId, view: s.view }), skipHydration: true },
    ),
  ),
);
