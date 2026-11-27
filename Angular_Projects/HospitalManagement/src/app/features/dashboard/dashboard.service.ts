import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, timeout } from 'rxjs';
import { BillingApiService } from '../../core/api/billing-api.service';
import { DoctorApiService } from '../../core/api/doctor-api.service';
import { LaboratoryApiService } from '../../core/api/laboratory-api.service';
import { PatientApiService } from '../../core/api/patient-api.service';
import { PharmacyApiService } from '../../core/api/pharmacy-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { Bill, BillStatus, LabStatus, Page, Role } from '../../core/models';

export interface DashboardStats {
  readonly patients: number | null;
  readonly doctors: number | null;
  readonly lab: Readonly<Record<LabStatus, number>> | null;
  readonly bills: { readonly counts: Readonly<Record<BillStatus, number>>; readonly outstanding: number; readonly collected: number } | null;
  readonly lowStock: number | null;
}

/**
 * Dashboard data service. MULTIPLE DASHBOARD APIS WITH forkJoin: every widget request runs in parallel; each has its own
 * `timeout()` (6 s) and `catchError → null`, so one slow/forbidden/failing widget shows "n/a" instead of breaking the whole page.
 * Only calls the signed-in role may make are issued (role → permission check).
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly auth = inject(AuthService);
  private readonly patients = inject(PatientApiService);
  private readonly doctors = inject(DoctorApiService);
  private readonly lab = inject(LaboratoryApiService);
  private readonly billing = inject(BillingApiService);
  private readonly pharmacy = inject(PharmacyApiService);

  private safe<T>(source$: Observable<T>): Observable<T | null> {
    return source$.pipe(timeout(6000), catchError(() => of(null)));
  }

  stats(): Observable<DashboardStats> {
    const role = this.auth.role() as Role;
    const can = (p: string) => this.auth.can(p);
    const LAB: LabStatus[] = ['REQUESTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    const BILL: BillStatus[] = ['PENDING', 'OVERDUE', 'PAID', 'CANCELLED'];
    const none$ = of(null);
    return forkJoin({
      patients: can('patients:read') ? this.safe(this.patients.list({ size: 1 }).pipe(map((p) => p.totalElements))) : none$,
      doctors: this.safe(this.doctors.list({ size: 1, active: true }).pipe(map((p) => p.totalElements))),
      lab: can('lab:request') || can('lab:process') ? this.safe(forkJoin(LAB.map((s) => this.lab.requests({ status: s, size: 1 }).pipe(map((p) => p.totalElements)))).pipe(map((n) => Object.fromEntries(LAB.map((s, i) => [s, n[i]])) as Record<LabStatus, number>))) : none$,
      bills: can('billing:manage') ? this.safe(forkJoin(BILL.map((s) => this.billing.list({ status: s, size: 100 }))).pipe(map((pages) => this.foldBills(BILL, pages)))) : none$,
      lowStock: can('pharmacy:access') ? this.safe(this.pharmacy.medicines().pipe(map((m) => m.filter((x) => x.active && x.stockQuantity <= x.reorderLevel).length))) : none$,
    }).pipe(map((r) => ({ ...r }) as DashboardStats), map((s) => (role ? s : s)));
  }

  private foldBills(statuses: BillStatus[], pages: Page<Bill>[]) {
    const by = Object.fromEntries(statuses.map((s, i) => [s, pages[i]!])) as Record<BillStatus, Page<Bill>>;
    const due = (p: Page<Bill>) => p.content.reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0);
    return {
      counts: Object.fromEntries(statuses.map((s) => [s, by[s].totalElements])) as Record<BillStatus, number>,
      outstanding: due(by.PENDING) + due(by.OVERDUE),
      collected: by.PAID.content.reduce((sum, b) => sum + b.paidAmount, 0),
    };
  }
}
