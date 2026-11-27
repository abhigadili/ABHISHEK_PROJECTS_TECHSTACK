import type { ISODateTime } from './common';

export type LabStatus = 'REQUESTED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type LabPriority = 'ROUTINE' | 'URGENT' | 'STAT';

export interface LabTest {
  id: number;
  code: string;
  name: string;
  sampleType: string | null;
  price: number;
  turnaroundHours: number | null;
}

export interface LabRequest {
  id: number;
  patientId: number;
  patientName: string;
  doctorId: number;
  appointmentId: number | null;
  testCode: string;
  testName: string;
  price: number;
  priority: LabPriority;
  status: LabStatus;
  clinicalNotes: string | null;
  accessionNumber: string | null;
  requestedAt: ISODateTime;
}

export interface LabRequestInput {
  patientId: number;
  doctorId: number;
  appointmentId?: number | null;
  testCode: string;
  priority?: LabPriority;
  clinicalNotes?: string | null;
}

export interface LabReportAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface LabReport {
  id: number;
  requestId: number;
  patientId: number;
  testName: string;
  resultSummary: string;
  resultDetails: string | null;
  referenceRange: string | null;
  abnormal: boolean;
  reportedBy: string;
  reportedAt: ISODateTime;
  attachment?: LabReportAttachment | null;
}

export interface LabReportInput {
  resultSummary: string;
  resultDetails?: string | null;
  referenceRange?: string | null;
  abnormal?: boolean;
}

export interface LabTestInput {
  code: string;
  name: string;
  sampleType?: string | null;
  price: number;
  turnaroundHours?: number | null;
}
