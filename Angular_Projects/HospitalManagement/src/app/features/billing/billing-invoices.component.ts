import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '../../core/auth/auth.service';
import type { BillStatus } from '../../core/models';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { BillingActions } from '../../state/actions/billing.actions';
import { selectBillFilter, selectBillPaging, selectBillingError, selectBillingLoading, selectVisibleBills } from '../../state/selectors/billing.selectors';
import { EmptyStateComponent, PageHeaderComponent, PagerComponent, SearchBoxComponent, SkeletonComponent } from '../../shared/components';
import { BILL_STATUSES, badgeOf } from './billing-shared';
import { loadBills } from './billing-dashboard.component';

/** Invoice list: status filter + paging are server-side (re-dispatch → switchMap effect cancels stale requests); search is client-side. */
@Component({
  selector: 'app-billing-invoices',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, PageHeaderComponent, PagerComponent, SearchBoxComponent, EmptyStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bs-scope">
      <app-page-header title="Invoices" [subtitle]="paging().totalElements + ' invoice(s)'">@if (auth.can('billing:manage')) { <a actions class="btn btn-primary btn-sm" routerLink="../generate">Generate invoice</a> }</app-page-header>
      <div class="row g-2 mb-3"><div class="col-sm-6 col-md-4"><app-search-box placeholder="Search number or patient" (search)="search($event)" /></div>
        @if (auth.role() !== 'PATIENT') { <div class="col-sm-6 col-md-3"><select class="form-select" aria-label="Status filter" (change)="status($any($event.target).value)"><option value="">All statuses</option>@for (s of statuses; track s) { <option [value]="s" [selected]="filter().status === s">{{ s }}</option> }</select></div> }</div>
      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
      @if (loading()) { <app-skeleton [rows]="5" /> }
      @else if (bills().length === 0) { <app-empty-state title="No invoices" description="Nothing matches the current filter." /> }
      @else {
        <div class="table-responsive"><table class="table table-hover align-middle"><thead><tr><th>Invoice</th><th>Patient</th><th>Type</th><th>Due</th><th class="text-end">Total</th><th class="text-end">Paid</th><th>Status</th><th></th></tr></thead>
          <tbody>@for (b of bills(); track b.id) { <tr><td class="fw-semibold">{{ b.billNumber }}</td><td>{{ b.patientName }}</td><td>{{ b.billType }}</td><td>{{ b.dueDate | date: 'dd MMM yyyy' }}</td><td class="text-end">{{ b.totalAmount | currency: b.currency }}</td><td class="text-end">{{ b.paidAmount | currency: b.currency }}</td><td><span class="badge" [class]="badge(b.status)">{{ b.status }}</span></td><td><a [routerLink]="['..', 'invoices', b.id]">Open</a></td></tr> }</tbody></table></div>
        @if (auth.role() !== 'PATIENT') { <app-pager [page]="filter().page" [size]="filter().size" [total]="paging().totalElements" label="invoices" (pageChange)="page($event)" /> }
      }
    </div>`,
})
export class BillingInvoicesComponent {
  protected readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly own = toSignal(inject(CurrentIdentityService).patient$);
  protected readonly statuses = BILL_STATUSES;
  protected readonly badge = badgeOf;
  protected readonly bills = this.store.selectSignal(selectVisibleBills);
  protected readonly filter = this.store.selectSignal(selectBillFilter);
  protected readonly paging = this.store.selectSignal(selectBillPaging);
  protected readonly loading = this.store.selectSignal(selectBillingLoading);
  protected readonly error = this.store.selectSignal(selectBillingError);
  /** Primitive keys: the effect re-runs only when status/page really change (the filter OBJECT is replaced by the very action this effect dispatches). */
  private readonly key = computed(() => `${this.filter().status}|${this.filter().page}`);
  constructor() {
    effect(() => {
      this.key(); const role = this.auth.role(); const pid = this.own()?.id;
      untracked(() => { const f = this.filter(); loadBills(this.store, role, pid, f.size, f.status, f.page); });
    });
  }
  protected status(s: string) { this.store.dispatch(BillingActions.statusFilterChanged({ status: s as BillStatus | '' })); }
  protected page(p: number) { this.store.dispatch(BillingActions.pageChanged({ page: p })); }
  protected search(q: string) { this.store.dispatch(BillingActions.searchChanged({ search: q })); }
}
