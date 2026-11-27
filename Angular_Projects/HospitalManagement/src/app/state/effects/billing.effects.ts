import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, exhaustMap, from, map, mergeMap, of, switchMap, tap, toArray } from 'rxjs';
import { BillingApiService } from '../../core/api/billing-api.service';
import { ApiError, errorMessage } from '../../core/models/api-error';
import type { Payment } from '../../core/models';
import { EventBusService } from '../../core/services/event-bus.service';
import { NotificationService } from '../../core/services/notification.service';
import { BillingActions as A } from '../actions/billing.actions';
import type { SettlementResult } from '../entities/billing.entity';

@Injectable()
export class BillingEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(BillingApiService);
  private readonly notify = inject(NotificationService);
  private readonly bus = inject(EventBusService);
  private readonly fail = (e: unknown) => of(A.saveFailure({ error: errorMessage(e) }));

  readonly loadStaff$ = createEffect(() => this.actions$.pipe(ofType(A.loadStaffPage), switchMap(({ status, page, size }) => this.api.list({ status: status || undefined, page, size }).pipe(map((result) => A.loadStaffPageSuccess({ result })), catchError((e) => of(A.loadFailure({ error: errorMessage(e) })))))));
  readonly loadPatient$ = createEffect(() => this.actions$.pipe(ofType(A.loadForPatient), switchMap(({ patientId }) => this.api.forPatient(patientId).pipe(map((bills) => A.loadForPatientSuccess({ bills })), catchError((e) => of(A.loadFailure({ error: errorMessage(e) })))))));
  readonly loadOne$ = createEffect(() => this.actions$.pipe(ofType(A.loadOne), mergeMap(({ id }) => this.api.getById(id).pipe(map((bill) => A.loadOneSuccess({ bill })), catchError((e) => of(A.loadFailure({ error: errorMessage(e) })))))));
  readonly loadPayments$ = createEffect(() => this.actions$.pipe(ofType(A.loadPayments), mergeMap(({ billId }) => this.api.payments(billId).pipe(map((payments) => A.loadPaymentsSuccess({ billId, payments })), catchError((e) => of(A.loadFailure({ error: errorMessage(e) })))))));

  /** exhaustMap: a payment click while one is being processed is ignored → no double charge. After the payment the invoice is reloaded. */
  readonly pay$ = createEffect(() => this.actions$.pipe(ofType(A.pay), exhaustMap(({ billId, method, simulateOutcome }) => this.api.pay(billId, { method, simulateOutcome }).pipe(
    concatMap((payment) => [A.paySuccess({ payment }), A.loadOne({ id: billId })]),
    catchError((e) => this.fail(e)),
  ))));

  readonly confirm$ = createEffect(() => this.actions$.pipe(ofType(A.confirmPayment), concatMap(({ billId, transactionRef, status, reason }) => this.api.setPaymentStatus(transactionRef, status, reason).pipe(
    concatMap((payment) => [A.confirmPaymentSuccess({ billId, payment }), A.loadOne({ id: billId })]),
    catchError((e) => this.fail(e)),
  ))));

  /**
   * SEQUENTIAL API calls with concatMap: for every selected invoice (in order) 1) initiate the payment, 2) confirm it when the caller
   * may confirm (ADMIN / BILLING_STAFF – the simulated gateway callback). One failing invoice does not stop the others.
   */
  readonly settle$ = createEffect(() => this.actions$.pipe(ofType(A.settleSelected), exhaustMap(({ bills, method, canConfirm }) =>
    from(bills).pipe(
      concatMap((bill) => {
        const due = Math.max(bill.totalAmount - bill.paidAmount, 0);
        const result = (p: Payment): SettlementResult => ({ billId: bill.id, billNumber: bill.billNumber, amount: due, outcome: p.status === 'SUCCESS' ? 'paid' : p.status === 'FAILED' ? 'failed' : 'pending', transactionRef: p.transactionRef, message: p.failureReason ?? undefined });
        return this.api.pay(bill.id, { method }).pipe(
          concatMap((p) => (p.status === 'PENDING' && canConfirm ? this.api.setPaymentStatus(p.transactionRef, 'SUCCESS') : of(p))),
          map(result),
          catchError((e) => of<SettlementResult>({ billId: bill.id, billNumber: bill.billNumber, amount: due, outcome: 'failed', message: ApiError.from(e).message })),
        );
      }),
      toArray(),
      map((results) => A.settleSelectedSuccess({ results })),
    ))));

  /** concatMap: bill generation requests are queued in order. */
  readonly generate$ = createEffect(() => this.actions$.pipe(ofType(A.generate), concatMap(({ bill }) => this.api.create(bill).pipe(map((b) => A.generateSuccess({ bill: b })), catchError((e) => this.fail(e))))));
  readonly cancel$ = createEffect(() => this.actions$.pipe(ofType(A.cancelBill), concatMap(({ id }) => this.api.cancel(id).pipe(map((bill) => A.cancelBillSuccess({ bill })), catchError((e) => this.fail(e))))));

  readonly toasts$ = createEffect(() => this.actions$.pipe(
    ofType(A.paySuccess, A.confirmPaymentSuccess, A.settleSelectedSuccess, A.generateSuccess, A.cancelBillSuccess, A.saveFailure),
    tap((a) => {
      switch (a.type) {
        case A.paySuccess.type: { const p = (a as ReturnType<typeof A.paySuccess>).payment; if (p.status === 'FAILED') this.notify.error(`Payment declined: ${p.failureReason ?? 'failed'}`); else this.notify.success(p.status === 'SUCCESS' ? 'Payment successful' : `Payment ${p.transactionRef} initiated – awaiting confirmation`); break; }
        case A.confirmPaymentSuccess.type: { const p = (a as ReturnType<typeof A.confirmPaymentSuccess>).payment; if (p.status === 'SUCCESS') { this.notify.success('Payment confirmed – invoice paid'); this.bus.emit({ type: 'payment-completed', billId: p.billId }); } else this.notify.warning('Payment marked as failed'); break; }
        case A.settleSelectedSuccess.type: { const r = (a as ReturnType<typeof A.settleSelectedSuccess>).results; this.notify.success(`${r.filter((x) => x.outcome === 'paid').length} paid, ${r.filter((x) => x.outcome === 'pending').length} awaiting confirmation, ${r.filter((x) => x.outcome === 'failed').length} failed`); break; }
        case A.generateSuccess.type: this.notify.success(`Invoice ${(a as ReturnType<typeof A.generateSuccess>).bill.billNumber} generated`); break;
        case A.cancelBillSuccess.type: this.notify.success('Invoice cancelled'); break;
        default: this.notify.error((a as { error: string }).error);
      }
    }),
  ), { dispatch: false });
}
