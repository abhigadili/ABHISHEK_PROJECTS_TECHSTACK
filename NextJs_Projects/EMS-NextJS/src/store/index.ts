import { configureStore, isRejected, type Middleware } from '@reduxjs/toolkit';
import notifications from './notificationsSlice';
import ui from './uiSlice';

/**
 * Redux Toolkit is used ONLY for client UI state that several distant client components share and that changes over time:
 *  - the notification bell/badge (polled, optimistic mark-as-read)  - mobile sidebar visibility
 * Server data (employees, leave …) is fetched by Server Components and is deliberately NOT mirrored here.
 * A NEW store per request/provider mount (a module-level singleton would leak state between users during SSR).
 */
/**
 * Custom middleware: observes every dispatched action. Here it reports rejected async thunks in development (never in production, and
 * never the payload — only the action type — so nothing sensitive is logged). RTK's default middleware (thunk, immutability and
 * serializability checks in dev) stays enabled.
 */
export const rejectedThunkLogger: Middleware = () => (next) => (action) => {
  if (process.env.NODE_ENV !== 'production' && isRejected(action)) console.warn('[redux] thunk rejected:', (action as { type: string }).type);
  return next(action);
};

export const makeStore = () => configureStore({
  reducer: { notifications, ui },
  middleware: (getDefault) => getDefault().concat(rejectedThunkLogger),
  devTools: process.env.NODE_ENV !== 'production', // Redux DevTools extension in dev only
});
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
