import { createHash, randomBytes, randomInt } from 'node:crypto';
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const randomCode = (len = 8) => Array.from(randomBytes(len), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
/** 10-digit PNR (unique constraint in the database is the real guarantee). */
export const generatePnr = () => String(randomInt(1_000_000_000, 9_999_999_999));
export const reference = (prefix: string) => `${prefix}-${randomCode(12)}`;
