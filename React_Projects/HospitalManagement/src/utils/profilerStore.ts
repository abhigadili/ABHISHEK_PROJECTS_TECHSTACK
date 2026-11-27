import type { ProfilerOnRenderCallback } from 'react';

/** Collects React <Profiler> measurements so the Render Profiler page (admin) can display them. */
export interface ProfileSample {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  at: number;
}
export interface ProfileAggregate {
  id: string;
  commits: number;
  mounts: number;
  updates: number;
  totalActual: number;
  maxActual: number;
  lastActual: number;
  lastBase: number;
}

const samples = new Map<string, ProfileAggregate>();
const listeners = new Set<() => void>();
let snapshot: ProfileAggregate[] = [];

export const onProfileRender: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration) => {
  const a = samples.get(id) ?? { id, commits: 0, mounts: 0, updates: 0, totalActual: 0, maxActual: 0, lastActual: 0, lastBase: 0 };
  a.commits += 1;
  if (phase === 'mount') a.mounts += 1;
  else a.updates += 1;
  a.totalActual += actualDuration;
  a.maxActual = Math.max(a.maxActual, actualDuration);
  a.lastActual = actualDuration;
  a.lastBase = baseDuration;
  samples.set(id, a);
  snapshot = [...samples.values()].map((x) => ({ ...x })).sort((x, y) => y.totalActual - x.totalActual);
  listeners.forEach((l) => l());
};

export const profilerStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot: () => snapshot,
  reset() {
    samples.clear();
    snapshot = [];
    listeners.forEach((l) => l());
  },
};
