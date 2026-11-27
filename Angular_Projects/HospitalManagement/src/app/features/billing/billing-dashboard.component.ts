import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '../../core/auth/auth.service';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { BillingActions } from '../../state/actions/billing.actions';
import { selectBillCounts, selectBillingError, selectBillingLoading, selectCollected, selectOutstanding } from '../../state/selectors/billing.selectors';
import { PageHeaderComponent } from '../../shared/components';
import { BILL_STATUSES, badgeOf } from './billing-shared';

/** Billing dashboard (Bootstrap cards): figures are NgRx memoised selectors over the loaded invoices (most recent 100 for staff). */
@Component({
  selector: 'app-billing-dashboard',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bs-scope">
      <app-page-header title="Billing" subtitle="Invoices and payments">
        <span actions class="d-flex gap-2"><a class="btn btn-outline-primary btn-sm" routerLink="invoices">Invoices</a><a class="btn btn-outline-primary btn-sm" routerLink="payments">Payments</a>@if (auth.can('billing:manage')) { <a class="btn btn-primary btn-sm" routerLink="generate">Generate invoice</a> }</span>
      </app-page-header>
      @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
      <div class="row g-3">
        @for (s of statuses; track s) { <div class="col-6 col-md-3"><div class="card h-100"><div class="card-body"><div class="small text-body-secondary">{{ s }}</div><div class="fs-3 fw-semibold">@if (loading()) { <span class="placeholder col-4"></span> } @else { {{ counts()[s] ?? 0 }} }</div><span class="badge" [class]="badge(s)">{{ s.toLowerCase() }}</span></div></div></div> }
        <div class="col-md-6"><div class="card border-warning h-100"><div class="card-body"><div class="small text-body-secondary">Outstanding</div><div class="fs-3 fw-semibold">{{ outstanding() | currency }}</div></div></div></div>
        <div class="col-md-6"><div class="card border-success h-100"><div class="card-body"><div class="small text-body-secondary">Collected</div><div class="fs-3 fw-semibold">{{ collected() | currency }}</div></div></div></div>
      </div>
      <p class="small text-body-secondary mt-3">Figures cover the most recent 100 invoices loaded from the Billing Service.</p>
    </div>`,
})
export class BillingDashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly own = toSignal(inject(CurrentIdentityService).patient$);
  protected readonly statuses = BILL_STATUSES;
  protected readonly badge = badgeOf;
  protected readonly counts = this.store.selectSignal(selectBillCounts);
  protected readonly outstanding = this.store.selectSignal(selectOutstanding);
  protected readonly collected = this.store.selectSignal(selectCollected);
  protected readonly loading = this.store.selectSignal(selectBillingLoading);
  protected readonly error = this.store.selectSignal(selectBillingError);
  ngOnInit() { loadBills(this.store, this.auth.role(), this.own()?.id, 100); }
}

export function loadBills(store: Store, role: string | null | undefined, patientId: number | undefined, size: number, status: '' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' = '', page = 0) {
  if (role === 'PATIENT') { if (patientId) store.dispatch(BillingActions.loadForPatient({ patientId })); }
  else store.dispatch(BillingActions.loadStaffPage({ status, page, size }));
}
