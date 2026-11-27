import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import authReducer, { sessionExpired } from './authSlice';
import bookingReducer, { hydrate } from './bookingSlice';
import { catalogApi } from './api';
import { errorToast, loadBookingFlow, persistBookingFlow } from './middleware';
import uiReducer from './uiSlice';
import { setSessionExpiredHandler } from '@/services/api';

export const store = configureStore({
  reducer: { auth: authReducer, bookingFlow: bookingReducer, ui: uiReducer, [catalogApi.reducerPath]: catalogApi.reducer },
  middleware: (gdm) => gdm().concat(catalogApi.middleware, persistBookingFlow, errorToast),
});
const saved = loadBookingFlow(); if (saved) store.dispatch(hydrate(saved));
setSessionExpiredHandler(() => store.dispatch(sessionExpired()));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
