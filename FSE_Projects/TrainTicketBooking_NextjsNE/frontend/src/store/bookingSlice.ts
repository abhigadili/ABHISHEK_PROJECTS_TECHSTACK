import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createBookingAction } from '@/features/bookings/actions';
import type { SearchResult } from '@/types';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | '';
export interface DraftPassenger { key: string; name: string; age: string; gender: Gender }
/** The multi-step booking workflow (Redux Toolkit): train + class chosen on the results page -> passengers & seats -> review -> pay. */
export interface BookingFlowState { selection: { result: SearchResult; coachTypeId: number } | null; seatIds: number[]; passengers: DraftPassenger[]; step: 'passengers' | 'review'; hydrated: boolean; submit: { status: 'idle' | 'pending' | 'failed'; error?: string } }
const blank = (name = ''): DraftPassenger => ({ key: crypto.randomUUID(), name, age: '', gender: '' });
const initialState: BookingFlowState = { selection: null, seatIds: [], passengers: [], step: 'passengers', hydrated: false, submit: { status: 'idle' } };

/** ASYNC THUNK: the booking request (a Server Action that calls Express). Resolves with the new booking id; rejects with the backend's message. */
export const submitBooking = createAsyncThunk<{ id: number }, unknown, { rejectValue: string }>('bookingFlow/submit', async (payload, { rejectWithValue }) => {
  const res = await createBookingAction(payload);
  return res.ok && res.data ? res.data : rejectWithValue(res.ok ? 'Booking failed' : res.message);
});

const slice = createSlice({
  name: 'bookingFlow', initialState,
  reducers: {
    trainSelected: (s, a: PayloadAction<{ result: SearchResult; coachTypeId: number }>) => { s.selection = a.payload; s.seatIds = []; s.step = 'passengers'; s.passengers = []; },
    seatToggled: (s, a: PayloadAction<number>) => { s.seatIds = s.seatIds.includes(a.payload) ? s.seatIds.filter((x) => x !== a.payload) : [...s.seatIds, a.payload].slice(0, 6); },
    seatsCleared: (s) => { s.seatIds = []; },
    passengersSet: (s, a: PayloadAction<DraftPassenger[]>) => { s.passengers = a.payload; },
    stepChanged: (s, a: PayloadAction<BookingFlowState['step']>) => { s.step = a.payload; },
    flowReset: () => ({ ...initialState, hydrated: true }),
    hydrate: (_s, a: PayloadAction<BookingFlowState>) => ({ ...a.payload, hydrated: true }),
    markHydrated: (s) => { s.hydrated = true; },
  },
  extraReducers: (b) => b
    .addCase(submitBooking.pending, (s) => { s.submit = { status: 'pending' }; })
    .addCase(submitBooking.fulfilled, (s) => { s.submit = { status: 'idle' }; })
    .addCase(submitBooking.rejected, (s, a) => { s.submit = { status: 'failed', error: a.payload ?? a.error.message }; }),
});
export const { trainSelected, seatToggled, seatsCleared, passengersSet, stepChanged, flowReset, hydrate, markHydrated } = slice.actions;
export const newPassenger = blank;
export default slice.reducer;
// Selectors
export const selectFlow = (s: { bookingFlow: BookingFlowState }) => s.bookingFlow;
export const selectSeatCount = (s: { bookingFlow: BookingFlowState }) => s.bookingFlow.seatIds.length;
export const selectFare = (s: { bookingFlow: BookingFlowState }) => { const f = s.bookingFlow; const c = f.selection?.result.classes.find((x) => x.coachTypeId === f.selection?.coachTypeId); return (c?.fare ?? 0) * Math.max(f.passengers.length, 1); };
