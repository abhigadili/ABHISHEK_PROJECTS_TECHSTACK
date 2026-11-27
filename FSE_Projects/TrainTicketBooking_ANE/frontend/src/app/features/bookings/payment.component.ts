import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { EMPTY, Subject, catchError, concatMap, exhaustMap, finalize, interval, map, startWith, tap } from 'rxjs';
import { ConfirmService, FieldErrorComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/components/ui.components';
import type { Booking, Payment, PaymentMethod } from '../../core/models/models';
import { BookingService, PaymentService } from '../../core/services/account.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { DigitsOnlyDirective } from '../../shared/directives/directives';
import { TimeLeftPipe } from '../../shared/pipes/pipes';

/**
 * Payment for a PENDING_PAYMENT booking, following the backend's two-step flow:
 *   1) POST /payments (initiate - idempotent, reuses an open payment)   2) POST /payments/:id/confirm (verification with the provider).
 * Only the LAST 4 digits of a card are ever entered/sent; nothing is stored in the browser.
 */
@Component({
  selector: 'app-payment',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatRadioModule, PageHeaderComponent, StatusChipComponent, FieldErrorComponent, DigitsOnlyDirective, TimeLeftPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (booking(); as b) {
      <app-page-header title="Complete your payment" [subtitle]="b.train.number + ' ' + b.train.name + ' · ' + b.fromStation.code + ' → ' + b.toStation.code" />
      @switch (state()) {
        @case ('expired') {
          <div class="card" role="alert"><h2>Seat hold expired</h2><p>The payment window has closed and your seats were released. Please search again.</p><a mat-flat-button routerLink="/">Search trains</a></div>
        }
        @case ('done') {
          <div class="card ok" role="status"><mat-icon>check_circle</mat-icon><h2>Payment successful</h2><p>Your booking is confirmed. PNR <strong>{{ pnr() }}</strong></p>
            <div class="row"><a mat-flat-button [routerLink]="['/app/bookings', b.id]">View ticket</a>@if (payment(); as p) { <a mat-stroked-button [routerLink]="['/app/payments', p.id, 'receipt']">Receipt</a> }</div></div>
        }
        @default {
          <div class="grid cols-2">
            <div class="card">
              <h2>Payment method</h2>
              <form [formGroup]="form" (ngSubmit)="pay$.next('SUCCESS')" novalidate>
                <mat-radio-group formControlName="method" aria-label="Payment method" class="methods">
                  @for (m of methods; track m.value) { <mat-radio-button [value]="m.value"><mat-icon>{{ m.icon }}</mat-icon> {{ m.label }}</mat-radio-button> }
                </mat-radio-group>
                @if (form.controls.method.value === 'CARD') {
                  <mat-form-field class="full"><mat-label>Last 4 digits of the card</mat-label><input matInput formControlName="cardLast4" inputmode="numeric" maxlength="4" appDigitsOnly autocomplete="off" /><mat-hint>We never ask for the full card number here.</mat-hint><mat-error><app-field-error [control]="form.controls.cardLast4" label="Card digits" /></mat-error></mat-form-field>
                }
                @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
                @if (failed()) { <p class="err" role="alert">The last payment attempt failed: {{ failed() }}. Your seats are still held, you can retry.</p> }
                <div class="row" style="margin-top:12px">
                  <button mat-flat-button type="submit" [disabled]="busy()">{{ busy() ? 'Processing…' : 'Pay ' + (b.totalAmount | currency: 'INR') }}</button>
                  <button mat-stroked-button type="button" color="warn" [disabled]="busy()" (click)="pay$.next('FAILURE')">Cancel payment</button>
                </div>
              </form>
            </div>
            <div class="card">
              <h2>Order summary</h2>
              <p>{{ b.passengers.length }} passenger(s) · {{ b.coachType?.name }}<br />Departs {{ b.departureAt | date: 'EEE, dd MMM yyyy HH:mm' }}</p>
              <p class="row spread"><span>Total</span><strong>{{ b.totalAmount | currency: 'INR' }}</strong></p>
              <div class="timer" [class.low]="low()" role="timer" aria-live="off">Seats held for <strong>{{ b.expiresAt | timeLeft }}</strong></div>
              @if (payment(); as p) { <p class="muted">Payment ref {{ p.reference }} · <app-status-chip [status]="p.status" /></p> }
            </div>
          </div>
        }
      }
    }`,
  styles: [`.methods{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:12px}.timer{background:var(--c-surface-2);padding:10px 12px;border-radius:10px}.timer.low{background:#fde1e1;color:#8c1d1d}.ok mat-icon{color:#1e6b34;font-size:44px;width:44px;height:44px}`],
})
export class PaymentComponent {
  private readonly bookings = inject(BookingService); private readonly payments = inject(PaymentService);
  private readonly fb = inject(NonNullableFormBuilder); private readonly router = inject(Router); private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService); private readonly destroyRef = inject(DestroyRef);
  /** Provided by the route resolver. */
  readonly booking0 = input<Booking | null>(null, { alias: 'booking' });
  readonly booking = signal<Booking | null>(null);
  readonly payment = signal<Payment | null>(null);
  readonly busy = signal(false); readonly error = signal(''); readonly failed = signal('');
  readonly now = signal(Date.now());
  readonly methods: { value: PaymentMethod; label: string; icon: string }[] = [{ value: 'CARD', label: 'Card', icon: 'credit_card' }, { value: 'UPI', label: 'UPI', icon: 'qr_code_2' }, { value: 'NET_BANKING', label: 'Net banking', icon: 'account_balance' }, { value: 'WALLET', label: 'Wallet', icon: 'account_balance_wallet' }];
  readonly form = new FormGroup({ method: this.fb.control<PaymentMethod>('UPI'), cardLast4: new FormControl('', { nonNullable: true }) });
  readonly pay$ = new Subject<'SUCCESS' | 'FAILURE'>();
  readonly state = computed<'pay' | 'done' | 'expired'>(() => {
    const b = this.booking(); if (!b) return 'pay';
    if (b.status === 'CONFIRMED') return 'done';
    if (b.status === 'EXPIRED' || b.status === 'CANCELLED' || (b.expiresAt && new Date(b.expiresAt).getTime() < this.now())) return 'expired';
    return 'pay';
  });
  readonly pnr = computed(() => this.booking()?.pnr?.pnr ?? '');
  readonly low = computed(() => { const e = this.booking()?.expiresAt; return !!e && new Date(e).getTime() - this.now() < 120_000; });

  constructor() {
    effect(() => { const b = this.booking0(); untracked(() => { if (b) { this.booking.set(b); const open = b.payments?.find((p) => p.status === 'INITIATED' || p.status === 'FAILED'); if (open) this.failed.set(open.status === 'FAILED' ? (open.failureReason ?? 'declined') : ''); } }); });
    // conditional validation: card digits are required only for the CARD method
    this.form.controls.method.valueChanges.pipe(startWith(this.form.controls.method.value), takeUntilDestroyed()).subscribe((m) => {
      const c = this.form.controls.cardLast4;
      if (m === 'CARD') c.setValidators([Validators.required, Validators.pattern(/^\d{4}$/)]); else { c.clearValidators(); c.reset(''); }
      c.updateValueAndValidity();
    });
    interval(1000).pipe(map(() => Date.now()), takeUntilDestroyed()).subscribe((t) => this.now.set(t));
    // concatMap: initiate THEN confirm, strictly in order; exhaustMap outside: a second click during processing is ignored
    this.pay$.pipe(exhaustMap((outcome) => this.run(outcome)), takeUntilDestroyed()).subscribe();
  }

  private run(outcome: 'SUCCESS' | 'FAILURE') {
    this.form.markAllAsTouched(); if (this.form.invalid) return EMPTY;
    const b = this.booking()!; this.busy.set(true); this.error.set(''); this.failed.set('');
    const v = this.form.getRawValue();
    return this.payments.initiate({ bookingId: b.id, method: v.method, ...(v.method === 'CARD' ? { cardLast4: v.cardLast4 } : {}) }).pipe(
      tap((p) => this.payment.set(p)),
      concatMap((p) => this.payments.confirm(p.id, outcome)),
      tap((p) => this.payment.set(p)),
      concatMap((p) => this.bookings.get(b.id).pipe(tap((nb) => {
        this.booking.set(nb);
        if (p.status === 'SUCCEEDED') this.toast.success('Payment received. Your ticket is confirmed.');
        else this.failed.set(p.failureReason ?? 'payment was not completed');
      }))),
      catchError((e) => { const err = toApiError(e); this.error.set(err.message); if (err.status === 409 || err.status === 400) this.bookings.get(b.id).subscribe({ next: (nb) => this.booking.set(nb) }); return EMPTY; }),
      finalize(() => this.busy.set(false)),
    );
  }
}
