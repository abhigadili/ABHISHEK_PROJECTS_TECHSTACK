import { http } from '@/api/httpClient';
import type { CurrentUser, LoginResponse, RegistrationOptions, RegistrationResult } from '@/types/api';

interface Envelope<T> {
  data: T;
  message: string;
}

export const authApi = {
  /** `identifier` is a username or an e-mail: the backend takes `email` or `username` (an '@' can never be part of a username). */
  login: async (identifier: string, password: string) => {
    const who = identifier.includes('@')
      ? { email: identifier.trim() }
      : { username: identifier.trim().toLowerCase() };
    return (
      await http.post<Envelope<LoginResponse>>('/auth/login', { ...who, password }, { skipGlobalError: true })
    ).data.data;
  },
  /** Public self-registration: multipart/form-data (optional picture in field `file`). confirmPassword is NOT sent. */
  register: async (form: FormData) =>
    (await http.post<Envelope<RegistrationResult>>('/auth/register', form, { skipGlobalError: true })).data,
  registrationOptions: async (signal?: AbortSignal) =>
    (
      await http.get<Envelope<RegistrationOptions>>('/auth/registration-options', {
        signal,
        skipGlobalError: true,
      })
    ).data.data,
  usernameAvailable: async (username: string, signal?: AbortSignal) =>
    (
      await http.get<Envelope<{ available: boolean }>>('/auth/username-available', {
        params: { username },
        signal,
        skipGlobalError: true,
      })
    ).data.data.available,
  logout: (refreshToken: string) => http.post('/auth/logout', { refreshToken }, { skipGlobalError: true }),
  logoutAll: () => http.post('/auth/logout-all'),
  me: async (signal?: AbortSignal) =>
    (await http.get<Envelope<CurrentUser>>('/auth/me', { signal })).data.data,
  forgotPassword: async (email: string) =>
    (
      await http.post<Envelope<{ resetToken?: string } | null>>(
        '/auth/forgot-password',
        { email },
        { skipGlobalError: true },
      )
    ).data,
  resetPassword: (token: string, newPassword: string) =>
    http.post('/auth/reset-password', { token, newPassword }, { skipGlobalError: true }),
  changePassword: (currentPassword: string, newPassword: string) =>
    http.post('/auth/change-password', { currentPassword, newPassword }, { skipGlobalError: true }),
};
