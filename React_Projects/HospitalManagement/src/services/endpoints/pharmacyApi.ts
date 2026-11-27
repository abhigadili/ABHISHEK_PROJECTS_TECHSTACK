import { http } from '@/services/api/http';
import type { Medicine, MedicineInput, Page, PharmacyOrder, PharmacyOrderStatus } from '@/types';

export interface OrderListParams {
  status?: PharmacyOrderStatus;
  page?: number;
  size?: number;
}

export const pharmacyApi = {
  medicines: (signal?: AbortSignal) => http.get<Medicine[]>('/pharmacy/medicines', undefined, signal),
  createMedicine: (body: MedicineInput) => http.post<Medicine>('/pharmacy/medicines', body),
  updateMedicine: (id: number, body: MedicineInput) => http.put<Medicine>(`/pharmacy/medicines/${id}`, body),
  restock: (id: number, quantity: number) => http.post<Medicine>(`/pharmacy/medicines/${id}/restock`, { quantity }),
  orders: (params: OrderListParams, signal?: AbortSignal) => http.get<Page<PharmacyOrder>>('/pharmacy/orders', { ...params }, signal),
  order: (id: number, signal?: AbortSignal) => http.get<PharmacyOrder>(`/pharmacy/orders/${id}`, undefined, signal),
  orderForPrescription: (prescriptionId: number, signal?: AbortSignal) => http.get<PharmacyOrder>(`/pharmacy/orders/prescription/${prescriptionId}`, undefined, signal),
  dispense: (id: number) => http.post<PharmacyOrder>(`/pharmacy/orders/${id}/dispense`),
  reject: (id: number, reason: string) => http.post<PharmacyOrder>(`/pharmacy/orders/${id}/reject`, { reason }),
};
