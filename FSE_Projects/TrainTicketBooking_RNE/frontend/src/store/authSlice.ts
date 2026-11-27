import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api, post, refreshSession, toApiError } from '@/services/api';
import { tokenStore } from '@/services/tokenStore';
import type { RoleKey, User } from '@/types';

interface AuthState { user: User | null; status: 'idle' | 'loading' | 'ready'; error: string | null }
const initialState: AuthState = { user: null, status: 'idle', error: null };

/** App start: try to restore the session from the HttpOnly refresh cookie. */
export const bootstrapSession = createAsyncThunk('auth/bootstrap', async () => {
  try { const d = await refreshSession(); tokenStore.set(d.accessToken); return d.user; } catch { return null; }
}, {
  // React StrictMode runs effects twice in dev: a 2nd refresh would replay the single-use cookie and trip reuse-detection.
  condition: (_arg, { getState }) => (getState() as { auth: AuthState }).auth.status === 'idle',
});
export const loginThunk = createAsyncThunk('auth/login', async (cred: { email: string; password: string }, { rejectWithValue }) => {
  try { const d = await post<{ user: User; accessToken: string }>('/auth/login', cred); tokenStore.set(d.accessToken); return d.user; }
  catch (e) { return rejectWithValue(toApiError(e).message); }
});
export const logoutThunk = createAsyncThunk('auth/logout', async () => { try { await api.post('/auth/logout'); } finally { tokenStore.set(null); } });

const slice = createSlice({
  name: 'auth', initialState,
  reducers: {
    userUpdated: (s, a: PayloadAction<User>) => { s.user = a.payload; },
    sessionExpired: (s) => { s.user = null; s.error = 'Your session has expired. Please sign in again.'; },
    clearError: (s) => { s.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(bootstrapSession.pending, (s) => { s.status = 'loading'; })
      .addCase(bootstrapSession.fulfilled, (s, a) => { s.user = a.payload; s.status = 'ready'; })
      .addCase(loginThunk.pending, (s) => { s.error = null; })
      .addCase(loginThunk.fulfilled, (s, a) => { s.user = a.payload; s.error = null; })
      .addCase(loginThunk.rejected, (s, a) => { s.error = (a.payload as string) ?? 'Login failed'; })
      .addCase(logoutThunk.fulfilled, (s) => { s.user = null; })
      .addCase(logoutThunk.rejected, (s) => { s.user = null; });
  },
});
export const { userUpdated, sessionExpired, clearError } = slice.actions;
export default slice.reducer;
export const hasRole = (u: User | null, ...roles: RoleKey[]) => !!u && roles.some((r) => u.roles.includes(r));
export const isStaffLike = (u: User | null) => hasRole(u, 'ADMIN', 'BOOKING_STAFF', 'TRAIN_OPERATOR');
