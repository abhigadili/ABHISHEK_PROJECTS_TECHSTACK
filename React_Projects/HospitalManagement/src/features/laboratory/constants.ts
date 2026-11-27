import type { LabStatus } from '@/types';

export const LAB_STATUSES: LabStatus[] = ['REQUESTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
/** Allowed forward transitions (mirrors the backend workflow; the backend answers 409 for anything else). */
export const NEXT_STATUS: Partial<Record<LabStatus, { to: LabStatus; label: string }>> = {
  REQUESTED: { to: 'SAMPLE_COLLECTED', label: 'Mark sample collected' },
  SAMPLE_COLLECTED: { to: 'IN_PROGRESS', label: 'Start processing' },
};
