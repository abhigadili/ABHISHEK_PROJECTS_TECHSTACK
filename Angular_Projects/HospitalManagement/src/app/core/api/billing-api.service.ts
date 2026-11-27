import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { Bill, BillInput, BillStatus, Page, Payment, PaymentInitiateRequest } from '../models';
import { BaseApiService } from './base-api.service';

/** Billing Service API: bills under `/api/bills`, payment callbacks under `/api/payments`. */
@Injectable({ providedIn: 'root' })
export class BillingApiService extends BaseApiService {
  protected readonly resource = 'bills';
  list(p: { status?: BillStatus; page?: number; size?: number } = {}): Observable<Page<Bill>> { return this.get<Page<Bill>>('', { ...p }); }
  forPatient(patientId: number): Observable<Bill[]> { return this.get<Bill[]>(`/patient/${patientId}`); }
  getById(id: number): Observable<Bill> { return this.get<Bill>(`/${id}`); }
  create(b: BillInput): Observable<Bill> { return this.post<Bill, BillInput>('', b); }
  cancel(id: number): Observable<Bill> { return this.put<Bill>(`/${id}/cancel`); }
  payments(billId: number): Observable<Payment[]> { return this.get<Payment[]>(`/${billId}/payments`); }
  pay(billId: number, b: PaymentInitiateRequest): Observable<Payment> { return this.post<Payment, PaymentInitiateRequest>(`/${billId}/payments`, b); }
  setPaymentStatus(ref: string, status: 'SUCCESS' | 'FAILED', failureReason?: string): Observable<Payment> {
    return this.http.put<Payment>(this.gateway(`/payments/${ref}/status`), { status, failureReason });
  }
}
