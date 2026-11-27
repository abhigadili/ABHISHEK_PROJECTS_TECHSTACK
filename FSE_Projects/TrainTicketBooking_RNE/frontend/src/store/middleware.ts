import { isRejected, type Middleware } from '@reduxjs/toolkit';
import { hydrate, type BookingFlowState } from './bookingSlice';
import { toastAdded } from './uiSlice';

const KEY = 'ttb.bookingFlow';
/** Custom middleware #1: persist the in-progress booking so a refresh doesn't lose the passenger form. */
export const persistBookingFlow: Middleware<object, { bookingFlow: BookingFlowState }> = (api) => (next) => (action) => {
  const result = next(action);
  if (typeof (action as { type?: string }).type === 'string' && (action as { type: string }).type.startsWith('bookingFlow/')) {
    try { sessionStorage.setItem(KEY, JSON.stringify(api.getState().bookingFlow)); } catch { /* storage unavailable */ }
  }
  return result;
};
export const loadBookingFlow = () => { try { const raw = sessionStorage.getItem(KEY); return raw ? (JSON.parse(raw) as BookingFlowState) : null; } catch { return null; } };
export { hydrate };

/** Custom middleware #2: surface unexpected failed thunks as toasts (login errors are shown inline instead). */
export const errorToast: Middleware = (api) => (next) => (action) => {
  if (isRejected(action) && !action.type.startsWith('auth/login') && !action.meta.aborted && !action.type.startsWith('auth/bootstrap')) {
    api.dispatch(toastAdded({ kind: 'error', title: 'Action failed', message: action.error?.message }));
  }
  return next(action);
};
