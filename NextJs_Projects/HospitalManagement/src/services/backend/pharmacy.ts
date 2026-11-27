import 'server-only';
import { backendFetch } from '@/lib/api/backend';
import { CACHE_TAGS } from '@/constants/cache';
import type { Medicine, MedicineInput, Page, PharmacyOrder } from '@/types';

const A = { cache: 'no-store' as const, redirectOnUnauthorized: false };
export const pharmacyService = {
  medicines: () => backendFetch<Medicine[]>('/api/pharmacy/medicines', { revalidate: 30, tags: [CACHE_TAGS.pharmacy] }),
  createMedicine: (b: MedicineInput) => backendFetch<Medicine>('/api/pharmacy/medicines', { method: 'POST', body: b, ...A }),
  restock: (id: number, quantity: number) => backendFetch<Medicine>(`/api/pharmacy/medicines/${id}/restock`, { method: 'POST', body: { quantity }, ...A }),
  orders: (p: { status?: string; page?: number; size?: number } = {}) => backendFetch<Page<PharmacyOrder>>('/api/pharmacy/orders', { query: { page: 0, size: 20, ...p }, cache: 'no-store' }),
  order: (id: number) => backendFetch<PharmacyOrder>(`/api/pharmacy/orders/${id}`, { cache: 'no-store' }),
  orderByPrescription: (id: number) => backendFetch<PharmacyOrder>(`/api/pharmacy/orders/prescription/${id}`, { cache: 'no-store' }),
  dispense: (id: number) => backendFetch<PharmacyOrder>(`/api/pharmacy/orders/${id}/dispense`, { method: 'POST', ...A }),
  reject: (id: number, reason: string) => backendFetch<PharmacyOrder>(`/api/pharmacy/orders/${id}/reject`, { method: 'POST', body: { reason }, ...A }),
};
