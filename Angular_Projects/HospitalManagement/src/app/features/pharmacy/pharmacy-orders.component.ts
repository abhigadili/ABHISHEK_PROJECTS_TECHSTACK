import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { BehaviorSubject, combineLatest, debounceTime, map, switchMap, timer } from 'rxjs';
import { PharmacyApiService } from '../../core/api/pharmacy-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { Page, PharmacyOrder, PharmacyOrderStatus } from '../../core/models';
import type { LoadState } from '../../core/models/api-error';
import { NotificationService } from '../../core/services/notification.service';
import { DataStateComponent, PageHeaderComponent } from '../../shared/components';
import { toLoadState } from '../../shared/utilities/load-state';
import { PharmacyStore } from '../../state/feature-stores/pharmacy.store';

/** Pharmacy orders: server-paged p-table, status filter, auto-refresh every 15 s, details dialog, dispense / reject (with reason). */
@Component({
  selector: 'app-pharmacy-orders',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, ButtonModule, DialogModule, SelectModule, TableModule, TagModule, TextareaModule, PageHeaderComponent, DataStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Pharmacy orders" subtitle="Created automatically from prescriptions"><a actions routerLink="/pharmacy"><p-button label="Medicines" severity="secondary" [outlined]="true" /></a></app-page-header>
    <div class="mb-3"><p-select [options]="options" [ngModel]="status()" (ngModelChange)="setStatus($event)" optionLabel="label" optionValue="value" placeholder="All statuses" [showClear]="true" ariaLabel="Status filter" /></div>
    <app-data-state [state]="state()" emptyTitle="No orders" (retry)="reload$.next()">
      <ng-template #loaded let-d>
        <p-table [value]="d.rows" [lazy]="true" [paginator]="d.total > size" [rows]="size" [totalRecords]="d.total" [first]="page() * size" (onLazyLoad)="lazy($event)" [lazyLoadOnInit]="false" styleClass="p-datatable-sm">
          <ng-template #header><tr><th>#</th><th>Prescription</th><th>Patient</th><th>Doctor</th><th>Total</th><th>Created</th><th>Status</th><th></th></tr></ng-template>
          <ng-template #body let-o><tr><td>{{ o.id }}</td><td><a [routerLink]="['/prescriptions', o.prescriptionId]">#{{ o.prescriptionId }}</a></td><td>{{ o.patientName }}</td><td>{{ o.doctorName }}</td><td>{{ o.totalAmount | currency }}</td><td>{{ o.createdAt | date: 'dd MMM HH:mm' }}</td><td><p-tag [value]="o.status" [severity]="sev(o.status)" /></td><td><p-button label="View" size="small" [text]="true" (onClick)="open(o)" /></td></tr></ng-template>
        </p-table>
      </ng-template>
    </app-data-state>
    <p-dialog [visible]="!!current()" (visibleChange)="!$event && current.set(null)" [modal]="true" [style]="{ width: '34rem' }" header="Order" [dismissableMask]="true">
      @if (current(); as o) {
        <div class="space-y-2 text-sm"><div class="flex justify-between"><b>{{ o.patientName }}</b><p-tag [value]="o.status" [severity]="sev(o.status)" /></div>
          <table class="w-full"><thead><tr class="text-left text-xs text-slate-500"><th>Medicine</th><th>Dosage</th><th>Qty</th><th>Stock</th></tr></thead><tbody>@for (i of o.items; track $index) { <tr><td>{{ i.medicineName }}</td><td>{{ i.dosage }}</td><td>{{ i.quantity }}</td><td>{{ i.inStock ? '✔' : '✘ out' }}</td></tr> }</tbody></table>
          @if (o.rejectionReason) { <p class="text-red-700">Rejected: {{ o.rejectionReason }}</p> }@if (o.dispensedBy) { <p class="text-slate-500">Dispensed by {{ o.dispensedBy }} {{ o.dispensedAt | date: 'dd MMM HH:mm' }}</p> }
          @if (o.status === 'PENDING' && auth.can('pharmacy:manage')) {
            <textarea pTextarea rows="2" class="w-full" placeholder="Rejection reason (required to reject)" aria-label="Rejection reason" [ngModel]="reason()" (ngModelChange)="reason.set($event)"></textarea>
            <div class="flex justify-end gap-2"><p-button label="Reject" severity="danger" [outlined]="true" [disabled]="reason().trim().length < 3 || busy()" (onClick)="reject(o)" /><p-button label="Dispense" [loading]="busy()" (onClick)="dispense(o)" /></div> }
        </div> }
    </p-dialog>`,
})
export class PharmacyOrdersComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(PharmacyApiService);
  private readonly store = inject(PharmacyStore);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly size = 10;
  protected readonly options = (['PENDING', 'DISPENSED', 'REJECTED'] as PharmacyOrderStatus[]).map((value) => ({ value, label: value }));
  protected readonly status = signal<PharmacyOrderStatus | null>(null);
  protected readonly page = signal(0);
  protected readonly reload$ = new BehaviorSubject<void>(undefined);
  protected readonly current = signal<PharmacyOrder | null>(null);
  protected readonly reason = signal('');
  protected readonly busy = signal(false);
  protected readonly sev = (s: PharmacyOrderStatus) => ({ PENDING: 'warn', DISPENSED: 'success', REJECTED: 'danger' } as const)[s];
  /** timer(15 s) re-triggers the load while the page is open (combineLatest of filters + polling tick; switchMap drops stale requests). */
  protected readonly state = toSignal(
    combineLatest([toObservable(this.status), toObservable(this.page), this.reload$, timer(0, 15_000).pipe(map(() => 0))]).pipe(
      debounceTime(0),
      switchMap(([status, page]) => toLoadState(this.api.orders({ status: status ?? undefined, page, size: this.size }).pipe(map((p: Page<PharmacyOrder>) => ({ rows: p.content, total: p.totalElements }))))),
    ), { initialValue: { status: 'loading' } as LoadState<{ rows: PharmacyOrder[]; total: number }> });
  protected setStatus(s: PharmacyOrderStatus | null) { this.page.set(0); this.status.set(s); }
  protected lazy(e: TableLazyLoadEvent) { this.page.set(Math.floor((e.first ?? 0) / (e.rows ?? this.size))); }
  protected open(o: PharmacyOrder) { this.reason.set(''); this.current.set(o); }
  private done(msg: string) { this.busy.set(false); this.current.set(null); this.notify.success(msg); this.reload$.next(); this.store.load(); }
  protected dispense(o: PharmacyOrder) { this.busy.set(true); this.api.dispense(o.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => this.done('Order dispensed – stock updated'), error: () => this.busy.set(false) }); }
  protected reject(o: PharmacyOrder) { this.busy.set(true); this.api.reject(o.id, this.reason().trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => this.done('Order rejected'), error: () => this.busy.set(false) }); }
  protected readonly _c = computed(() => 0);
}
