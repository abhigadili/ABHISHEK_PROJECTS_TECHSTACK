import { createAction, createFeature, createReducer, createSelector, on, props } from '@ngrx/store';
import type { Gender, SearchResult, Station } from '../../core/models/models';

/** Booking wizard state shared between the search results and the booking page: journey, chosen class, seats, passenger drafts. */
export interface PassengerDraft { passengerId?: number; name: string; age: number | null; gender: Gender | ''; mobile?: string }
export interface Journey { trainId: number; trainLabel: string; date: string; from: Station; to: Station; coachTypeId: number; classLabel: string; fare: number; departure: string; arrival: string }
export interface BookingFlowState { journey: Journey | null; seatIds: number[]; passengers: PassengerDraft[]; passengerCount: number }
const initial: BookingFlowState = { journey: null, seatIds: [], passengers: [], passengerCount: 1 };

export const BookingFlowActions = {
  selectJourney: createAction('[BookingFlow] Select journey', props<{ journey: Journey; passengerCount: number }>()),
  setSeats: createAction('[BookingFlow] Set seats', props<{ seatIds: number[] }>()),
  setPassengers: createAction('[BookingFlow] Set passengers', props<{ passengers: PassengerDraft[] }>()),
  reset: createAction('[BookingFlow] Reset'),
};
export const bookingFlowFeature = createFeature({
  name: 'bookingFlow',
  reducer: createReducer(initial,
    on(BookingFlowActions.selectJourney, (s, a) => ({ ...initial, journey: a.journey, passengerCount: a.passengerCount, passengers: s.journey?.trainId === a.journey.trainId && s.journey.date === a.journey.date ? s.passengers : [] })),
    on(BookingFlowActions.setSeats, (s, a) => ({ ...s, seatIds: a.seatIds })),
    on(BookingFlowActions.setPassengers, (s, a) => ({ ...s, passengers: a.passengers })),
    on(BookingFlowActions.reset, () => initial),
  ),
});
export const { selectJourney, selectSeatIds, selectPassengers, selectPassengerCount } = bookingFlowFeature;
export const selectEstimatedTotal = createSelector(selectJourney, selectPassengerCount, selectPassengers, (j, count, p) => (j ? j.fare * Math.max(count, p.length) : 0));
/** `boardingDate` is the date the passenger boards at the source station (the backend resolves the run from it). */
export const toJourney = (r: SearchResult, cls: SearchResult['classes'][number], boardingDate: string): Journey => ({
  trainId: r.train.id, trainLabel: `${r.train.number} ${r.train.name}`, date: boardingDate, from: r.from.station, to: r.to.station, coachTypeId: cls.coachTypeId, classLabel: cls.name, fare: cls.fare, departure: r.from.departure, arrival: r.to.arrival,
});
