import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createAppThunk } from '../thunk';
import { notificationApi } from '@/services/notificationApi';
import { errorMessage } from '@/api/errors';

/**
 * The header badge needs the unread count on EVERY screen and refreshes on a timer, so it lives in Redux
 * (cross-feature + polled). The notification LIST is RTK Query; mutating it dispatches `refreshUnreadCount`.
 */
export const refreshUnreadCount = createAppThunk(
  'notifications/refreshUnread',
  async (_, { rejectWithValue }) => {
    try {
      return await notificationApi.unreadCount();
    } catch (e) {
      return rejectWithValue(errorMessage(e));
    }
  },
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: { unread: 0, lastCheckedAt: null as string | null, error: null as string | null },
  reducers: {
    setUnread(s, a: PayloadAction<number>) {
      s.unread = Math.max(0, a.payload);
    },
    decrementUnread(s, a: PayloadAction<number>) {
      s.unread = Math.max(0, s.unread - a.payload);
    },
  },
  extraReducers: (b) => {
    b.addCase(refreshUnreadCount.fulfilled, (s, a) => {
      s.unread = a.payload;
      s.lastCheckedAt = new Date().toISOString();
      s.error = null;
    }).addCase(refreshUnreadCount.rejected, (s, a) => {
      s.error = a.payload ?? null;
    });
  },
});
export const { setUnread, decrementUnread } = notificationSlice.actions;
export default notificationSlice.reducer;
