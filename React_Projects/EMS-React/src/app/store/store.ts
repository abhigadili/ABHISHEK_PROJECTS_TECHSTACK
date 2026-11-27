import { combineReducers, configureStore, isRejected, type Middleware } from '@reduxjs/toolkit';
import authReducer, { initialAuthState, logout, sessionExpired } from '@/store/slices/authSlice';
import employeeReducer from '@/store/slices/employeeSlice';
import departmentReducer from '@/store/slices/departmentSlice';
import attendanceReducer from '@/store/slices/attendanceSlice';
import leaveReducer from '@/store/slices/leaveSlice';
import notificationReducer from '@/store/slices/notificationSlice';
import dashboardReducer from '@/store/slices/dashboardSlice';
import { emsApi } from '@/store/api/emsApi';
import { env } from '@/constants/env';

const appReducer = combineReducers({
  auth: authReducer,
  employees: employeeReducer,
  departments: departmentReducer,
  attendance: attendanceReducer,
  leave: leaveReducer,
  notifications: notificationReducer,
  dashboard: dashboardReducer,
  [emsApi.reducerPath]: emsApi.reducer,
});

/**
 * Root reducer wrapper: when the user logs out (or the session expires) EVERYTHING resets, so the next person who signs in on
 * this browser can never see the previous user's cached data.
 */
const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: { type: string }) => {
  if (logout.fulfilled.match(action as never) || sessionExpired.match(action as never)) {
    const keepAuth = sessionExpired.match(action as never) ? state?.auth : undefined; // keep the "session expired" banner message
    return appReducer(
      { auth: keepAuth ?? { ...initialAuthState, status: 'unauthenticated', bootstrapped: true } } as never,
      action as never,
    );
  }
  return appReducer(state, action as never);
};

/** Custom middleware example: logs rejected async thunks in development (never in production builds). */
const rejectedThunkLogger: Middleware = () => (next) => (action) => {
  if (env.isDev && import.meta.env.MODE !== 'test' && isRejected(action))
    console.debug(
      '[redux] rejected',
      (action as { type: string }).type,
      (action as { payload?: unknown }).payload,
    );
  return next(action);
};

export function makeStore(preloadedState?: Partial<ReturnType<typeof appReducer>>) {
  return configureStore({
    reducer: rootReducer as unknown as typeof appReducer,
    preloadedState: preloadedState as never,
    middleware: (getDefault) => getDefault().concat(emsApi.middleware, rejectedThunkLogger),
    devTools: env.isDev, // Redux DevTools extension is wired automatically in development
  });
}

export const store = makeStore();
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof appReducer>;
export type AppDispatch = AppStore['dispatch'];
