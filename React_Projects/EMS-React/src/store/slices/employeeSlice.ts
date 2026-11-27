import { createEntityAdapter, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createAppThunk } from '../thunk';
import { employeeApi } from '@/services/employeeApi';
import { errorMessage } from '@/api/errors';
import type { Employee } from '@/types/api';

/** A trimmed, normalised row used by pickers (manager select, org chart search, notifications). */
export interface DirectoryEntry {
  id: number;
  code: string;
  name: string;
  departmentId: number | null;
  jobTitle: string | null;
  status: Employee['status'];
}

/** Normalised state: `{ ids: [], entities: {id → entry} }` with O(1) lookups and ready-made selectors. */
export const directoryAdapter = createEntityAdapter<DirectoryEntry>({
  sortComparer: (a, b) => a.name.localeCompare(b.name),
});
const recentAdapter = createEntityAdapter<{ id: number; name: string; code: string }>();

/** Loads every active employee into the directory (≤ 100 per page; follows the pagination until exhausted). */
export const fetchEmployeeDirectory = createAppThunk(
  'employees/fetchDirectory',
  async (_, { rejectWithValue }) => {
    try {
      const all: DirectoryEntry[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const res = await employeeApi.list({ page, limit: 100, status: 'ACTIVE' });
        all.push(
          ...res.items.map((e) => ({
            id: e.id,
            code: e.employeeCode,
            name: e.fullName,
            departmentId: e.department?.id ?? null,
            jobTitle: e.jobTitle,
            status: e.status,
          })),
        );
        if (page >= res.meta.totalPages) break;
      }
      return all;
    } catch (e) {
      return rejectWithValue(errorMessage(e));
    }
  },
  {
    // do not re-fetch while a load is in flight or when already loaded
    condition: (_, { getState }) =>
      getState().employees.status === 'idle' || getState().employees.status === 'failed',
  },
);

interface State {
  directory: ReturnType<typeof directoryAdapter.getInitialState>;
  status: 'idle' | 'loading' | 'loaded' | 'failed';
  error: string | null;
  /** Client-only UI state: rows ticked in the employee table. */
  selectedIds: number[];
  recent: ReturnType<typeof recentAdapter.getInitialState>;
}

const initialState: State = {
  directory: directoryAdapter.getInitialState(),
  status: 'idle',
  error: null,
  selectedIds: [],
  recent: recentAdapter.getInitialState(),
};

const employeeSlice = createSlice({
  name: 'employees',
  initialState,
  reducers: {
    toggleSelected(state, a: PayloadAction<number>) {
      // Immer lets us "mutate" — the library produces an immutable update behind the scenes
      const i = state.selectedIds.indexOf(a.payload);
      if (i >= 0) state.selectedIds.splice(i, 1);
      else state.selectedIds.push(a.payload);
    },
    setSelected(state, a: PayloadAction<number[]>) {
      state.selectedIds = a.payload;
    },
    clearSelection(state) {
      state.selectedIds = [];
    },
    recordViewed(state, a: PayloadAction<{ id: number; name: string; code: string }>) {
      recentAdapter.upsertOne(state.recent, a.payload);
      if (state.recent.ids.length > 5) recentAdapter.removeOne(state.recent, state.recent.ids[0]);
    },
    invalidateDirectory(state) {
      state.status = 'idle';
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchEmployeeDirectory.pending, (s) => {
      s.status = 'loading';
      s.error = null;
    })
      .addCase(fetchEmployeeDirectory.fulfilled, (s, a) => {
        s.status = 'loaded';
        directoryAdapter.setAll(s.directory, a.payload);
      })
      .addCase(fetchEmployeeDirectory.rejected, (s, a) => {
        s.status = 'failed';
        s.error = a.payload ?? 'Failed to load employees';
      });
  },
});

export const { toggleSelected, setSelected, clearSelection, recordViewed, invalidateDirectory } =
  employeeSlice.actions;
export default employeeSlice.reducer;
export { recentAdapter };
