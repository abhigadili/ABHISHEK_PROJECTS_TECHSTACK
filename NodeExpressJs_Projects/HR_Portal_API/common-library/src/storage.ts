import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from './config';
import { ForbiddenError, NotFoundError } from './errors';

export interface StoredFile { storagePath: string; sha256: string; sizeBytes: number }

/** Configurable file storage abstraction; the local implementation is stream-based and traversal-safe. */
export interface FileStorage {
  save(relativeDir: string, fileName: string, data: Buffer | Readable): Promise<StoredFile>;
  open(storagePath: string): Promise<Readable>;
  remove(storagePath: string): Promise<void>;
}

class HashingTransform extends Transform {
  readonly hash = crypto.createHash('sha256');
  size = 0;
  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: (e?: Error | null, d?: Buffer) => void): void {
    this.hash.update(chunk); this.size += chunk.length; cb(null, chunk);
  }
}

export class LocalFileStorage implements FileStorage {
  constructor(private readonly root = config.storageDir) {}

  private resolve(rel: string): string {
    const abs = path.resolve(this.root, rel);
    if (abs !== this.root && !abs.startsWith(this.root + path.sep)) throw new ForbiddenError('Illegal storage path');
    return abs;
  }

  async save(relativeDir: string, fileName: string, data: Buffer | Readable): Promise<StoredFile> {
    const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-120) || 'file';
    const rel = path.join(relativeDir, `${crypto.randomUUID()}-${safe}`);
    const abs = this.resolve(rel);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    const hasher = new HashingTransform();
    await pipeline(Buffer.isBuffer(data) ? Readable.from([data]) : data, hasher, fs.createWriteStream(abs, { mode: 0o640 }));
    return { storagePath: rel, sha256: hasher.hash.digest('hex'), sizeBytes: hasher.size };
  }

  async open(storagePath: string): Promise<Readable> {
    const abs = this.resolve(storagePath);
    try { await fsp.access(abs); } catch { throw new NotFoundError('Stored file'); }
    return fs.createReadStream(abs);
  }

  async remove(storagePath: string): Promise<void> {
    await fsp.rm(this.resolve(storagePath), { force: true });
  }
}
export const fileStorage: FileStorage = new LocalFileStorage();
