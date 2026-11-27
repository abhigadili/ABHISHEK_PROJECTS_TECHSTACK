"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
/** Zustand: lightweight UI preferences (sidebar, density) persisted in localStorage; selectors keep re-renders minimal. */
interface UiState {
    sidebarCollapsed: boolean;
    compact: boolean;
    toggleSidebar: () => void;
    setCompact: (v: boolean) => void;
}
export const useUiStore = create<UiState>()(
    persist(
        (set) => ({
            sidebarCollapsed: false,
            compact: false,
            toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
            setCompact: (compact) => set({ compact }),
        }),
        { name: "hms-ui", storage: createJSONStorage(() => localStorage), skipHydration: true },
    ),
);
