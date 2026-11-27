import { z } from 'zod';

export const PHONE_RE = /^[+\d][\d\s().-]{5,28}$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const CODE_RE = /^[A-Z0-9_-]+$/;

/** An optional text field coming from an <input>: '' means "not provided". */
export const optionalText = (max: number) => z.string().trim().max(max, `At most ${max} characters`);
export const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `At most ${max} characters`);

export const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address');
export const requiredEmail = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(190);
export const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || PHONE_RE.test(v), 'Enter a valid phone number, e.g. +1 555 0100');
export const optionalDate = z.string().refine((v) => v === '' || ISO_DATE_RE.test(v), 'Use a valid date');
export const requiredDate = (label: string) =>
  z.string().min(1, `${label} is required`).regex(ISO_DATE_RE, 'Use a valid date');

/** Mirrors the backend policy (10-72 chars, upper + lower + digit + special). The backend remains the final authority. */
export const passwordSchema = z
  .string()
  .min(10, 'At least 10 characters')
  .max(72, 'At most 72 characters')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/\d/, 'Add a digit')
  .regex(/[^A-Za-z0-9]/, 'Add a special character');

export const isBefore = (a: string, b: string) => a !== '' && b !== '' && a > b; // YYYY-MM-DD strings compare lexicographically
