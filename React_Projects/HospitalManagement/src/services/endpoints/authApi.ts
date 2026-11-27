import axios from 'axios';
import { API_PREFIX, config } from '@/constants/config';
import { http } from '@/services/api/http';
import { toApiError } from '@/services/axios/errors';
import type { CreateUserRequest, LoginRequest, RegisterAccountRequest, TokenResponse, UserAccount } from '@/types';

/**
 * Auth endpoints (Hospital Service = identity authority).
 * login/register carry no token, so they use `skipAuth` and never trigger the refresh machinery.
 */
export const authApi = {
  login: (body: LoginRequest) => http.post<TokenResponse>('/auth/login', body, { skipAuth: true }),
  register: (body: RegisterAccountRequest) => http.post<UserAccount>('/auth/register', body, { skipAuth: true }),
  me: (signal?: AbortSignal) => http.get<UserAccount>('/auth/me', undefined, signal),
  /** Revoke the refresh-token family. Plain axios: the access token may already be expired. */
  logout: async (refreshToken: string): Promise<void> => {
    try {
      await axios.post(`${API_PREFIX}/auth/logout`, { refreshToken }, { timeout: config.timeoutMs });
    } catch (e) {
      throw toApiError(e);
    }
  },
  users: {
    list: (signal?: AbortSignal) => http.get<UserAccount[]>('/users', undefined, signal),
    create: (body: CreateUserRequest) => http.post<UserAccount>('/users', body),
    setEnabled: (id: number, enabled: boolean) => http.patch<UserAccount>(`/users/${id}/enabled`, { enabled }),
  },
};
