import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createAppThunk } from '../thunk';
import { authApi } from '@/services/authApi';
import { tokenStore } from '@/api/tokenStore';
import { errorMessage } from '@/api/errors';
import { refreshSession } from '@/api/httpClient';
import type { CurrentUser, SessionUser } from '@/types/api';

export interface AuthState {
  /** `idle` until bootstrap finished; `loading` during login/bootstrap. */
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  user: SessionUser | null;
  profile: CurrentUser | null;
  error: string | null;
  /** True once the start-up session restore has settled (success OR failure). A later login attempt must NOT flip it back. */
  bootstrapped: boolean;
}

export const initialAuthState: AuthState = {
  status: 'idle',
  user: null,
  profile: null,
  error: null,
  bootstrapped: false,
};

/** Called once at start-up: if a refresh token survived the reload, trade it for a fresh session. */
export const bootstrapSession = createAppThunk(
  'auth/bootstrap',
  async (_, { rejectWithValue }) => {
    if (!tokenStore.hasRefresh()) return null;
    try {
      await refreshSession();
      return await authApi.me();
    } catch (e) {
      tokenStore.clear();
      return rejectWithValue(errorMessage(e));
    }
  },
  {
    // run exactly once: not again after it settled (re-mounts, StrictMode's double effect) and never while another run is in flight
    condition: (_, { getState }) => {
      const { bootstrapped, status } = getState().auth;
      return !bootstrapped && status !== 'loading';
    },
  },
);

export const login = createAppThunk(
  'auth/login',
  async (cred: { identifier: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await authApi.login(cred.identifier, cred.password);
      tokenStore.setTokens(res);
      const profile = await authApi.me();
      return { user: res.user, profile };
    } catch (e) {
      tokenStore.clear();
      return rejectWithValue(errorMessage(e));
    }
  },
);

/** Logout always succeeds locally even when the network call fails: a user must never be stuck signed in. */
export const logout = createAppThunk('auth/logout', async () => {
  const refreshToken = tokenStore.getRefresh();
  try {
    if (refreshToken) await authApi.logout(refreshToken);
  } catch {
    /* the server-side revoke is best-effort */
  }
  tokenStore.clear();
});

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    /** Dispatched by the HTTP layer when the refresh token is rejected (session unrecoverable). */
    sessionExpired(state) {
      state.status = 'unauthenticated';
      state.user = null;
      state.profile = null;
      state.error = 'Your session has expired. Please sign in again.';
    },
    clearAuthError(state) {
      state.error = null;
    },
    profileUpdated(state, action: PayloadAction<CurrentUser['employee']>) {
      if (state.profile) state.profile.employee = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapSession.pending, (s) => {
        s.status = 'loading';
      })
      .addCase(bootstrapSession.fulfilled, (s, a) => {
        s.bootstrapped = true;
        if (a.payload) {
          s.status = 'authenticated';
          s.profile = a.payload;
          s.user = {
            id: a.payload.id,
            email: a.payload.email,
            role: a.payload.role,
            employeeId: a.payload.employee?.id ?? null,
          };
        } else {
          s.status = 'unauthenticated';
        }
      })
      .addCase(bootstrapSession.rejected, (s) => {
        s.status = 'unauthenticated';
        s.user = null;
        s.profile = null;
      })
      .addCase(login.pending, (s) => {
        s.status = 'loading';
        s.error = null;
      })
      .addCase(login.fulfilled, (s, a) => {
        s.status = 'authenticated';
        s.user = a.payload.user;
        s.profile = a.payload.profile;
        s.error = null;
      })
      .addCase(login.rejected, (s, a) => {
        s.status = 'unauthenticated';
        s.error = a.payload ?? 'Sign-in failed';
      })
      .addCase(logout.fulfilled, (s) => {
        s.status = 'unauthenticated';
        s.user = null;
        s.profile = null;
        s.error = null;
      });
  },
});

export const { sessionExpired, clearAuthError, profileUpdated } = authSlice.actions;
export default authSlice.reducer;
