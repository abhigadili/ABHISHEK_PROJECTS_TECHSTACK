import type { ISODateTime } from './common';

export type RecordEntryType = 'DIAGNOSIS' | 'VISIT' | 'LAB_REPORT' | 'PRESCRIPTION' | 'ALLERGY' | 'NOTE';
export const RECORD_ENTRY_TYPES: readonly RecordEntryType[] = ['DIAGNOSIS', 'VISIT', 'LAB_REPORT', 'PRESCRIPTION', 'ALLERGY', 'NOTE'] as const;

export interface RecordEntry {
  id: number;
  patientId: number;
  entryType: RecordEntryType;
  title: string;
  details: string | null;
  doctorId: number | null;
  referenceType: string | null;
  referenceId: number | null;
  source: 'MANUAL' | 'EVENT';
  recordedAt: ISODateTime;
}

export interface RecordSummary {
  patientId: number;
  patientName: string;
  chronicConditions: string | null;
  entryCounts: Record<RecordEntryType, number>;
  latestEntries: RecordEntry[];
}

export interface RecordEntryInput {
  patientId: number;
  entryType: RecordEntryType;
  title: string;
  details?: string | null;
  doctorId?: number | null;
}
