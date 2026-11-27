import { createActionGroup, createFeature, createReducer, emptyProps, on, props } from '@ngrx/store';
import type { UserResponse } from '../../api/types/auth';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';
export interface AuthState { status: AuthStatus; user: UserResponse | null; mustChangePassword: boolean; loggingIn: boolean; error: string | null }
const initialState: AuthState = { status: 'unknown', user: null, mustChangePassword: false, loggingIn: false, error: null };

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    'Resume Requested': emptyProps(),
    'Login Requested': props<{ username: string; password: string }>(),
    'Login Succeeded': props<{ user: UserResponse; mustChangePassword: boolean }>(),
    'Login Failed': props<{ message: string }>(),
    'Profile Refreshed': props<{ user: UserResponse }>(),
    'Logout Requested': emptyProps(),
    'Session Ended': emptyProps(),
    'Session Expired': emptyProps(),
  },
});

/** Authentication + permission state (the /auth/me profile carries roles and permissions). Server data other than this lives in TanStack Query. */
export const authFeature = createFeature({
  name: 'auth',
  reducer: createReducer(
    initialState,
    on(AuthActions.loginRequested, (s) => ({ ...s, loggingIn: true, error: null })),
    on(AuthActions.loginSucceeded, (s, a) => ({ ...s, status: 'authenticated' as const, user: a.user, mustChangePassword: a.mustChangePassword, loggingIn: false, error: null })),
    on(AuthActions.loginFailed, (s, a) => ({ ...s, loggingIn: false, error: a.message })),
    on(AuthActions.profileRefreshed, (s, a) => ({ ...s, user: a.user, mustChangePassword: !!a.user.mustChangePassword })),
    on(AuthActions.sessionEnded, AuthActions.sessionExpired, () => ({ ...initialState, status: 'anonymous' as const })),
  ),
});
export const { selectStatus, selectUser, selectMustChangePassword, selectLoggingIn, selectError } = authFeature;
