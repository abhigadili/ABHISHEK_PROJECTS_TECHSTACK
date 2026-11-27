import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EMPTY, catchError, debounceTime, distinctUntilChanged, finalize, switchMap, tap, of } from 'rxjs';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Booking, CancellationQuote } from '../../core/models/models';
import { BookingService } from '../../core/services/account.services';
import { AuthService } from '../../core/auth/auth.service';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService, EmptyStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/components/ui.components';
import { PnrPipe, StatusLabelPipe } from '../../shared/pipes/pipes';

@Component({
  selector: 'app-booking-detail',
  imports: [DatePipe, CurrencyPipe, TitleCasePipe, RouterLink, ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatExpansionModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTooltipModule, PageHeaderComponent, StatusChipComponent, EmptyStateComponent, PnrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (booking(); as b) {
      <app-page-header [title]="'PNR ' + (b.pnr?.pnr ? (b.pnr!.pnr | pnr) : 'pending')" [subtitle]="b.train.number + ' ' + b.train.name">
        <app-status-chip [status]="b.status" />
        @if (b.status === 'PENDING_PAYMENT') { <a mat-flat-button [routerLink]="['payment']"><mat-icon>payments</mat-icon>Pay now</a> }
        <button mat-stroked-button class="no-print" (click)="print()"><mat-icon>print</mat-icon>Print</button>
      </app-page-header>
      <div class="grid cols-2">
        <section class="card" aria-label="Journey">
          <h2>Journey</h2>
          <p><strong>{{ b.fromStation.name }}</strong> ({{ b.fromStation.code }})<br />→ <strong>{{ b.toStation.name }}</strong> ({{ b.toStation.code }})</p>
          <p>Departure: {{ b.departureAt | date: 'EEE, dd MMM yyyy, HH:mm' }}<br />Class: {{ b.coachType?.name }}<br />Booked: {{ b.createdAt | date: 'dd MMM yyyy, HH:mm' }}</p>
          <p class="row spread"><span>Total fare</span><strong>{{ b.totalAmount | currency: 'INR' }}</strong></p>
          @if (b.user && canSeeOwner()) { <p class="muted">Booked by {{ b.user.name }} ({{ b.user.email }})</p> }
        </section>
        <section class="card" aria-label="Payments and refunds">
          <h2>Payments & refunds</h2>
          @for (p of b.payments ?? []; track p.id) {
            <p class="row spread"><span>{{ p.method.replace('_', ' ') | titlecase }} · {{ p.reference }}<br /><small class="muted">{{ p.createdAt | date: 'dd MMM yyyy, HH:mm' }}</small></span><span><app-status-chip [status]="p.status" /> <strong>{{ p.amount | currency: 'INR' }}</strong>
              @if (p.status === 'SUCCEEDED' || p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED') { <a [routerLink]="['/app/payments', p.id, 'receipt']" matTooltip="Receipt"><mat-icon>receipt_long</mat-icon></a> }</span></p>
          } @empty { <p class="muted">No payment attempts yet.</p> }
          @for (r of b.refunds ?? []; track r.id) { <p class="row spread"><span>Refund {{ r.reference }}<br /><small class="muted">{{ r.processedAt ?? r.createdAt | date: 'dd MMM yyyy, HH:mm' }}</small></span><span><app-status-chip [status]="r.status" /> <strong>{{ r.amount | currency: 'INR' }}</strong></span></p> }
        </section>
      </div>
      <section class="card" style="margin-top:16px" aria-label="Passengers">
        <h2>Passengers</h2>
        <div class="scroll"><table class="t"><thead><tr><th>#</th><th>Name</th><th>Age / Gender</th><th>Coach / Seat</th><th>Fare</th><th>Status</th></tr></thead><tbody>
          @for (p of b.passengers; track p.id; let i = $index) {
            <tr [class.cx]="p.status === 'CANCELLED'"><td>{{ i + 1 }}</td><td>{{ p.name }}</td><td>{{ p.age }} / {{ p.gender | titlecase }}</td>
              <td>@if (p.seat?.seat; as s) { {{ s.coach?.number }} / {{ s.seatNumber }} · {{ s.seatType?.name }} } @else { — }</td><td>{{ p.fare | currency: 'INR' }}</td><td><app-status-chip [status]="p.status" /></td></tr>
          }
        </tbody></table></div>
      </section>

      @if (cancellable()) {
        <mat-expansion-panel class="no-print cancel" [(expanded)]="panel">
          <mat-expansion-panel-header><mat-panel-title><mat-icon>cancel</mat-icon>&nbsp;Cancel ticket</mat-panel-title></mat-expansion-panel-header>
          <p class="muted">Pick the passengers to cancel. The charge and refund below are calculated by the server from the current cancellation rules.</p>
          @for (p of livePassengers(); track p.id) { <mat-checkbox [checked]="selected().includes(p.id)" (change)="toggle(p.id, $event.checked)">{{ p.name }} ({{ p.fare | currency: 'INR' }})</mat-checkbox><br /> }
          @if (quote(); as q) {
            <div class="quote" role="status" aria-live="polite">
              <p>{{ q.hoursBefore }} h before departure → rule <strong>{{ q.rule.label }}</strong> ({{ q.rule.chargePercent }}% charge)</p>
              <p class="row spread"><span>Fare</span><span>{{ q.grossFare | currency: 'INR' }}</span></p>
              <p class="row spread"><span>Cancellation charge</span><span>− {{ q.chargeAmount | currency: 'INR' }}</span></p>
              <p class="row spread"><strong>Refund</strong><strong>{{ q.refundAmount | currency: 'INR' }}</strong></p>
            </div>
          }
          <mat-form-field class="full"><mat-label>Reason (optional)</mat-label><input matInput [formControl]="reason" maxlength="255" /></mat-form-field>
          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
          <button mat-flat-button color="warn" [disabled]="!selected().length || busy()" (click)="cancel()">{{ busy() ? 'Cancelling…' : 'Cancel selected passengers' }}</button>
        </mat-expansion-panel>
      } @else if (b.status === 'CONFIRMED' || b.status === 'PARTIALLY_CANCELLED') {
        <p class="muted">This ticket can no longer be cancelled (the train has departed).</p>
      }
      @if (b.cancellationSummary; as s) { <div class="card ok" role="status"><h2>Cancellation complete</h2><p>Charge {{ s.chargeAmount | currency: 'INR' }} ({{ s.rule.chargePercent }}%) · refund {{ s.refundAmount | currency: 'INR' }}</p></div> }
      @if (b.cancellations?.length) {
        <section class="card" style="margin-top:16px"><h2>Cancellation history</h2>
          @for (c of b.cancellations; track c.id) { <p class="row spread"><span>{{ c.createdAt | date: 'dd MMM yyyy, HH:mm' }} · {{ c.passengerIds.length }} passenger(s) @if (c.reason) { · “{{ c.reason }}” }</span><span>charge {{ c.chargeAmount | currency: 'INR' }} · refund {{ c.refundAmount | currency: 'INR' }}</span></p> }
        </section>
      }
    } @else { <app-empty-state icon="confirmation_number" title="Booking not found" /> }`,
  styles: [`.t{width:100%;border-collapse:collapse;min-width:520px}.t th,.t td{text-align:left;padding:8px;border-bottom:1px solid var(--c-border)}.scroll{overflow-x:auto}.cx{opacity:.55;text-decoration:line-through}.cancel{margin-top:16px}.quote{background:var(--c-surface-2);padding:8px 14px;border-radius:10px;margin:12px 0}.ok{margin-top:16px;border-color:#7cc58a}`],
})
export class BookingDetailComponent {
  private readonly api = inject(BookingService); private readonly toast = inject(ToastService); private readonly confirm = inject(ConfirmService); private readonly auth = inject(AuthService);
  readonly bookingIn = input<Booking | null>(null, { alias: 'booking' });
  readonly booking = signal<Booking | null>(null);
  readonly selected = signal<number[]>([]);
  readonly quote = signal<CancellationQuote | null>(null);
  readonly busy = signal(false); readonly error = signal('');
  panel = false;
  readonly reason = new FormControl('', { nonNullable: true });
  readonly livePassengers = computed(() => this.booking()?.passengers.filter((p) => p.status === 'CONFIRMED') ?? []);
  /** UI hint only: the backend decides eligibility (status + departure time) and re-checks on submit. */
  readonly cancellable = computed(() => { const b = this.booking(); return !!b && ['CONFIRMED', 'PARTIALLY_CANCELLED'].includes(b.status) && new Date(b.departureAt).getTime() > Date.now() && this.livePassengers().length > 0; });
  readonly canSeeOwner = computed(() => this.auth.can('booking:read-all'));

  constructor() {
    // untracked: the effect must depend ONLY on the resolver input, not on the booking signal it writes (otherwise it would overwrite updates)
    effect(() => { const b = this.bookingIn(); untracked(() => { if (b) { this.booking.set(b); this.selected.set(this.livePassengers().map((p) => p.id)); } }); });
    // quote follows the selection; switchMap cancels stale quote requests
    toObservable(computed(() => ({ id: this.booking()?.id, sel: this.selected() }))).pipe(
      debounceTime(150), distinctUntilChanged((a, b) => a.id === b.id && a.sel.join() === b.sel.join()),
      switchMap(({ id, sel }) => (id && sel.length && this.cancellable() ? this.api.quote(id, sel).pipe(catchError(() => of(null))) : of(null))),
      takeUntilDestroyed(),
    ).subscribe((q) => this.quote.set(q));
  }
  toggle(id: number, on: boolean) { this.selected.update((s) => (on ? [...new Set([...s, id])] : s.filter((x) => x !== id))); }
  print() { window.print(); }
  async cancel() {
    const b = this.booking()!; const q = this.quote();
    const ok = await this.confirm.ask({ title: 'Cancel selected passengers?', message: q ? `A charge of ${q.chargeAmount} will apply and ${q.refundAmount} will be refunded. This cannot be undone.` : 'This cannot be undone.', confirmText: 'Yes, cancel', danger: true });
    if (!ok) return;
    this.busy.set(true); this.error.set('');
    const all = this.selected().length === this.livePassengers().length;
    this.api.cancel(b.id, { ...(all ? {} : { passengerIds: this.selected() }), ...(this.reason.value ? { reason: this.reason.value } : {}) }).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (nb) => { this.booking.set(nb); this.selected.set(this.livePassengers().map((p) => p.id)); this.panel = false; this.toast.success('Cancellation confirmed.'); },
      error: (e) => this.error.set(toApiError(e).message),
    });
  }
}
