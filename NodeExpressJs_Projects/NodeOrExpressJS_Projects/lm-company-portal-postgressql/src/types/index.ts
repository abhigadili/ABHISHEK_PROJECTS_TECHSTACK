// ============================================================
// WHAT: Shared TypeScript types used across the application
// WHY:  Centralized types prevent duplication and keep the
//       interface contract consistent between layers.
// ============================================================

import { Request } from 'express';
import { Role, Permission } from '../constants';

// Authenticated request — after auth middleware adds user payload
// req.user is also augmented globally via src/types/express.d.ts
export type AuthRequest = Request;

// Shape of the JWT payload stored inside the token
// Interview Tip: Keep JWT payload small — it's base64 encoded, not encrypted.
//               Never store sensitive data (passwords, PII) in a JWT.
export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  permissions: Permission[];
  iat?: number;
  exp?: number;
}

// Standard API response wrapper
// WHY: Consistent shape makes frontend integration predictable.
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

// OAuth user profile normalised from Google/GitHub
export interface OAuthProfile {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}
