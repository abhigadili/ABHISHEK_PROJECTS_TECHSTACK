import 'server-only';
import { apiFetch } from './api-client';
import { loginResponseSchema, registrationOptionsSchema, registrationResultSchema, tokenPairSchema } from '@/schemas/api';
import { z } from 'zod';

/** Thin wrappers over the Express auth endpoints. They never touch cookies: callers (actions/handlers/proxy) decide where tokens go. */
export const login = (identifier: string, password: string) =>
  apiFetch('/auth/login', {
    method: 'POST', auth: false, schema: loginResponseSchema,
    // '@' can never be part of a username, so it tells the two identifiers apart
    body: identifier.includes('@') ? { email: identifier.trim(), password } : { username: identifier.trim().toLowerCase(), password },
  }).then((r) => r.data);

export const refreshTokens = (refreshToken: string) =>
  apiFetch('/auth/refresh', { method: 'POST', auth: false, schema: tokenPairSchema, body: { refreshToken } }).then((r) => r.data);

export const revokeRefreshToken = (refreshToken: string) =>
  apiFetch('/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }).catch(() => null); // best effort

export const forgotPassword = (email: string) =>
  apiFetch('/auth/forgot-password', { method: 'POST', auth: false, body: { email }, schema: z.object({ resetToken: z.string() }).nullable() }).then((r) => r.data);

export const resetPassword = (token: string, newPassword: string) => apiFetch('/auth/reset-password', { method: 'POST', auth: false, body: { token, newPassword } });
export const changePassword = (currentPassword: string, newPassword: string) => apiFetch('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
export const registrationOptions = () => apiFetch('/auth/registration-options', { auth: false, schema: registrationOptionsSchema, cache: { revalidate: 300, tags: ['registration-options'] } }).then((r) => r.data);
export const usernameAvailable = (username: string) =>
  apiFetch('/auth/username-available', { auth: false, query: { username }, schema: z.object({ available: z.boolean() }) }).then((r) => r.data.available);
export const register = (form: FormData) => apiFetch('/auth/register', { method: 'POST', auth: false, body: form, schema: registrationResultSchema }).then((r) => r.data);
