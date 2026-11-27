import { createSlice } from '@reduxjs/toolkit';
import { createAppThunk } from '../thunk';
import { dashboardApi } from '@/services/dashboardApi';
import { errorMessage, isApiError } from '@/api/errors';
import type { DashboardData } from '@/types/api';

export const fetchDashboard = createAppThunk('dashboard/fetch', async (_, { rejectWithValue, signal }) => {
  try {
    return await dashboardApi.get(signal);
  } catch (e) {
    // 403 is a normal outcome for EMPLOYEE accounts (the backend restricts /dashboard to managers and above)
    if (isApiError(e) && e.status === 403) return rejectWithValue('FORBIDDEN');
    return rejectWithValue(errorMessage(e));
  }
});

interface State {
  data: DashboardData | null;
  status: 'idle' | 'loading' | 'ready' | 'forbidden' | 'failed';
  error: string | null;
}
const initialState: State = { data: null, status: 'idle', error: null };

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: { resetDashboard: () => initialState },
  extraReducers: (b) => {
    b.addCase(fetchDashboard.pending, (s) => {
      s.status = 'loading';
      s.error = null;
    })
      .addCase(fetchDashboard.fulfilled, (s, a) => {
        s.status = 'ready';
        s.data = a.payload;
      })
      .addCase(fetchDashboard.rejected, (s, a) => {
        if (a.payload === 'FORBIDDEN') {
          s.status = 'forbidden';
          return;
        }
        s.status = 'failed';
        s.error = a.payload ?? 'Failed to load the dashboard';
      });
  },
});
export const { resetDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
