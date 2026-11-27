import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import type { Booking, Refund } from '../../core/models/models';
import { BookingService, RefundService } from '../../core/services/account.services';
import { selectLatestUnread, selectUnread } from '../../store/notifications/notifications.store';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/components/ui.components';
import { PnrPipe } from '../../shared/pipes/pipes';
import { DigitsOnlyDirective } from '../../shared/directives/directives';
import { SearchFormComponent } from '../trains/search-form.component';
import { AsyncPipe } from '@angular/common';

/** Passenger dashboard: every block is loaded from the API in parallel (forkJoin); a failed block degrades to an empty list. */
@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, AsyncPipe, FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, PageHeaderComponent, StatusChipComponent, EmptyStateComponent, ErrorStateComponent, PnrPipe, DigitsOnlyDirective, SearchFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'Welcome, ' + firstName()" subtitle="Here is what's happening with your journeys" />
    <div class="card" style="margin-bottom:16px"><h2>Quick train search</h2>
      @defer (on viewport) { <app-search-form /> } @placeholder { <div style="min-height:200px"></div> }</div>
    @if (data(); as d) {
      <div class="grid cols-4" style="margin-bottom:16px">
        <div class="card stat"><b>{{ d.upcoming.length }}</b><span>Upcoming journeys</span></div>
        <div class="card stat"><b>{{ d.pending.length }}</b><span>Awaiting payment</span></div>
        <div class="card stat"><b>{{ unread$ | async }}</b><span>Unread notifications</span></div>
        <div class="card stat"><b>{{ d.refunds.length }}</b><span>Recent refunds</span></div>
      </div>
      <div class="grid cols-2">
        <section class="card"><h2>Upcoming journeys</h2>
          @for (b of d.upcoming; track b.id) { <a class="item" [routerLink]="['/app/bookings', b.id]"><div><strong>{{ b.train.number }} {{ b.train.name }}</strong><br /><small class="muted">{{ b.fromStation.code }} → {{ b.toStation.code }} · {{ b.departureAt | date: 'EEE dd MMM, HH:mm' }}</small></div><app-status-chip [status]="b.status" /></a> }
          @empty { <app-empty-state icon="luggage" title="No upcoming journeys" message="Plan your next trip." /> }</section>
        <section class="card"><h2>Pending payments</h2>
          @for (b of d.pending; track b.id) { <a class="item" [routerLink]="['/app/bookings', b.id, 'payment']"><div><strong>{{ b.train.number }} {{ b.train.name }}</strong><br /><small class="muted">{{ b.totalAmount | currency: 'INR' }} · pay before the hold expires</small></div><mat-icon>chevron_right</mat-icon></a> }
          @empty { <p class="muted">Nothing is waiting for payment.</p> }</section>
        <section class="card"><h2>Recent bookings</h2>
          @for (b of d.recent; track b.id) { <a class="item" [routerLink]="['/app/bookings', b.id]"><div><strong>PNR {{ b.pnr?.pnr | pnr }}</strong><br /><small class="muted">{{ b.fromStation.code }} → {{ b.toStation.code }} · {{ b.totalAmount | currency: 'INR' }}</small></div><app-status-chip [status]="b.status" /></a> }
          @empty { <p class="muted">No bookings yet.</p> }
          <p><a routerLink="/app/bookings">All bookings →</a></p></section>
        <section class="card"><h2>PNR status</h2>
          <form #f="ngForm" (ngSubmit)="goPnr(f)" class="row" novalidate>
            <mat-form-field style="flex:1;min-width:160px"><mat-label>10-digit PNR</mat-label><input matInput name="pnr" [(ngModel)]="pnr" required pattern="\\d{10}" maxlength="10" inputmode="numeric" appDigitsOnly /></mat-form-field>
            <button mat-flat-button type="submit" [disabled]="f.invalid">Check</button></form>
          <h2>Refunds & cancellations</h2>
          @for (r of d.refunds; track r.id) { <p class="row spread"><span>{{ r.reference }}<br /><small class="muted">{{ r.createdAt | date: 'dd MMM' }}</small></span><strong>{{ r.amount | currency: 'INR' }}</strong></p> } @empty { <p class="muted">No refunds.</p> }</section>
        <section class="card"><h2>Notifications</h2>
          @for (n of latest$ | async; track n.id) { <p><strong>{{ n.title }}</strong><br /><small class="muted">{{ n.message }}</small></p> } @empty { <p class="muted">You're all caught up.</p> }
          <p><a routerLink="/app/notifications">All notifications →</a></p></section>
      </div>
    } @else if (error()) { <app-error-state [message]="error()!" (retry)="load()" /> }
    @else { <div class="card muted" role="status">Loading your dashboard…</div> }`,
  styles: [`.item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--c-border);text-decoration:none;color:inherit}.item:last-of-type{border-bottom:0}`],
})
export class DashboardComponent implements OnInit {
  private readonly bookings = inject(BookingService); private readonly refunds = inject(RefundService); private readonly router = inject(Router); private readonly store = inject(Store);
  readonly auth = inject(AuthService);
  readonly unread$ = this.store.select(selectUnread); readonly latest$ = this.store.select(selectLatestUnread);
  readonly data = signal<{ upcoming: Booking[]; pending: Booking[]; recent: Booking[]; refunds: Refund[] } | null>(null); readonly error = signal<string | null>(null);
  pnr = '';
  firstName() { return (this.auth.user()?.name ?? '').split(' ')[0]; }
  ngOnInit() { this.load(); }
  load() {
    const safe = <T,>(o: import('rxjs').Observable<{ items: T[] }>) => o.pipe(catchError(() => of({ items: [] as T[] })));
    forkJoin({
      upcoming: safe(this.bookings.list({ scope: 'upcoming', size: 5, sort: 'departureAt', dir: 'asc' })), pending: safe(this.bookings.list({ status: 'PENDING_PAYMENT', size: 5 })),
      recent: safe(this.bookings.list({ size: 5 })), refunds: safe(this.refunds.list({ size: 3 })),
    }).subscribe({ next: (r) => this.data.set({ upcoming: r.upcoming.items.filter((b) => b.status !== 'PENDING_PAYMENT'), pending: r.pending.items, recent: r.recent.items, refunds: r.refunds.items }), error: () => this.error.set('Could not load the dashboard.') });
  }
  goPnr(f: NgForm) { if (f.valid) void this.router.navigate(['/pnr'], { queryParams: { pnr: this.pnr } }); }
}
