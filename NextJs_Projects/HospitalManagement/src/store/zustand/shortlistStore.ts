'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Zustand: doctors the user shortlisted for quick booking (persisted). Demonstrates actions + persist + selector subscription. */
interface ShortlistState { ids: number[]; toggle: (id: number) => void; clear: () => void }
export const useShortlist = create<ShortlistState>()(persist((set) => ({
  ids: [],
  toggle: (id) => set((s) => ({ ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id].slice(-6) })),
  clear: () => set({ ids: [] }),
}), { name: 'hms-doctor-shortlist', storage: createJSONStorage(() => localStorage), skipHydration: true }));
