import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { get } from '@/lib/api/client';

/** Redux Toolkit: the multi-step appointment-booking WORKFLOW (hospital → department → doctor → date → slot) shared by several components. */
export interface DoctorCard { id: number; user: { firstName: string; lastName: string }; specialization: { id: number; name: string }; consultationFee: string; experienceYears: number }
export interface SlotDto { startsAt: string; endsAt: string; label: string; available: boolean }
interface State { hospitalId: number | null; departmentId: number | null; doctorId: number | null; date: string; slot: string | null; doctors: DoctorCard[]; doctorsStatus: 'idle' | 'loading' | 'failed'; slots: SlotDto[]; slotsStatus: 'idle' | 'loading' | 'failed'; error: string | null }
const initial: State = { hospitalId: null, departmentId: null, doctorId: null, date: '', slot: null, doctors: [], doctorsStatus: 'idle', slots: [], slotsStatus: 'idle', error: null };

export const fetchDoctors = createAsyncThunk('booking/fetchDoctors', async (a: { hospitalId: number; departmentId: number | null; q?: string }, { rejectWithValue }) => {
  try { return (await get<DoctorCard[]>('/doctors', { hospitalId: a.hospitalId, departmentId: a.departmentId ?? undefined, q: a.q || undefined, size: 50 })).data; } catch (e) { return rejectWithValue((e as Error).message); }
});
export const fetchSlots = createAsyncThunk('booking/fetchSlots', async (a: { doctorId: number; hospitalId: number; date: string }, { rejectWithValue }) => {
  try { return (await get<SlotDto[]>('/appointments/slots', a)).data; } catch (e) { return rejectWithValue((e as Error).message); }
});
const slice = createSlice({
  name: 'booking', initialState: initial,
  reducers: {
    selectHospital: (s, a: PayloadAction<number | null>) => ({ ...initial, hospitalId: a.payload }),
    selectDepartment: (s, a: PayloadAction<number | null>) => { s.departmentId = a.payload; s.doctorId = null; s.slot = null; s.slots = []; },
    selectDoctor: (s, a: PayloadAction<number>) => { s.doctorId = a.payload; s.slot = null; s.slots = []; },
    selectDate: (s, a: PayloadAction<string>) => { s.date = a.payload; s.slot = null; },
    selectSlot: (s, a: PayloadAction<string | null>) => { s.slot = a.payload; },
    reset: () => initial,
  },
  extraReducers: (b) => {
    b.addCase(fetchDoctors.pending, (s) => { s.doctorsStatus = 'loading'; }).addCase(fetchDoctors.fulfilled, (s, a) => { s.doctorsStatus = 'idle'; s.doctors = a.payload; }).addCase(fetchDoctors.rejected, (s, a) => { s.doctorsStatus = 'failed'; s.error = String(a.payload); })
      .addCase(fetchSlots.pending, (s) => { s.slotsStatus = 'loading'; }).addCase(fetchSlots.fulfilled, (s, a) => { s.slotsStatus = 'idle'; s.slots = a.payload; }).addCase(fetchSlots.rejected, (s, a) => { s.slotsStatus = 'failed'; s.error = String(a.payload); });
  },
});
export const booking = slice.actions;
export const bookingReducer = slice.reducer;
