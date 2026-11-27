import { createStore } from './create-store';

export interface WidgetPref { id: string; visible: boolean }
export interface UiState {
  sidebarCollapsed: boolean;
  openNavGroups: Record<string, boolean>;
  dashboardWidgets: WidgetPref[];
  hiddenColumns: Record<string, string[]>;
  recentSearches: string[];
  pageSize: number;
  /** 0 = Sunday, 1 = Monday (calendars, weekly timesheet) */
  weekStartsOn: 0 | 1;
  /** unsaved weekly-timesheet drafts keyed by week */
  drafts: Record<string, unknown>;
}
/** UI preferences (sidebar, nav groups, dashboard layout, table columns, recent searches) - persisted per browser. */
export const uiStore = createStore<UiState>(
  { sidebarCollapsed: false, openNavGroups: {}, dashboardWidgets: [], hiddenColumns: {}, recentSearches: [], pageSize: 20, weekStartsOn: 1, drafts: {} },
  { persistKey: 'hr.ui' },
);
export const addRecentSearch = (q: string) => {
  const t = q.trim(); if (!t) return;
  uiStore.set((s) => ({ recentSearches: [t, ...s.recentSearches.filter((x) => x !== t)].slice(0, 6) }));
};
