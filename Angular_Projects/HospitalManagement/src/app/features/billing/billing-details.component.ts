import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '../../core/auth/auth.service';
import type { Bill, PaymentMethod } from '../../core/models';
import { ConfirmService } from '../../shared/components/confirm-dialog.component';
import { PageHeaderComponent, SkeletonComponent } from '../../shared/components';
import { BillingActions } from '../../state/actions/billing.actions';
import { selectBillEntities, selectBillMethod, selectBillPayments, selectBillingError, selectBillingSaving } from '../../state/selectors/billing.selectors';
import { METHODS, badgeOf } from './billing-shared';

/** Invoice details + payments for ONE invoice. The invoice comes from the entity store (loadOne on route-id change); payments via a parameterised selector. */
@Component({
  selector: 'app-billing-details',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, PageHeaderComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bs-scope">
      <app-page-header title="Invoice" [subtitle]="bill()?.billNumber ?? '#' + billId()"><a actions class="btn btn-outline-secondary btn-sm" routerLink="/billing/invoices">Back</a></app-page-header>
      @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
      @if (bill(); as b) {
        <div class="row g-3">
          <div class="col-lg-8"><div class="card"><div class="card-body">
            <div class="d-flex justify-content-between"><div><h2 class="h5 mb-0">{{ b.patientName }}</h2><div class="small text-body-secondary">{{ b.billType }} · created {{ b.createdAt | date: 'dd MMM yyyy' }} · due {{ b.dueDate | date: 'dd MMM yyyy' }}</div></div><span class="badge align-self-start" [class]="badge(b.status)">{{ b.status }}</span></div>
            <table class="table table-sm mt-3"><thead><tr><th>Description</th><th class="text-end">Qty</th><th class="text-end">Unit</th><th class="text-end">Amount</th></tr></thead>
              <tbody>@for (i of b.items; track $index) { <tr><td>{{ i.description }}</td><td class="text-end">{{ i.quantity }}</td><td class="text-end">{{ i.unitPrice | currency: b.currency }}</td><td class="text-end">{{ i.amount | currency: b.currency }}</td></tr> }</tbody>
              <tfoot><tr><th colspan="3" class="text-end">Total</th><th class="text-end">{{ b.totalAmount | currency: b.currency }}</th></tr><tr><td colspan="3" class="text-end">Paid</td><td class="text-end">{{ b.paidAmount | currency: b.currency }}</td></tr><tr><th colspan="3" class="text-end">Balance</th><th class="text-end">{{ b.totalAmount - b.paidAmount | currency: b.currency }}</th></tr></tfoot></table>
            @if (b.note) { <p class="small mb-0"><b>Note:</b> {{ b.note }}</p> }
          </div></div></div>
          <div class="col-lg-4">
            @if (payable()) { <div class="card mb-3"><div class="card-body"><h3 class="h6">Pay this invoice</h3>
              <select class="form-select mb-2" aria-label="Payment method" (change)="method($any($event.target).value)">@for (m of methods; track m) { <option [value]="m" [selected]="selectedMethod() === m">{{ m.replace('_', ' ') }}</option> }</select>
              <button class="btn btn-success w-100" type="button" [disabled]="saving()" (click)="pay(b)">@if (saving()) { <span class="spinner-border spinner-border-sm me-1"></span> } Pay {{ b.totalAmount - b.paidAmount | currency: b.currency }}</button></div></div> }
            @if (auth.can('billing:manage') && (b.status === 'PENDING' || b.status === 'OVERDUE')) { <button class="btn btn-outline-danger w-100 mb-3" type="button" [disabled]="saving()" (click)="cancel(b)">Cancel invoice</button> }
            <div class="card"><div class="card-header">Payments</div>
              <ul class="list-group list-group-flush">@for (p of payments(); track p.id) { <li class="list-group-item small"><div class="d-flex justify-content-between"><b>{{ p.amount | currency: b.currency }}</b><span class="badge" [class]="badge(p.status)">{{ p.status }}</span></div>{{ p.method.replace('_', ' ') }} · {{ p.initiatedAt | date: 'dd MMM HH:mm' }}<div class="text-body-secondary text-break">{{ p.transactionRef }}</div>@if (p.failureReason) { <div class="text-danger">{{ p.failureReason }}</div> }
                @if (p.status === 'PENDING' && auth.can('billing:manage')) { <div class="mt-1 d-flex gap-1"><button class="btn btn-sm btn-success" type="button" (click)="confirmPay(b.id, p.transactionRef, 'SUCCESS')">Confirm</button><button class="btn btn-sm btn-outline-danger" type="button" (click)="confirmPay(b.id, p.transactionRef, 'FAILED')">Fail</button></div> }</li> }
                @empty { <li class="list-group-item small text-body-secondary">No payments yet</li> }</ul></div>
          </div>
        </div>
      } @else { <app-skeleton [rows]="5" /> }
    </div>`,
})
export class BillingDetailsComponent {
  readonly billId = input.required<string>();
  protected readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly confirmSvc = inject(ConfirmService);
  protected readonly methods = METHODS;
  protected readonly badge = badgeOf;
  private readonly entities = this.store.selectSignal(selectBillEntities);
  protected readonly bill = computed<Bill | null>(() => this.entities()[Number(this.billId())] ?? null);
  protected readonly selectedMethod = this.store.selectSignal(selectBillMethod);
  protected readonly saving = this.store.selectSignal(selectBillingSaving);
  protected readonly error = this.store.selectSignal(selectBillingError);
  protected readonly payments = computed(() => this.store.selectSignal(selectBillPayments(Number(this.billId())))());
  protected readonly payable = computed(() => { const b = this.bill(); return !!b && (b.status === 'PENDING' || b.status === 'OVERDUE') && this.auth.can('billing:pay'); });
  constructor() {
    effect(() => { const id = Number(this.billId()); this.store.dispatch(BillingActions.loadOne({ id })); this.store.dispatch(BillingActions.loadPayments({ billId: id })); });
  }
  protected method(m: string) { this.store.dispatch(BillingActions.methodChanged({ method: m as PaymentMethod })); }
  protected pay(b: Bill) { this.store.dispatch(BillingActions.pay({ billId: b.id, method: this.selectedMethod() })); }
  protected confirmPay(billId: number, transactionRef: string, status: 'SUCCESS' | 'FAILED') { this.store.dispatch(BillingActions.confirmPayment({ billId, transactionRef, status, reason: status === 'FAILED' ? 'Marked failed by staff' : undefined })); }
  protected cancel(b: Bill) {
    this.confirmSvc.confirm({ title: 'Cancel invoice?', message: `Invoice ${b.billNumber} will be cancelled.`, confirmLabel: 'Cancel invoice', destructive: true }).subscribe((r) => { if (r.confirmed) this.store.dispatch(BillingActions.cancelBill({ id: b.id })); });
  }
}
