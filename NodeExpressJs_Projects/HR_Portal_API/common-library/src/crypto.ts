import crypto from 'node:crypto';
import { env } from './config';
import { ValidationError } from './errors';

/**
 * Column-level encryption for sensitive personal data (PAN, bank account, tax number).
 * Format: "enc1:" + base64(iv[12] | ciphertext | tag[16]) using AES-256-GCM and FIELD_ENCRYPTION_KEY (base64, 32 bytes).
 * Values written by the Java service use a different envelope and are treated as opaque: they are never
 * decrypted, displayed or overwritten implicitly by this service.
 */
const PREFIX = 'enc1:';

function key(): Buffer {
  const k = Buffer.from(env('FIELD_ENCRYPTION_KEY'), 'base64');
  if (k.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes (base64)');
  return k;
}

export function encryptField(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === '') return null;
  if (!process.env.FIELD_ENCRYPTION_KEY) throw new ValidationError('Sensitive field storage is not configured on this server');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64');
}

export const isNodeEncrypted = (v: string | null | undefined): boolean => !!v && v.startsWith(PREFIX);

/** Returns plaintext, or null when the stored value is absent or was encrypted by another system. */
export function decryptField(stored: string | null | undefined): string | null {
  if (!stored || !isNodeEncrypted(stored) || !process.env.FIELD_ENCRYPTION_KEY) return null;
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(raw.length - 16));
    return Buffer.concat([d.update(raw.subarray(12, raw.length - 16)), d.final()]).toString('utf8');
  } catch { return null; }
}

/** Display value: masked plaintext for Node-encrypted values, a fixed placeholder for opaque ones. */
export function displayField(stored: string | null | undefined, reveal = false): string | null {
  if (!stored) return null;
  const plain = decryptField(stored);
  if (plain === null) return '[protected]';
  return reveal ? plain : `${'*'.repeat(Math.max(0, plain.length - 4))}${plain.slice(-4)}`;
}
