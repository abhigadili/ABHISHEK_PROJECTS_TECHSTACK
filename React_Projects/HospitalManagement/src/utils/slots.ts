import type { Slot } from '@/types';

export type SlotPeriod = 'Morning' | 'Afternoon' | 'Evening';
export const periodOf = (hhmm: string): SlotPeriod => {
  const h = Number(hhmm.slice(0, 2));
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
};

export interface GroupedSlots {
  period: SlotPeriod;
  slots: Slot[];
}

/** TanStack Query `select` transformer: group the flat slot grid by part of the day. */
export function groupSlots(slots: Slot[]): GroupedSlots[] {
  const map = new Map<SlotPeriod, Slot[]>();
  for (const s of slots) {
    const p = periodOf(s.startTime);
    map.set(p, [...(map.get(p) ?? []), s]);
  }
  return (['Morning', 'Afternoon', 'Evening'] as const).filter((p) => map.has(p)).map((p) => ({ period: p, slots: map.get(p)! }));
}
