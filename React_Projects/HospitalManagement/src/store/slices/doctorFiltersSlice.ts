import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DoctorListParams } from '@/types';

/**
 * Redux Toolkit slice for the Doctor directory's UI state (filters, sort, page, comparison tray).
 * Server data (the doctors themselves) stays in TanStack Query - Redux only holds state that several components
 * (filter bar, table, comparison tray, header badge) must agree on.
 */
export type DoctorSortKey = 'fullName' | 'specialization' | 'experienceYears' | 'consultationFee';

export interface DoctorFiltersState {
  search: string;
  specialization: string;
  departmentId: number | null;
  onlyActive: boolean;
  sortKey: DoctorSortKey;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
  compareIds: number[];
}

const initialState: DoctorFiltersState = {
  search: '',
  specialization: '',
  departmentId: null,
  onlyActive: true,
  sortKey: 'fullName',
  sortDir: 'asc',
  page: 0,
  pageSize: 8,
  compareIds: [],
};

const slice = createSlice({
  name: 'doctorFilters',
  initialState,
  reducers: {
    searchChanged(s, a: PayloadAction<string>) {
      s.search = a.payload;
      s.page = 0;
    },
    specializationChanged(s, a: PayloadAction<string>) {
      s.specialization = a.payload;
      s.page = 0;
    },
    departmentChanged(s, a: PayloadAction<number | null>) {
      s.departmentId = a.payload;
      s.page = 0;
    },
    onlyActiveChanged(s, a: PayloadAction<boolean>) {
      s.onlyActive = a.payload;
      s.page = 0;
    },
    sortChanged(s, a: PayloadAction<DoctorSortKey>) {
      if (s.sortKey === a.payload) s.sortDir = s.sortDir === 'asc' ? 'desc' : 'asc';
      else {
        s.sortKey = a.payload;
        s.sortDir = 'asc';
      }
    },
    pageChanged(s, a: PayloadAction<number>) {
      s.page = a.payload;
    },
    pageSizeChanged(s, a: PayloadAction<number>) {
      s.pageSize = a.payload;
      s.page = 0;
    },
    compareToggled(s, a: PayloadAction<number>) {
      const i = s.compareIds.indexOf(a.payload);
      if (i >= 0) s.compareIds.splice(i, 1);
      else if (s.compareIds.length < 3) s.compareIds.push(a.payload);
    },
    compareCleared(s) {
      s.compareIds = [];
    },
    filtersReset: (s) => ({ ...initialState, compareIds: s.compareIds, pageSize: s.pageSize }),
  },
});

export const doctorFiltersActions = slice.actions;
export default slice.reducer;

/* Memoised selectors: they only recompute when their input slice changes (Optimizing Redux selectors). */
type Root = { doctorFilters: DoctorFiltersState };
export const selectDoctorFilters = (s: Root) => s.doctorFilters;
export const selectCompareIds = (s: Root) => s.doctorFilters.compareIds;
export const selectCompareCount = createSelector(selectCompareIds, (ids) => ids.length);
export const selectDoctorServerParams = createSelector(
  [(s: Root) => s.doctorFilters.specialization, (s: Root) => s.doctorFilters.departmentId, (s: Root) => s.doctorFilters.onlyActive],
  (specialization, departmentId, onlyActive): DoctorListParams => ({
    specialization: specialization || undefined,
    departmentId: departmentId ?? undefined,
    active: onlyActive ? true : undefined,
    size: 100,
  }),
);
export const selectHasActiveFilters = createSelector(selectDoctorFilters, (f) => !!(f.search || f.specialization || f.departmentId || !f.onlyActive));
