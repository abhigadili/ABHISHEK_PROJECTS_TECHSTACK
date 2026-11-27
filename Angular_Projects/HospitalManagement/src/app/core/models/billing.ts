import type { ISODate, ISODateTime } from './common';

export type BillStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type BillType = 'APPOINTMENT' | 'LAB' | 'MEDICINE' | 'OTHER';
export type PaymentMethod = 'CARD' | 'UPI' | 'NET_BANKING' | 'CASH' | 'INSURANCE';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface BillItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Bill {
  id: number;
  billNumber: string;
  patientId: number;
  patientName: string;
  billType: BillType;
  referenceType: string | null;
  referenceId: number | null;
  status: BillStatus;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  dueDate: ISODate;
  note: string | null;
  createdAt: ISODateTime;
  items: BillItem[];
}

export interface BillInput {
  patientId: number;
  billType: BillType;
  referenceId?: number | null;
  note?: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
}

export interface Payment {
  id: number;
  billId: number;
  billNumber: string;
  transactionRef: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  failureReason: string | null;
  initiatedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export interface PaymentInitiateRequest {
  method: PaymentMethod;
  simulateOutcome?: 'SUCCESS' | 'FAILURE';
}
