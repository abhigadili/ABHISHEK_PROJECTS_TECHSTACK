import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SearchResult } from '@/types';

export interface DraftPassenger { key: string; name: string; age: string; gender: 'MALE' | 'FEMALE' | 'OTHER' | ''; savedId?: number }
export interface SearchParams { from: string; to: string; date: string }
/** The multi-step booking workflow: search -> select train/class -> seats -> passengers -> review -> pay. Persisted to sessionStorage by middleware. */
export interface BookingFlowState {
  search: SearchParams; selection: { result: SearchResult; coachTypeId: number } | null; seatIds: number[]; passengers: DraftPassenger[]; step: 'select' | 'passengers' | 'review' | 'payment'; bookingId: number | null;
}
const blank = (): DraftPassenger => ({ key: crypto.randomUUID(), name: '', age: '', gender: '' });
const initialState: BookingFlowState = { search: { from: '', to: '', date: '' }, selection: null, seatIds: [], passengers: [blank()], step: 'select', bookingId: null };

const slice = createSlice({
  name: 'bookingFlow', initialState,
  reducers: {
    searchChanged: (s, a: PayloadAction<SearchParams>) => { s.search = a.payload; },
    trainSelected: (s, a: PayloadAction<{ result: SearchResult; coachTypeId: number }>) => { s.selection = a.payload; s.seatIds = []; s.step = 'passengers'; s.bookingId = null; },
    seatToggled: (s, a: PayloadAction<number>) => { s.seatIds = s.seatIds.includes(a.payload) ? s.seatIds.filter((x) => x !== a.payload) : [...s.seatIds, a.payload].slice(0, 6); },
    seatsCleared: (s) => { s.seatIds = []; },
    passengersSet: (s, a: PayloadAction<DraftPassenger[]>) => { s.passengers = a.payload.length ? a.payload : [blank()]; },
    passengerAdded: (s) => { if (s.passengers.length < 6) s.passengers.push(blank()); },
    passengerRemoved: (s, a: PayloadAction<string>) => { if (s.passengers.length > 1) s.passengers = s.passengers.filter((p) => p.key !== a.payload); },
    stepChanged: (s, a: PayloadAction<BookingFlowState['step']>) => { s.step = a.payload; },
    bookingCreated: (s, a: PayloadAction<number>) => { s.bookingId = a.payload; s.step = 'payment'; },
    flowReset: () => ({ ...initialState, passengers: [blank()] }),
    hydrate: (_s, a: PayloadAction<BookingFlowState>) => a.payload,
  },
});
export const { searchChanged, trainSelected, seatToggled, seatsCleared, passengersSet, passengerAdded, passengerRemoved, stepChanged, bookingCreated, flowReset, hydrate } = slice.actions;
export default slice.reducer;
