import { create } from 'zustand';
import { persist } from 'zustand/middleware';
/** Lightweight UI preferences: sidebar, table preferences, dashboard layout, recent searches, transient workflow drafts. */
interface UiState {
  sidebarCollapsed: boolean; mobileNavOpen: boolean;
  toggleSidebar: () => void; setMobileNav: (v: boolean) => void;
  openGroups: Record<string, boolean>; toggleGroup: (k: string) => void;
  tablePrefs: Record<string, { hidden: string[]; pageSize: number }>;
  setTablePrefs: (id: string, p: Partial<{ hidden: string[]; pageSize: number }>) => void;
  widgetOrder: string[]; widgetHidden: string[];
  setWidgetOrder: (o: string[]) => void; toggleWidget: (id: string) => void; resetWidgets: () => void;
  recentSearches: string[]; addRecentSearch: (q: string) => void;
  drafts: Record<string, unknown>; setDraft: (k: string, v: unknown) => void; clearDraft: (k: string) => void;
}
export const DEFAULT_WIDGETS = ['kpis', 'mine', 'team', 'headcount', 'leaves', 'attendance', 'holidays', 'projects', 'timesheets', 'performance', 'joining'];
export const useUiStore = create<UiState>()(persist((set) => ({
  sidebarCollapsed: false, mobileNavOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
  openGroups: {}, toggleGroup: (k) => set((s) => ({ openGroups: { ...s.openGroups, [k]: !(s.openGroups[k] ?? true) } })),
  tablePrefs: {}, setTablePrefs: (id, p) => set((s) => ({ tablePrefs: { ...s.tablePrefs, [id]: { ...{ hidden: [] as string[], pageSize: 20 }, ...s.tablePrefs[id], ...p } } })),
  widgetOrder: DEFAULT_WIDGETS, widgetHidden: [],
  setWidgetOrder: (widgetOrder) => set({ widgetOrder }),
  toggleWidget: (id) => set((s) => ({ widgetHidden: s.widgetHidden.includes(id) ? s.widgetHidden.filter((x) => x !== id) : [...s.widgetHidden, id] })),
  resetWidgets: () => set({ widgetOrder: DEFAULT_WIDGETS, widgetHidden: [] }),
  recentSearches: [], addRecentSearch: (q) => set((s) => ({ recentSearches: [q, ...s.recentSearches.filter((x) => x !== q)].slice(0, 6) })),
  drafts: {}, setDraft: (k, v) => set((s) => ({ drafts: { ...s.drafts, [k]: v } })),
  clearDraft: (k) => set((s) => { const d = { ...s.drafts }; delete d[k]; return { drafts: d }; }),
}), {
  name: 'hr.ui',
  partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, openGroups: s.openGroups, tablePrefs: s.tablePrefs, widgetOrder: s.widgetOrder, widgetHidden: s.widgetHidden, recentSearches: s.recentSearches }),
}));
