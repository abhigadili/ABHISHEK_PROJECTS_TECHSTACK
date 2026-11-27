import type { ISODateTime } from './common';

export interface Medicine {
  id: number;
  sku: string;
  name: string;
  genericName: string | null;
  unitPrice: number;
  stockQuantity: number;
  reorderLevel: number;
  active: boolean;
}

export interface MedicineInput {
  sku: string;
  name: string;
  genericName?: string | null;
  unitPrice: number;
  stockQuantity: number;
  reorderLevel?: number;
}

export type PharmacyOrderStatus = 'PENDING' | 'DISPENSED' | 'REJECTED';

export interface PharmacyOrderItem {
  medicineName: string;
  dosage: string;
  quantity: number;
  medicineId: number | null;
  unitPrice: number | null;
  inStock: boolean;
}

export interface PharmacyOrder {
  id: number;
  prescriptionId: number;
  patientId: number;
  patientName: string;
  doctorName: string;
  status: PharmacyOrderStatus;
  totalAmount: number;
  dispensedBy: string | null;
  dispensedAt: ISODateTime | null;
  rejectionReason: string | null;
  createdAt: ISODateTime;
  items: PharmacyOrderItem[];
}

export type StockLevel = 'OUT' | 'LOW' | 'OK';
