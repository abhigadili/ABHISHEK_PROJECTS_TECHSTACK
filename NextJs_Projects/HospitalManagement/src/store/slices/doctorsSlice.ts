import { createAsyncThunk, createEntityAdapter, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { doctorsApi } from '@/services/api/clientApis';
import { errorMessage } from '@/lib/utilities/api-error';
import type { Doctor } from '@/types';

/** Redux Toolkit - Doctor Management: normalized entities + thunk + filter state + memoised selectors. */
const adapter = createEntityAdapter<Doctor>({ sortComparer: (a, b) => a.fullName.localeCompare(b.fullName) });

export type DoctorSort = 'name' | 'experience' | 'fee';
interface DoctorsState { status: 'idle' | 'loading' | 'succeeded' | 'failed'; error: string | null; search: string; specialization: string; onlyActive: boolean; sort: DoctorSort }

export const fetchDoctors = createAsyncThunk('doctors/fetch', async (_: void, { rejectWithValue, signal }) => {
  try {
    const controller = new AbortController();
    signal.addEventListener('abort', () => controller.abort()); // thunk cancellation -> request cancellation
    return (await doctorsApi.list({ size: 100 }, controller.signal)).content;
  } catch (e) { return rejectWithValue(errorMessage(e)); }
});

const slice = createSlice({
  name: 'doctors',
  initialState: adapter.getInitialState<DoctorsState>({ status: 'idle', error: null, search: '', specialization: '', onlyActive: true, sort: 'name' }),
  reducers: {
    setSearch: (s, a: PayloadAction<string>) => { s.search = a.payload; },
    setSpecialization: (s, a: PayloadAction<string>) => { s.specialization = a.payload; },
    setOnlyActive: (s, a: PayloadAction<boolean>) => { s.onlyActive = a.payload; },
    setSort: (s, a: PayloadAction<DoctorSort>) => { s.sort = a.payload; },
    resetFilters: (s) => { s.search = ''; s.specialization = ''; s.onlyActive = true; s.sort = 'name'; },
    doctorUpserted: adapter.upsertOne,
  },
  extraReducers: (b) => {
    b.addCase(fetchDoctors.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(fetchDoctors.fulfilled, (s, a) => { s.status = 'succeeded'; adapter.setAll(s, a.payload); })
      .addCase(fetchDoctors.rejected, (s, a) => { if (a.meta.aborted) return; s.status = 'failed'; s.error = (a.payload as string) ?? a.error.message ?? 'Failed to load doctors'; });
  },
});
export const doctorsActions = slice.actions;
export const doctorsReducer = slice.reducer;

type Root = { doctors: ReturnType<typeof slice.getInitialState> };
const sel = adapter.getSelectors<Root>((s) => s.doctors);
export const selectAllDoctors = sel.selectAll;
export const selectDoctorsState = (s: Root) => s.doctors;
/** Memoised selector: recomputes only when entities or filter inputs change. */
export const selectVisibleDoctors = createSelector([sel.selectAll, (s: Root) => s.doctors.search, (s: Root) => s.doctors.specialization, (s: Root) => s.doctors.onlyActive, (s: Root) => s.doctors.sort], (all, search, spec, onlyActive, sort) => {
  const q = search.trim().toLowerCase();
  const rows = all.filter((d) => (!onlyActive || d.active) && (!spec || d.specialization === spec) && (!q || `${d.fullName} ${d.specialization} ${d.email}`.toLowerCase().includes(q)));
  return [...rows].sort((a, b) => (sort === 'experience' ? (b.experienceYears ?? 0) - (a.experienceYears ?? 0) : sort === 'fee' ? a.consultationFee - b.consultationFee : a.fullName.localeCompare(b.fullName)));
});
export const selectSpecializations = createSelector([sel.selectAll], (all) => [...new Set(all.map((d) => d.specialization))].sort());
