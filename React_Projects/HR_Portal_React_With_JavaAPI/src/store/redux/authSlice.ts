import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserResponse } from '@/api/types/auth';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';
interface AuthState { status: AuthStatus; user: UserResponse | null; mustChangePassword: boolean }
const initialState: AuthState = { status: 'unknown', user: null, mustChangePassword: false };

/** Authentication + permission state (user profile from /auth/me). Server data other than this stays in TanStack Query. */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionStarted(s, a: PayloadAction<{ user: UserResponse; mustChangePassword?: boolean }>) {
      s.status = 'authenticated'; s.user = a.payload.user; s.mustChangePassword = !!(a.payload.mustChangePassword ?? a.payload.user.mustChangePassword);
    },
    profileRefreshed(s, a: PayloadAction<UserResponse>) { s.user = a.payload; s.mustChangePassword = !!a.payload.mustChangePassword; },
    sessionEnded(s) { s.status = 'anonymous'; s.user = null; s.mustChangePassword = false; },
  },
});
export const { sessionStarted, profileRefreshed, sessionEnded } = authSlice.actions;
export default authSlice.reducer;
