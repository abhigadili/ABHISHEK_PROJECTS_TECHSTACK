import { configureStore } from '@reduxjs/toolkit';
import doctorFilters from '@/store/slices/doctorFiltersSlice';
import billingUi from '@/store/slices/billingUiSlice';
import layout from '@/store/slices/layoutSlice';
import { queryClient } from './queryClient';

/** Redux Toolkit store. The QueryClient is injected as the thunk `extra` argument so thunks can invalidate server state. */
export const store = configureStore({
  reducer: { doctorFilters, billingUi, layout },
  middleware: (getDefault) => getDefault({ thunk: { extraArgument: { queryClient } } }),
  devTools: import.meta.env.DEV,
});
