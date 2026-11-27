'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Zustand: lightweight, persisted UI preferences + recent searches (no server data lives here - that is TanStack Query's job). */
export interface RecentSearch { from: string; to: string; fromName: string; toName: string; date: string }
interface PrefState {
  sortBy: 'departure' | 'duration' | 'fare' | 'name'; compactCards: boolean; recent: RecentSearch[];
  setSortBy: (s: PrefState['sortBy']) => void; toggleCompact: () => void; addRecent: (r: RecentSearch) => void; clearRecent: () => void;
}
export const usePrefs = create<PrefState>()(persist((set) => ({
  sortBy: 'departure', compactCards: false, recent: [],
  setSortBy: (sortBy) => set({ sortBy }), toggleCompact: () => set((s) => ({ compactCards: !s.compactCards })),
  addRecent: (r) => set((s) => ({ recent: [r, ...s.recent.filter((x) => !(x.from === r.from && x.to === r.to))].slice(0, 5) })), clearRecent: () => set({ recent: [] }),
}), { name: 'ttb.prefs', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ sortBy: s.sortBy, compactCards: s.compactCards, recent: s.recent }) }));
export const selectRecent = (s: PrefState) => s.recent;
