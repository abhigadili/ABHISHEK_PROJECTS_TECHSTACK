import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { catchError, filter, of, switchMap } from 'rxjs';
import type { Receipt } from '../../core/models/models';
import { PaymentService } from '../../core/services/account.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ErrorStateComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { PnrPipe } from '../../shared/pipes/pipes';

/** Printable receipt rendered from GET /payments/:id/receipt (invoice data comes from the backend). */
@Component({
  selector: 'app-receipt', imports: [CurrencyPipe, DatePipe, TitleCasePipe, RouterLink, MatButtonModule, MatIconModule, PageHeaderComponent, ErrorStateComponent, PnrPipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Receipt" subtitle="Keep this for your records"><button mat-flat-button class="no-print" (click)="print()"><mat-icon>print</mat-icon>Print</button><a mat-stroked-button class="no-print" routerLink="/app/payments">Back</a></app-page-header>
    @if (data(); as r) {
      <article class="card rc">
        <div class="row spread"><h2>{{ r.receiptNo }}</h2><span class="muted">Issued {{ r.issuedAt | date: 'dd MMM yyyy, HH:mm' }}</span></div>
        @if (r.customer) { <p>Billed to <strong>{{ r.customer.name }}</strong> ({{ r.customer.email }})</p> }
        <p><strong>{{ r.booking.train.number }} {{ r.booking.train.name }}</strong><br />{{ r.booking.from.name }} → {{ r.booking.to.name }} · departs {{ r.booking.departureAt | date: 'dd MMM yyyy HH:mm' }}<br />PNR {{ r.booking.pnr | pnr }}</p>
        <table class="t"><thead><tr><th>Passenger</th><th>Age/Gender</th><th>Status</th><th class="e">Fare</th></tr></thead><tbody>@for (p of r.booking.passengers; track $index) { <tr><td>{{ p.name }}</td><td>{{ p.age }} / {{ p.gender | titlecase }}</td><td>{{ p.status }}</td><td class="e">{{ p.fare | currency: 'INR' }}</td></tr> }</tbody></table>
        <p class="row spread"><span>Paid by {{ r.payment.method.replace('_', ' ') | titlecase }}@if (r.payment.cardLast4) { ••••{{ r.payment.cardLast4 }} } · ref {{ r.payment.reference }}</span><strong>{{ r.payment.amount | currency: 'INR' }}</strong></p>
        @for (f of r.refunds; track f.id) { <p class="row spread muted"><span>Refund {{ f.reference }}</span><span>− {{ f.amount | currency: 'INR' }}</span></p> }
      </article>
    } @else if (error()) { <app-error-state [message]="error()!" /> }`,
  styles: [`.rc{max-width:760px}.t{width:100%;border-collapse:collapse}.t th,.t td{text-align:left;padding:8px;border-bottom:1px solid var(--c-border)}.e{text-align:right!important}`],
})
export class ReceiptComponent {
  private readonly api = inject(PaymentService);
  readonly id = input.required<string>();
  readonly data = signal<Receipt | null>(null); readonly error = signal<string | null>(null);
  constructor() {
    toObservable(this.id).pipe(filter(Boolean), switchMap((id) => this.api.receipt(+id).pipe(catchError((e) => { this.error.set(toApiError(e).message); return of(null); }))), takeUntilDestroyed()).subscribe((x) => this.data.set(x));
  }
  print() { window.print(); }
}
