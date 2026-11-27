import multer from 'multer';
import { env } from '../config/env';
import { badRequest } from './errors';
import { sha256 } from './password';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Identify the real format from magic bytes - the client-supplied mimetype is not trusted. */
export function sniffImage(buf: Buffer): (typeof ALLOWED_IMAGE_TYPES)[number] | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export interface ValidImage { mime: string; size: number; sha: string; data: Buffer }
export function validateImage(file: Express.Multer.File | undefined): ValidImage | null {
  if (!file) return null;
  if (file.size > env.MAX_UPLOAD_BYTES) throw badRequest(`Image must be at most ${Math.round(env.MAX_UPLOAD_BYTES / 1024)} KB`);
  const mime = sniffImage(file.buffer);
  if (!mime) throw badRequest('File is not a valid JPEG, PNG or WebP image');
  return { mime, size: file.size, sha: sha256(file.buffer), data: file.buffer };
}

/** Memory storage: bytes go straight into MySQL, nothing is written to disk. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1, fields: 40 },
  fileFilter: (_req, file, cb) => {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
      return cb(badRequest('Only JPEG, PNG or WebP images are accepted'));
    }
    cb(null, true);
  },
});
export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});
