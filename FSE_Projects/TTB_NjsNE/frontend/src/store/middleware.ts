import { isRejected, type Middleware } from '@reduxjs/toolkit';
import type { BookingFlowState } from './bookingSlice';
import { toastAdded } from './uiSlice';

const KEY = 'ttb.bookingFlow';
/** Custom middleware #1: keep the in-progress booking in sessionStorage so a refresh or an intercepted-route navigation does not lose it. */
export const persistBookingFlow: Middleware<object, { bookingFlow: BookingFlowState }> = (api) => (next) => (action) => {
  const result = next(action); const type = (action as { type?: string }).type;
  if (typeof type === 'string' && type.startsWith('bookingFlow/') && type !== 'bookingFlow/hydrate' && type !== 'bookingFlow/markHydrated') { try { const { hydrated: _h, ...rest } = api.getState().bookingFlow; sessionStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* storage unavailable */ } }
  return result;
};
export const loadBookingFlow = (): BookingFlowState | null => { try { const raw = sessionStorage.getItem(KEY); return raw ? ({ ...JSON.parse(raw), hydrated: true } as BookingFlowState) : null; } catch { return null; } };
/** Custom middleware #2: surface unexpected failed thunks as toasts. */
export const errorToast: Middleware = (api) => (next) => (action) => {
  if (isRejected(action) && !action.meta.aborted) api.dispatch(toastAdded({ kind: 'error', title: 'Action failed', message: action.error?.message }));
  return next(action);
};
