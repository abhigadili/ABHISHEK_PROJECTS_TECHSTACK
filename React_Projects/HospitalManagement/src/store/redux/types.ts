import type { QueryClient } from '@tanstack/react-query';
import type { store } from '@/app/store';

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
/** Shared createAsyncThunk config: typed state + the QueryClient injected as thunk `extra`. */
export interface AppThunkConfig {
  state: RootState;
  dispatch: AppDispatch;
  extra: { queryClient: QueryClient };
}
