import { createSlice } from '@reduxjs/toolkit';
import { createAppThunk } from '../thunk';
import { attendanceApi } from '@/services/attendanceApi';
import { errorMessage } from '@/api/errors';
import { emsApi } from '../api/emsApi';
import { today } from '@/utils/format';
import type { AttendanceRecord, WorkMode } from '@/types/api';

interface State {
  today: AttendanceRecord | null;
  status: 'idle' | 'loading' | 'ready';
  /** `checking-in` / `checking-out` while a command is in flight → buttons disable, no double submit. */
  action: 'checking-in' | 'checking-out' | null;
  error: string | null;
}
const initialState: State = { today: null, status: 'idle', action: null, error: null };

const invalidateAttendance = (dispatch: (a: unknown) => unknown) =>
  dispatch(emsApi.util.invalidateTags([{ type: 'Attendance', id: 'LIST' }]));

export const loadToday = createAppThunk('attendance/loadToday', async (_, { rejectWithValue }) => {
  try {
    const d = today();
    const page = await attendanceApi.mine({ from: d, to: d, limit: 1 });
    return page.items[0] ?? null;
  } catch (e) {
    return rejectWithValue(errorMessage(e));
  }
});

export const checkIn = createAppThunk(
  'attendance/checkIn',
  async (arg: { workMode?: WorkMode; remarks?: string }, { dispatch, rejectWithValue }) => {
    try {
      const rec = await attendanceApi.checkIn(arg.workMode, arg.remarks);
      invalidateAttendance(dispatch);
      return rec;
    } catch (e) {
      return rejectWithValue(errorMessage(e));
    }
  },
);

export const checkOut = createAppThunk(
  'attendance/checkOut',
  async (remarks: string | undefined, { dispatch, rejectWithValue }) => {
    try {
      const rec = await attendanceApi.checkOut(remarks);
      invalidateAttendance(dispatch);
      return rec;
    } catch (e) {
      return rejectWithValue(errorMessage(e));
    }
  },
);

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {
    clearAttendanceError(s) {
      s.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(loadToday.pending, (s) => {
      s.status = 'loading';
    })
      .addCase(loadToday.fulfilled, (s, a) => {
        s.status = 'ready';
        s.today = a.payload;
      })
      .addCase(loadToday.rejected, (s, a) => {
        s.status = 'ready';
        s.error = a.payload ?? null;
      })
      .addCase(checkIn.pending, (s) => {
        s.action = 'checking-in';
        s.error = null;
      })
      .addCase(checkIn.fulfilled, (s, a) => {
        s.action = null;
        s.today = a.payload;
      })
      .addCase(checkIn.rejected, (s, a) => {
        s.action = null;
        s.error = a.payload ?? 'Check-in failed';
      })
      .addCase(checkOut.pending, (s) => {
        s.action = 'checking-out';
        s.error = null;
      })
      .addCase(checkOut.fulfilled, (s, a) => {
        s.action = null;
        s.today = a.payload;
      })
      .addCase(checkOut.rejected, (s, a) => {
        s.action = null;
        s.error = a.payload ?? 'Check-out failed';
      });
  },
});
export const { clearAttendanceError } = attendanceSlice.actions;
export default attendanceSlice.reducer;
