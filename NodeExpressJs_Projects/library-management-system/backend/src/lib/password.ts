import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';

const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;
export const hashPassword = (pw: string) => bcrypt.hash(pw, ROUNDS);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
export const sha256 = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export const passwordSchema = z.string()
  .min(8, 'At least 8 characters').max(72, 'At most 72 characters')
  .regex(/[a-z]/, 'Needs a lowercase letter').regex(/[A-Z]/, 'Needs an uppercase letter')
  .regex(/[0-9]/, 'Needs a digit');
