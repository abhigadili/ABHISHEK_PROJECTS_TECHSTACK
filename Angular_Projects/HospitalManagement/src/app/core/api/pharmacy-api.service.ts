import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { Medicine, MedicineInput, Page, PharmacyOrder, PharmacyOrderStatus } from '../models';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class PharmacyApiService extends BaseApiService {
  protected readonly resource = 'pharmacy';
  medicines(): Observable<Medicine[]> { return this.get<Medicine[]>('/medicines'); }
  createMedicine(b: MedicineInput): Observable<Medicine> { return this.post<Medicine, MedicineInput>('/medicines', b); }
  updateMedicine(id: number, b: MedicineInput): Observable<Medicine> { return this.put<Medicine, MedicineInput>(`/medicines/${id}`, b); }
  restock(id: number, quantity: number): Observable<Medicine> { return this.post<Medicine, { quantity: number }>(`/medicines/${id}/restock`, { quantity }); }
  orders(p: { status?: PharmacyOrderStatus; page?: number; size?: number } = {}): Observable<Page<PharmacyOrder>> { return this.get<Page<PharmacyOrder>>('/orders', { ...p }); }
  order(id: number): Observable<PharmacyOrder> { return this.get<PharmacyOrder>(`/orders/${id}`); }
  orderForPrescription(prescriptionId: number): Observable<PharmacyOrder> { return this.get<PharmacyOrder>(`/orders/prescription/${prescriptionId}`); }
  dispense(id: number): Observable<PharmacyOrder> { return this.post<PharmacyOrder>(`/orders/${id}/dispense`); }
  reject(id: number, reason: string): Observable<PharmacyOrder> { return this.post<PharmacyOrder, { reason: string }>(`/orders/${id}/reject`, { reason }); }
}
