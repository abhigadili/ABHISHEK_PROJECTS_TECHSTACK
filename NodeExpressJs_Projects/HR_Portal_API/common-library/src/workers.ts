import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { PdfDoc } from './workers/pdf.worker';

/** Run a compiled worker script on a Worker Thread and resolve with its first message. */
export function runWorker<T>(file: string, workerData: unknown, timeoutMs = 30000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const w = new Worker(file, { workerData });
    const t = setTimeout(() => { void w.terminate(); reject(new Error('Worker timed out')); }, timeoutMs);
    w.once('message', (m) => { clearTimeout(t); resolve(m as T); });
    w.once('error', (e) => { clearTimeout(t); reject(e); });
    w.once('exit', (c) => { if (c !== 0) { clearTimeout(t); reject(new Error(`Worker exited with ${c}`)); } });
  });
}

export const aggregateInWorker = <T = Record<string, any>>(rows: Record<string, any>[], groupBy: string[], sums: string[]): Promise<T[]> =>
  runWorker<T[]>(path.join(__dirname, 'workers', 'aggregate.worker.js'), { rows, groupBy, sums });

export async function renderPdf(doc: PdfDoc): Promise<Buffer> {
  const out = await runWorker<Uint8Array>(path.join(__dirname, 'workers', 'pdf.worker.js'), doc);
  return Buffer.from(out);
}
export type { PdfDoc };
