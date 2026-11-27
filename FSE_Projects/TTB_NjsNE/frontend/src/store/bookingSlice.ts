import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SearchResult } from '@/types';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | '';
export interface DraftPassenger { key: string; name: string; age: string; gender: Gender }
/** The multi-step booking workflow (Redux Toolkit): train + class chosen on the results page -> passengers & seats -> review -> pay. */
export interface BookingFlowState { selection: { result: SearchResult; coachTypeId: number } | null; seatIds: number[]; passengers: DraftPassenger[]; step: 'passengers' | 'review'; hydrated: boolean }
const blank = (name = ''): DraftPassenger => ({ key: crypto.randomUUID(), name, age: '', gender: '' });
const initialState: BookingFlowState = { selection: null, seatIds: [], passengers: [], step: 'passengers', hydrated: false };

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
});
export const { trainSelected, seatToggled, seatsCleared, passengersSet, stepChanged, flowReset, hydrate, markHydrated } = slice.actions;
export const newPassenger = blank;
export default slice.reducer;
// Selectors
export const selectFlow = (s: { bookingFlow: BookingFlowState }) => s.bookingFlow;
export const selectSeatCount = (s: { bookingFlow: BookingFlowState }) => s.bookingFlow.seatIds.length;
export const selectFare = (s: { bookingFlow: BookingFlowState }) => { const f = s.bookingFlow; const c = f.selection?.result.classes.find((x) => x.coachTypeId === f.selection?.coachTypeId); return (c?.fare ?? 0) * Math.max(f.passengers.length, 1); };
