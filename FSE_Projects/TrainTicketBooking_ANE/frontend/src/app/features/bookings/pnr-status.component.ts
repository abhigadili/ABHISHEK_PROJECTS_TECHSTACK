import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import type { Booking } from '../../core/models/models';
import { BookingService } from '../../core/services/account.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { PageHeaderComponent, StatusChipComponent } from '../../shared/components/ui.components';
import { PnrPipe } from '../../shared/pipes/pipes';
import { DigitsOnlyDirective } from '../../shared/directives/directives';
import { Router } from '@angular/router';
import { effect } from '@angular/core';

/** PNR status lookup. Template-driven form with a pattern validator (10 digits). The backend authorises (own booking / staff). */
@Component({
  selector: 'app-pnr-status',
  imports: [FormsModule, DatePipe, CurrencyPipe, TitleCasePipe, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, PageHeaderComponent, StatusChipComponent, PnrPipe, DigitsOnlyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container narrow">
      <app-page-header title="PNR status" subtitle="Check the status of any ticket you are allowed to see" />
      <form class="card row" #f="ngForm" (ngSubmit)="lookup(f)" novalidate>
        <mat-form-field style="flex:1;min-width:220px"><mat-label>10-digit PNR</mat-label>
          <input matInput name="pnr" [(ngModel)]="pnr" #p="ngModel" required pattern="\\d{10}" minlength="10" maxlength="10" inputmode="numeric" appDigitsOnly />
          @if (p.invalid && (p.touched || f.submitted)) { <mat-error>{{ p.errors?.['required'] ? 'PNR is required' : 'PNR is exactly 10 digits' }}</mat-error> }
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="busy()"><mat-icon>search</mat-icon>Check</button>
      </form>
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      @if (booking(); as b) {
        <div class="card" style="margin-top:16px" role="region" aria-label="PNR result">
          <div class="row spread"><h2>PNR {{ b.pnr?.pnr | pnr }}</h2><app-status-chip [status]="b.status" /></div>
          <p><strong>{{ b.train.number }} {{ b.train.name }}</strong><br />{{ b.fromStation.name }} → {{ b.toStation.name }}<br />Departs {{ b.departureAt | date: 'EEE, dd MMM yyyy HH:mm' }} · {{ b.coachType?.name }}</p>
          <table class="t"><thead><tr><th>Passenger</th><th>Age/Gender</th><th>Seat</th><th>Status</th></tr></thead><tbody>
            @for (p of b.passengers; track p.id) { <tr><td>{{ p.name }}</td><td>{{ p.age }} / {{ p.gender | titlecase }}</td><td>{{ p.seat?.seat?.coach?.number }}{{ p.seat?.seat ? ' / ' + p.seat?.seat?.seatNumber + ' ' + (p.seat?.seat?.seatType?.name ?? '') : '—' }}</td><td><app-status-chip [status]="p.status" /></td></tr> }
          </tbody></table>
          <p class="row spread"><strong>Total {{ b.totalAmount | currency: 'INR' }}</strong><a mat-stroked-button [routerLink]="['/app/bookings', b.id]">Open booking</a></p>
        </div>
      }
    </div>`,
  styles: [`.narrow{max-width:780px}.t{width:100%;border-collapse:collapse}.t th,.t td{text-align:left;padding:8px;border-bottom:1px solid var(--c-border)}`],
})
export class PnrStatusComponent {
  private readonly api = inject(BookingService);
  readonly initial = input<string | undefined>(undefined, { alias: 'pnr' });
  pnr = '';
  readonly busy = signal(false); readonly error = signal(''); readonly booking = signal<Booking | null>(null);
  constructor() { effect(() => { const p = this.initial(); if (p && /^\d{10}$/.test(p) && !this.pnr) { this.pnr = p; this.run(); } }); }
  lookup(f: NgForm) { if (f.invalid) return; this.run(); }
  private run() {
    this.busy.set(true); this.error.set(''); this.booking.set(null);
    this.api.byPnr(this.pnr).pipe(finalize(() => this.busy.set(false))).subscribe({ next: (b) => this.booking.set(b), error: (e) => this.error.set(toApiError(e).message) });
  }
}
