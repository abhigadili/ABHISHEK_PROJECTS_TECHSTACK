import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, concat, map, of, startWith, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BillingApiService } from '../../core/api/billing-api.service';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { EventBusService } from '../../core/services/event-bus.service';
import { NotificationCenterService, categoryOf } from '../../core/services/notification-center.service';
import { AppointmentFeedFacade } from '../appointments/appointment-feed.facade';
import { PageHeaderComponent, StatCardComponent } from '../../shared/components';
import { AppointmentStatusPipe, RelativeTimePipe } from '../../shared/pipes/pipes';
import { DashboardService, type DashboardStats } from './dashboard.service';

/**
 * Dashboard (Tailwind CSS). Data sources:
 *   forkJoin service   → patients / doctors / lab / billing / pharmacy figures (DashboardService)
 *   NgRx selectors     → appointment statistics (AppointmentFeedFacade → selectAppointmentStats)
 *   patient bills      → own invoices for PATIENT accounts
 *   notification centre→ unread count + recent activity (RxJS polling stream → toSignal)
 * `untracked()` keeps the "last refreshed" bookkeeping out of the reactive graph; the heavy lists below are `@defer` blocks that only
 * load when scrolled into view (on viewport) with placeholder / loading / error templates.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, PageHeaderComponent, StatCardComponent, AppointmentStatusPipe, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'Welcome back, ' + (auth.user()?.username ?? '')" [subtitle]="(auth.role() ?? '') + ' · ' + (today | date: 'dd MMM yyyy') + ' · refreshed ' + lastRefreshed()">
      <button actions type="button" class="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" (click)="refresh$.next()">Refresh</button>
    </app-page-header>
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <app-stat-card label="Total patients" icon="groups" [value]="stats()?.patients" [loading]="loading()" [unavailable]="!loading() && stats()?.patients == null" link="/patients" />
      <app-stat-card label="Total doctors" icon="medical_services" tone="green" [value]="stats()?.doctors" [loading]="loading()" [unavailable]="!loading() && stats()?.doctors == null" link="/doctors" />
      <app-stat-card label="Total appointments" icon="event" tone="violet" [value]="apptStats().total" [unavailable]="!feed.supported()" link="/appointments" />
      <app-stat-card label="Today's appointments" icon="today" tone="amber" [value]="apptStats().today" [unavailable]="!feed.supported()" link="/appointments/calendar" />
      <app-stat-card label="Pending appointments" icon="hourglass_top" tone="amber" [value]="apptStats().pending" hint="Booked, not yet completed" [unavailable]="!feed.supported()" link="/appointments" />
      <app-stat-card label="Completed appointments" icon="task_alt" tone="green" [value]="apptStats().completed" [unavailable]="!feed.supported()" link="/appointments" />
      <app-stat-card label="Pending lab tests" icon="science" tone="amber" [value]="labPending()" [loading]="loading()" [unavailable]="!loading() && labPending() == null" link="/lab/requests" />
      <app-stat-card label="Completed lab reports" icon="fact_check" tone="green" [value]="lab()?.COMPLETED" [loading]="loading()" [unavailable]="!loading() && lab() == null" link="/lab/reports" />
      <app-stat-card label="Pending bills" icon="receipt_long" tone="red" [value]="pendingBills()" [hint]="outstanding() ? (outstanding() | currency: 'INR') + ' outstanding' : ''" [unavailable]="pendingBills() == null" link="/billing/invoices" />
      <app-stat-card label="Payments collected" icon="account_balance_wallet" tone="green" [value]="collected() == null ? null : (collected() | currency: 'INR')" [unavailable]="collected() == null" link="/billing/payments" />
      <app-stat-card label="Outstanding balance" icon="currency_rupee" tone="violet" [value]="outstanding() == null ? null : (outstanding() | currency: 'INR')" [unavailable]="outstanding() == null" link="/billing" />
      @if (auth.can('pharmacy:access')) { <app-stat-card label="Low-stock medicines" icon="medication" tone="red" [value]="stats()?.lowStock" [loading]="loading()" [unavailable]="!loading() && stats()?.lowStock == null" link="/pharmacy/availability" /> }
      @else { <app-stat-card label="Unread notifications" icon="notifications" [value]="center.unreadCount()" link="/notifications" /> }
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-2">
      @defer (on viewport) {
        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><div class="mb-3 flex items-center justify-between"><h2 class="font-semibold">Upcoming appointments</h2><a routerLink="/appointments" class="text-xs text-brand-600">View all</a></div>
          @for (a of feed.upcoming(); track a.id) { <a [routerLink]="['/appointments', a.id]" class="flex items-center justify-between gap-2 border-b py-2.5 text-sm no-underline last:border-0"><span><b>{{ a.date | date: 'dd MMM yyyy' }}</b> {{ a.startTime }}–{{ a.endTime }}<span class="block text-xs text-slate-500">{{ auth.role() === 'PATIENT' ? a.doctorName : a.patientName + ' · ' + a.doctorName }}</span></span><span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class]="a.status | appointmentStatus: 'classes'">{{ a.status | appointmentStatus }}</span></a> }
            @empty { <p class="text-sm text-slate-500">{{ feed.supported() ? 'No upcoming appointments.' : 'Appointments are managed by doctors, patients and administrators.' }}</p> }</section>
      } @placeholder (minimum 200ms) { <div class="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800">&nbsp;</div> }
        @loading (after 100ms; minimum 300ms) { <div class="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700">&nbsp;</div> }
        @error { <p class="rounded-xl border border-red-200 p-5 text-sm text-red-700">The appointments widget could not be loaded.</p> }

      @defer (on viewport) {
        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><div class="mb-3 flex items-center justify-between"><h2 class="font-semibold">Recent activity</h2><a routerLink="/notifications" class="text-xs text-brand-600">All notifications</a></div>
          @for (n of recent(); track n.id) { <a [routerLink]="['/notifications', n.id]" class="flex items-start justify-between gap-3 border-b py-2.5 text-sm no-underline last:border-0"><span class="min-w-0"><span class="block truncate font-medium">{{ n.subject }}</span><span class="block truncate text-xs text-slate-500">{{ n.message }}</span></span><span class="shrink-0 text-right text-xs text-slate-500">{{ n.cat }}<br />{{ n.createdAt | relativeTime }}</span></a> }
            @empty { <p class="text-sm text-slate-500">No recent activity.</p> }</section>
      } @placeholder (minimum 200ms) { <div class="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800">&nbsp;</div> }
    </div>
    <p class="mt-6 text-xs text-slate-500">Figures are live from the backend; "n/a" means your role is not allowed to read that figure. Latest event: {{ lastEvent() }}.</p>`,
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  protected readonly feed = inject(AppointmentFeedFacade);
  protected readonly center = inject(NotificationCenterService);
  private readonly service = inject(DashboardService);
  private readonly bills = inject(BillingApiService);
  private readonly identity = inject(CurrentIdentityService);
  private readonly bus = inject(EventBusService);

  protected readonly today = new Date();
  protected readonly refresh$ = new Subject<void>();
  protected readonly lastRefreshed = signal('just now');
  protected readonly loading = signal(true);

  /** Re-runs on every refresh click (startWith → first load): switchMap cancels a refresh still in flight. */
  protected readonly stats = toSignal<DashboardStats | null>(this.refresh$.pipe(
    startWith(undefined),
    tap(() => this.loading.set(true)),
    // stale-while-revalidate: concat() emits the cached figures instantly (if any), then the fresh forkJoin result
    switchMap(() => concat(this.cached$(), this.service.stats().pipe(tap((st) => this.save(st))))),
    tap(() => { this.loading.set(false); this.lastRefreshed.set(new Date().toLocaleTimeString()); }),
  ), { initialValue: null });

  private readonly cacheKey = () => `hms.ng.dashboard.${this.auth.user()?.id ?? 'anon'}`;
  private cached$(): Observable<DashboardStats> { try { const raw = sessionStorage.getItem(this.cacheKey()); return raw ? of(JSON.parse(raw) as DashboardStats) : EMPTY; } catch { return EMPTY; } }
  private save(st: DashboardStats): void { try { sessionStorage.setItem(this.cacheKey(), JSON.stringify(st)); } catch { /* storage unavailable */ } }

  protected readonly apptStats = this.feed.stats;
  protected readonly lab = computed(() => this.stats()?.lab ?? null);
  protected readonly labPending = computed(() => { const l = this.lab(); return l ? l.REQUESTED + l.SAMPLE_COLLECTED + l.IN_PROGRESS : null; });

  /** PATIENT: own invoices (dependent request: identity first) – merged with the staff figures from forkJoin. */
  private readonly myBills = toSignal(this.identity.patient$.pipe(switchMap((p) => (p ? this.bills.forPatient(p.id).pipe(catchError(() => of(null))) : of(null)))), { initialValue: null });
  private readonly due = computed(() => (this.myBills() ?? []).filter((b) => b.status === 'PENDING' || b.status === 'OVERDUE'));
  protected readonly pendingBills = computed(() => (this.auth.role() === 'PATIENT' ? (this.myBills() ? this.due().length : null) : (this.stats()?.bills ? this.stats()!.bills!.counts.PENDING + this.stats()!.bills!.counts.OVERDUE : null)));
  protected readonly outstanding = computed(() => (this.auth.role() === 'PATIENT' ? (this.myBills() ? this.due().reduce((s, b) => s + b.totalAmount - b.paidAmount, 0) : null) : (this.stats()?.bills?.outstanding ?? null)));
  protected readonly collected = computed(() => (this.auth.role() === 'PATIENT' ? (this.myBills() ? this.myBills()!.reduce((s, b) => s + b.paidAmount, 0) : null) : (this.stats()?.bills?.collected ?? null)));

  protected readonly recent = toSignal(this.center.feed$.pipe(map((f) => f.slice(0, 6).map((n) => ({ ...n, cat: categoryOf(n.eventType) })))), { initialValue: [] });
  protected readonly lastEvent = toSignal(this.bus.lastActivity$, { initialValue: '' });

  constructor() {
    this.feed.load();
    // effect + untracked: reload the appointment feed when the role changes, WITHOUT making the effect depend on facade internals
    effect(() => { this.auth.role(); untracked(() => this.feed.load()); });
  }
}
