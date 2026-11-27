import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from '@/app/store/store';

/** Typed `createAsyncThunk`: thunks can read RootState and always reject with a plain string message (serialisable). */
export const createAppThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: string;
}>();
