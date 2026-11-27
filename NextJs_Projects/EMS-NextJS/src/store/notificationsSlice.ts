import { createAsyncThunk, createEntityAdapter, createSelector, createSlice } from '@reduxjs/toolkit';
import type { AppNotification } from '@/schemas/api';
import type { RootState } from './index';

/** Normalised state ({ids, entities}) via an entity adapter; the BFF route handler `/api/notifications` is the only data source. */
const adapter = createEntityAdapter<AppNotification>({ sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt) });

export const fetchNotifications = createAsyncThunk<{ items: AppNotification[]; unread: number }, void, { rejectValue: string }>(
  'notifications/fetch',
  async (_, { rejectWithValue, signal }) => {
    const res = await fetch('/api/notifications?limit=8', { signal, cache: 'no-store' });
    if (!res.ok) return rejectWithValue(res.status === 401 ? 'signed-out' : 'failed');
    return res.json();
  },
);
export const markAllRead = createAsyncThunk<void, void, { rejectValue: string }>('notifications/markAllRead', async (_, { rejectWithValue }) => {
  const res = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!res.ok) return rejectWithValue('failed');
});

const slice = createSlice({
  name: 'notifications',
  initialState: adapter.getInitialState({ unread: 0, status: 'idle' as 'idle' | 'loading' | 'ready' | 'failed' }),
  reducers: { /** optimistic: flip locally first, the thunk rolls back via refetch if the server refuses */ markedReadLocally: (s) => { adapter.updateMany(s, s.ids.map((id) => ({ id, changes: { isRead: true } }))); s.unread = 0; } },
  extraReducers: (b) => {
    b.addCase(fetchNotifications.pending, (s) => { s.status = 'loading'; })
      .addCase(fetchNotifications.fulfilled, (s, a) => { s.status = 'ready'; adapter.setAll(s, a.payload.items); s.unread = a.payload.unread; })
      .addCase(fetchNotifications.rejected, (s) => { s.status = 'failed'; });
  },
});
export const { markedReadLocally } = slice.actions;
export default slice.reducer;

const sel = adapter.getSelectors((s: RootState) => s.notifications);
export const selectNotifications = sel.selectAll;
export const selectUnread = (s: RootState) => s.notifications.unread;
export const selectUnreadItems = createSelector(sel.selectAll, (all) => all.filter((n) => !n.isRead));
