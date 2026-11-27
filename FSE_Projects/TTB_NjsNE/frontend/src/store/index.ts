import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, useStore } from 'react-redux';
import bookingReducer from './bookingSlice';
import { catalogApi } from './api';
import { errorToast, persistBookingFlow } from './middleware';
import uiReducer from './uiSlice';

/** Store FACTORY (not a singleton): on the server every request must get its own store or state would leak between users. */
export const makeStore = () => configureStore({
  reducer: { bookingFlow: bookingReducer, ui: uiReducer, [catalogApi.reducerPath]: catalogApi.reducer },
  middleware: (gdm) => gdm().concat(catalogApi.middleware, persistBookingFlow, errorToast),
});
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
