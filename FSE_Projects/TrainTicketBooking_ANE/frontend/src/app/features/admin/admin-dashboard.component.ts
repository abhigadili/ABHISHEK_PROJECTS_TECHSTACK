import { CurrencyPipe, DatePipe, DecimalPipe, KeyValuePipe, PercentPipe, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of } from 'rxjs';
import type { Stats } from '../../core/models/models';
import { AdminService } from '../../core/services/account.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ErrorStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/components/ui.components';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, SlicePipe, RouterLink, MatButtonModule, MatIconModule, PageHeaderComponent, StatusChipComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Operations dashboard" [subtitle]="s() ? 'As of ' + (s()!.asOf | date: 'dd MMM yyyy') : ''"><button mat-stroked-button (click)="load()"><mat-icon>refresh</mat-icon>Refresh</button></app-page-header>
    @if (s(); as d) {
      <div class="grid cols-4">
        <div class="card stat"><b>{{ d.todayBookings | number }}</b><span>Bookings today</span></div>
        <div class="card stat"><b>{{ d.payments.net | currency: 'INR' : 'symbol' : '1.0-0' }}</b><span>Net revenue ({{ d.payments.count }} payments)</span></div>
        <div class="card stat"><b>{{ d.payments.refunded | currency: 'INR' : 'symbol' : '1.0-0' }}</b><span>Refunded ({{ d.payments.refundCount }})</span></div>
        <div class="card stat"><b>{{ d.cancellations.charges | currency: 'INR' : 'symbol' : '1.0-0' }}</b><span>Cancellation charges ({{ d.cancellations.count }})</span></div>
        <div class="card stat"><b>{{ d.users | number }}</b><span>Users</span></div>
        <div class="card stat"><b>{{ d.trains | number }}</b><span>Trains</span></div>
        <div class="card stat"><b>{{ d.stations | number }}</b><span>Stations</span></div>
        <div class="card stat"><b>{{ refundRate() | percent: '1.0-1' }}</b><span>Refund ratio</span></div>
      </div>
      <div class="grid cols-2" style="margin-top:16px">
        <section class="card"><h2>Bookings, last 14 days</h2>
          @defer (on viewport) {
            <div class="bars" role="img" [attr.aria-label]="'Bookings per day, maximum ' + max()">
              @for (p of d.perDay; track p.date) { <div class="bar" [title]="p.date + ': ' + p.count"><span [style.height.%]="(p.count / max()) * 100"></span><small>{{ p.date | slice: 8 }}</small></div> }
              @empty { <p class="muted">No bookings in this period.</p> }
            </div>
          } @placeholder { <div style="min-height:160px"></div> }
        </section>
        <section class="card"><h2>Bookings by status</h2>
          @for (b of d.bookingsByStatus; track b.status) { <p class="row spread"><app-status-chip [status]="b.status" /><strong>{{ b.count }}</strong></p> }
          <h2 style="margin-top:16px">Top trains</h2>
          @for (t of d.topTrains; track t.id) { <p class="row spread"><a [routerLink]="['/admin/trains', t.id]">{{ t.number }} {{ t.name }}</a><strong>{{ t.bookings }}</strong></p> } @empty { <p class="muted">No confirmed bookings yet.</p> }
        </section>
      </div>
    } @else if (error()) { <app-error-state [message]="error()!" (retry)="load()" /> }
    @else { <div class="card muted" role="status">Loading…</div> }`,
  styles: [`.bars{display:flex;align-items:flex-end;gap:6px;height:180px}.bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}.bar span{width:100%;background:var(--c-primary);border-radius:4px 4px 0 0;min-height:2px}.bar small{font-size:.7rem;color:var(--c-muted)}`],
})
export class AdminDashboardComponent implements OnInit {
  private readonly api = inject(AdminService);
  readonly s = signal<Stats | null>(null); readonly error = signal<string | null>(null);
  readonly max = computed(() => Math.max(1, ...(this.s()?.perDay.map((p) => p.count) ?? [1])));
  readonly refundRate = computed(() => { const p = this.s()?.payments; return p && p.gross ? p.refunded / p.gross : 0; });
  ngOnInit() { this.load(); }
  load() { this.error.set(null); this.api.stats().pipe(catchError((e) => { this.error.set(toApiError(e).message); return of(null); })).subscribe((x) => x && this.s.set(x)); }
}
