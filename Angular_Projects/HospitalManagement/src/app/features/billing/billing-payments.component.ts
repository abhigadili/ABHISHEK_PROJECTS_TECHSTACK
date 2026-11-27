import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '../../core/auth/auth.service';
import type { PaymentMethod } from '../../core/models';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { BillingActions } from '../../state/actions/billing.actions';
import { selectBillMethod, selectBillSelectedIds, selectBillingLoading, selectBillingSaving, selectPayableBills, selectSelectedBills, selectSettlement } from '../../state/selectors/billing.selectors';
import { EmptyStateComponent, PageHeaderComponent, SkeletonComponent } from '../../shared/components';
import { METHODS, badgeOf } from './billing-shared';
import { loadBills } from './billing-dashboard.component';

/** Payment console – scenario 6: select payable invoices → choose a method → pay them SEQUENTIALLY (concatMap effect); results are listed below. */
@Component({
  selector: 'app-billing-payments',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, PageHeaderComponent, EmptyStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bs-scope">
      <app-page-header title="Payments" subtitle="Settle outstanding invoices" />
      @if (loading()) { <app-skeleton [rows]="4" /> }
      @else if (payable().length === 0) { <app-empty-state title="Nothing to pay" description="No pending or overdue invoices." /> }
      @else {
        <div class="card mb-3"><div class="card-body d-flex flex-wrap align-items-center gap-3">
          <select class="form-select w-auto" aria-label="Payment method" (change)="method($any($event.target).value)">@for (m of methods; track m) { <option [value]="m" [selected]="selectedMethod() === m">{{ m.replace('_', ' ') }}</option> }</select>
          <div class="ms-auto"><b>{{ selected().length }}</b> selected · <b>{{ selectedTotal() | currency }}</b></div>
          <button class="btn btn-success" type="button" [disabled]="saving() || selected().length === 0" (click)="settle()">@if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> } Pay selected</button></div></div>
        <div class="table-responsive"><table class="table table-hover align-middle"><thead><tr><th><input class="form-check-input" type="checkbox" aria-label="Select all" [checked]="allSelected()" (change)="toggleAll($any($event.target).checked)" /></th><th>Invoice</th><th>Patient</th><th>Status</th><th class="text-end">Balance</th><th></th></tr></thead>
          <tbody>@for (b of payable(); track b.id) { <tr><td><input class="form-check-input" type="checkbox" [attr.aria-label]="'Select ' + b.billNumber" [checked]="ids().includes(b.id)" (change)="toggle(b.id)" /></td><td>{{ b.billNumber }}</td><td>{{ b.patientName }}</td><td><span class="badge" [class]="badge(b.status)">{{ b.status }}</span></td><td class="text-end">{{ b.totalAmount - b.paidAmount | currency: b.currency }}</td><td><a [routerLink]="['/billing/invoices', b.id]">Open</a></td></tr> }</tbody></table></div>
      }
      @if (settlement().length) { <div class="card mt-3"><div class="card-header d-flex justify-content-between">Latest settlements <button class="btn btn-sm btn-link p-0" type="button" (click)="clear()">Clear</button></div>
        <ul class="list-group list-group-flush">@for (r of settlement(); track $index) { <li class="list-group-item small d-flex justify-content-between"><span>{{ r.billNumber }} · {{ r.amount | currency }} @if (r.message) { <span class="text-danger">— {{ r.message }}</span> }</span><span class="badge" [class]="r.outcome === 'paid' ? 'text-bg-success' : r.outcome === 'pending' ? 'text-bg-warning' : 'text-bg-danger'">{{ r.outcome }}</span></li> }</ul></div> }
    </div>`,
})
export class BillingPaymentsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly own = toSignal(inject(CurrentIdentityService).patient$);
  protected readonly methods = METHODS;
  protected readonly badge = badgeOf;
  protected readonly payable = this.store.selectSignal(selectPayableBills);
  protected readonly selected = this.store.selectSignal(selectSelectedBills);
  protected readonly ids = this.store.selectSignal(selectBillSelectedIds);
  protected readonly settlement = this.store.selectSignal(selectSettlement);
  protected readonly selectedMethod = this.store.selectSignal(selectBillMethod);
  protected readonly loading = this.store.selectSignal(selectBillingLoading);
  protected readonly saving = this.store.selectSignal(selectBillingSaving);
  protected readonly selectedTotal = computed(() => this.selected().reduce((s, b) => s + b.totalAmount - b.paidAmount, 0));
  protected readonly allSelected = computed(() => this.payable().length > 0 && this.selected().length === this.payable().length);
  ngOnInit() { loadBills(this.store, this.auth.role(), this.own()?.id, 100, ''); }
  protected method(m: string) { this.store.dispatch(BillingActions.methodChanged({ method: m as PaymentMethod })); }
  protected toggle(id: number) { this.store.dispatch(BillingActions.billToggled({ id })); }
  protected toggleAll(on: boolean) { this.store.dispatch(BillingActions.selectionSet({ ids: on ? this.payable().map((b) => b.id) : [] })); }
  protected settle() { this.store.dispatch(BillingActions.settleSelected({ bills: this.selected(), method: this.selectedMethod(), canConfirm: this.auth.can('billing:manage') })); }
  protected clear() { this.store.dispatch(BillingActions.settlementCleared()); }
}
