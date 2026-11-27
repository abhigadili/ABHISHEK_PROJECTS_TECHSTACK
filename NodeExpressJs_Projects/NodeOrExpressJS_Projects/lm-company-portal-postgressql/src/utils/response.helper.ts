// ============================================================
// WHAT: Helpers for sending consistent API responses
// WHY:  A uniform response shape (success, message, data) makes
//       frontend integration predictable and simplifies error handling.
// ============================================================

import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types';
import { HTTP_STATUS } from '../constants';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = HTTP_STATUS.OK,
  meta?: PaginationMeta
): Response => {
  const body: ApiResponse<T> = { success: true, message, data, ...(meta && { meta }) };
  return res.status(statusCode).json(body);
};

export const sendCreated = <T>(res: Response, data: T, message = 'Created successfully'): Response => {
  const body: ApiResponse<T> = { success: true, message, data };
  return res.status(HTTP_STATUS.CREATED).json(body);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = HTTP_STATUS.INTERNAL_ERROR,
  error?: string
): Response => {
  const body: ApiResponse = { success: false, message, ...(error && { error }) };
  return res.status(statusCode).json(body);
};

export const buildPaginationMeta = (
  total: number,
  page: number,
  pageSize: number
): PaginationMeta => ({
  total,
  page,
  pageSize,
  totalPages: Math.ceil(total / pageSize),
});
