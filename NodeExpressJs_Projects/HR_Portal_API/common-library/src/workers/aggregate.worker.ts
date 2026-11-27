import { parentPort, workerData } from 'node:worker_threads';

/** CPU-heavy group/sum aggregation executed off the event loop. */
interface Job { rows: Record<string, any>[]; groupBy: string[]; sums: string[] }
const { rows, groupBy, sums } = workerData as Job;
const groups = new Map<string, Record<string, any>>();
for (const r of rows) {
  const k = groupBy.map((g) => String(r[g] ?? '')).join('|');
  let g = groups.get(k);
  if (!g) { g = { count: 0 }; for (const f of groupBy) g[f] = r[f]; for (const s of sums) g[s] = 0; groups.set(k, g); }
  g.count += 1;
  for (const s of sums) g[s] += Number(r[s]) || 0;
}
parentPort!.postMessage([...groups.values()]);
