import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { doctorsReducer } from '@/store/slices/doctorsSlice';
import { appointmentsUiReducer } from '@/store/slices/appointmentsSlice';

/** Redux Middleware: dev-only action logger (collapsed) - shows where custom middleware plugs into configureStore. */
const actionLogger: Middleware = () => (next) => (action) => {
  if (process.env.NODE_ENV === 'development' && typeof action === 'object' && action && 'type' in action && !String(action.type).includes('/pending')) console.debug('[redux]', (action as { type: string }).type);
  return next(action);
};

/** Store factory (one store per browser session, created in the provider - never a module singleton, so SSR requests never share state). */
export const makeStore = () => configureStore({ reducer: { doctors: doctorsReducer, appointmentsUi: appointmentsUiReducer }, middleware: (gdm) => gdm().concat(actionLogger), devTools: process.env.NODE_ENV !== 'production' });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
