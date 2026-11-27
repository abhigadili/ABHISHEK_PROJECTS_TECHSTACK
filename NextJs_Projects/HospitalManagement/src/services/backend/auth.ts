import 'server-only';
import { backendFetch } from '@/lib/api/backend';
import type { LoginRequest, RegisterAccountRequest, TokenResponse, UserAccount } from '@/types';

export const authService = {
  login: (b: LoginRequest) => backendFetch<TokenResponse>('/api/auth/login', { method: 'POST', auth: 'none', body: b, cache: 'no-store', redirectOnUnauthorized: false }),
  register: (b: RegisterAccountRequest) => backendFetch<UserAccount>('/api/auth/register', { method: 'POST', auth: 'none', body: b, cache: 'no-store' }),
  refresh: (refreshToken: string) => backendFetch<TokenResponse>('/api/auth/refresh', { method: 'POST', auth: 'none', body: { refreshToken }, cache: 'no-store' }),
  logout: (refreshToken: string) => backendFetch<void>('/api/auth/logout', { method: 'POST', auth: 'none', body: { refreshToken }, cache: 'no-store', redirectOnUnauthorized: false }),
  me: () => backendFetch<UserAccount>('/api/auth/me', { cache: 'no-store' }),
  users: () => backendFetch<UserAccount[]>('/api/users', { cache: 'no-store' }),
  setEnabled: (id: number, enabled: boolean) => backendFetch<UserAccount>(`/api/users/${id}/enabled`, { method: 'PATCH', body: { enabled }, cache: 'no-store', redirectOnUnauthorized: false }),
  createUser: (b: RegisterAccountRequest & { role: string }) => backendFetch<UserAccount>('/api/users', { method: 'POST', body: b, cache: 'no-store', redirectOnUnauthorized: false }),
};
