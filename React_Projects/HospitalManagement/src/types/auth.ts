import type { Role } from './common';

export interface UserAccount {
  id: number;
  username: string;
  email: string;
  role: Role;
  enabled: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  user: UserAccount;
}

export interface RegisterAccountRequest {
  username: string;
  email: string;
  password: string;
}

export interface CreateUserRequest extends RegisterAccountRequest {
  role: Role;
}

/** Claims the gateway puts into the HS256 access token (read-only, never trusted for security decisions). */
export interface AccessTokenClaims {
  sub: string;
  preferred_username?: string;
  email?: string;
  roles?: string[] | string;
  iss?: string;
  aud?: string | string[];
  iat: number;
  exp: number;
  jti?: string;
}

export interface Session {
  user: UserAccount;
  /** epoch ms at which the access token expires */
  accessTokenExpiresAt: number;
}
