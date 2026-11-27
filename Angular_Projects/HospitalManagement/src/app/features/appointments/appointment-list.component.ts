import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { combineLatest, debounceTime, map, startWith, distinctUntilChanged } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import type { Appointment, AppointmentStatus } from '../../core/models';
import { AppointmentsActions } from '../../state/actions/appointments.actions';
import { selectAllAppointments, selectAppointmentsLoading } from '../../state/selectors/appointments.selectors';
import { ConfirmService, EmptyStateComponent, PageHeaderComponent, PagerComponent, SkeletonComponent } from '../../shared/components';
import { HasPermissionDirective, HighlightDirective } from '../../shared/directives/directives';
import { AppointmentStatusPipe } from '../../shared/pipes/pipes';
import { sortBy, todayISO } from '../../shared/utilities/helpers';
import { AppointmentFeedFacade } from './appointment-feed.facade';

const PAGE_SIZE = 10;
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['BOOKED', 'COMPLETED', 'CANCELLED', 'MISSED', 'RESCHEDULED'];

/**
 * Appointment list (Tailwind). APPOINTMENT FILTERS WITH combineLatest: the NgRx feed ($select) and the typed filter form
 * (valueChanges, debounced) are combined into one filtered/sorted view → toSignal for the template. Cancelling dispatches the
 * optimistic NgRx `cancel` action (effect: concatMap + rollback on failure).
 */
@Component({
  selector: 'app-appointment-list',
  standalone: true,
  imports: [DatePipe, CurrencyPipe, RouterLink, ReactiveFormsModule, PageHeaderComponent, EmptyStateComponent, SkeletonComponent, PagerComponent, AppointmentStatusPipe, HighlightDirective, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Appointments" [subtitle]="feed.scopeLabel()">
      <a actions routerLink="calendar" class="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">Calendar</a>
      <a actions routerLink="availability" class="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">Availability</a>
      <a actions *appHasPermission="'appointments:book'" routerLink="book" class="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white no-underline">Book appointment</a>
    </app-page-header>
    <form [formGroup]="filters" class="mb-4 flex flex-wrap items-end gap-3" aria-label="Appointment filters">
      <label class="text-xs font-medium text-slate-500">Search<input formControlName="q" placeholder="Patient, doctor, reason…" class="mt-1 block h-9 w-56 rounded-md border border-slate-300 bg-transparent px-2 text-sm text-inherit dark:border-slate-600" /></label>
      <label class="text-xs font-medium text-slate-500">Status<select formControlName="status" class="mt-1 block h-9 rounded-md border border-slate-300 bg-transparent px-2 text-sm text-inherit dark:border-slate-600"><option value="">All</option>@for (s of statuses; track s) { <option [value]="s">{{ s | appointmentStatus }}</option> }</select></label>
      <label class="text-xs font-medium text-slate-500">From<input type="date" formControlName="from" class="mt-1 block h-9 rounded-md border border-slate-300 bg-transparent px-2 text-sm text-inherit dark:border-slate-600" /></label>
      <label class="text-xs font-medium text-slate-500">To<input type="date" formControlName="to" class="mt-1 block h-9 rounded-md border border-slate-300 bg-transparent px-2 text-sm text-inherit dark:border-slate-600" /></label>
      <button type="button" class="h-9 rounded-md px-3 text-sm text-brand-600" (click)="upcoming()">Upcoming</button>
      <button type="button" class="h-9 rounded-md px-3 text-sm text-slate-500" (click)="filters.reset()">Clear</button>
    </form>
    @if (loading() && all().length === 0) { <app-skeleton [rows]="5" /> }
    @else if (view().total === 0) { <app-empty-state [title]="all().length ? 'No appointments match the filters' : 'No appointments yet'" description="Book an appointment to see it here." /> }
    @else {
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table class="w-full text-sm" aria-label="Appointments"><thead><tr class="border-b text-left text-xs uppercase text-slate-500">
          <th class="p-3"><button (click)="sort('date')">When{{ arrow('date') }}</button></th>@if (auth.role() !== 'PATIENT') { <th><button (click)="sort('patient')">Patient{{ arrow('patient') }}</button></th> }@if (auth.role() !== 'DOCTOR') { <th><button (click)="sort('doctor')">Doctor{{ arrow('doctor') }}</button></th> }
          <th>Reason</th><th><button (click)="sort('status')">Status{{ arrow('status') }}</button></th><th class="text-right">Fee</th><th></th></tr></thead>
          <tbody>@for (a of view().items; track a.id) {
            <tr appHighlight class="cursor-pointer border-b last:border-0" [class.opacity-60]="a.status === 'CANCELLED'" (click)="open(a)">
              <td class="p-3"><div class="font-semibold">{{ a.date | date: 'dd MMM yyyy' }}</div><div class="text-xs text-slate-500">{{ a.startTime }}–{{ a.endTime }}</div></td>
              @if (auth.role() !== 'PATIENT') { <td>{{ a.patientName }}</td> }@if (auth.role() !== 'DOCTOR') { <td>{{ a.doctorName }}</td> }
              <td class="max-w-[16rem] truncate text-slate-500">{{ a.reason ?? '—' }}</td>
              <td><span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class]="a.status | appointmentStatus: 'classes'">{{ a.status | appointmentStatus }}</span></td>
              <td class="text-right">{{ a.fee | currency: 'INR' }}<div class="text-xs text-slate-500">{{ a.paymentStatus }}</div></td>
              <td class="whitespace-nowrap pr-3 text-right" (click)="$event.stopPropagation()">
                @if (a.status === 'BOOKED') {
                  <a [routerLink]="[a.id, 'reschedule']" class="px-2 text-brand-600" [attr.aria-label]="'Reschedule appointment ' + a.id">Reschedule</a>
                  <button class="px-2 text-red-600" (click)="cancel(a)" [attr.aria-label]="'Cancel appointment ' + a.id">Cancel</button>
                  <button *appHasPermission="'appointments:complete'" class="px-2 text-emerald-700" (click)="complete(a)" [attr.aria-label]="'Complete appointment ' + a.id">Complete</button>
                }</td></tr> }</tbody></table></div>
      <app-pager [page]="page()" [size]="pageSize" [total]="view().total" label="appointments" (pageChange)="goto($event)" />
    }`,
})
export class AppointmentListComponent {
  protected readonly auth = inject(AuthService);
  protected readonly feed = inject(AppointmentFeedFacade);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly confirmDialog = inject(ConfirmService);
  protected readonly statuses = APPOINTMENT_STATUSES;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly filters = inject(NonNullableFormBuilder).group({ q: [''], status: [''], from: [''], to: [''] });
  protected readonly all = this.store.selectSignal(selectAllAppointments);
  protected readonly loading = this.store.selectSignal(selectAppointmentsLoading);
  protected readonly sortKey = signal('date');
  protected readonly sortDir = signal<'asc' | 'desc'>('desc');
  private readonly pageIndex = signal(0);

  /** combineLatest: store feed (Observable from a signal) + debounced, de-duplicated filter form values. */
  private readonly filtered = toSignal(
    combineLatest([
      toObservable(this.all),
      this.filters.valueChanges.pipe(startWith(this.filters.getRawValue()), debounceTime(250), distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))),
    ]).pipe(map(([all, f]) => {
      const q = (f.q ?? '').toLowerCase();
      return all.filter((a) => (!f.status || a.status === f.status) && (!f.from || a.date >= f.from) && (!f.to || a.date <= f.to) && (!q || [a.patientName, a.doctorName, a.reason ?? '', a.billNumber ?? '', String(a.id)].some((x) => x.toLowerCase().includes(q))));
    })),
    { initialValue: [] as Appointment[] },
  );
  protected readonly page = computed(() => Math.min(this.pageIndex(), Math.max(Math.ceil(this.filtered().length / PAGE_SIZE) - 1, 0)));
  protected readonly view = computed(() => {
    const k = this.sortKey();
    const key = (a: Appointment) => (k === 'patient' ? a.patientName : k === 'doctor' ? a.doctorName : k === 'status' ? a.status : a.date + a.startTime);
    const sorted = sortBy(this.filtered(), key, this.sortDir());
    return { total: sorted.length, items: sorted.slice(this.page() * PAGE_SIZE, (this.page() + 1) * PAGE_SIZE) };
  });
  constructor() { this.feed.load(); }

  protected arrow(k: string) { return this.sortKey() === k ? (this.sortDir() === 'asc' ? ' ↑' : ' ↓') : ''; }
  protected sort(k: string) { this.sortDir.set(this.sortKey() === k && this.sortDir() === 'asc' ? 'desc' : 'asc'); this.sortKey.set(k); }
  protected goto(p: number) { this.pageIndex.set(p); }
  protected upcoming() { this.filters.patchValue({ from: todayISO(), to: '', status: 'BOOKED' }); }
  protected open(a: Appointment) { void this.router.navigate(['/appointments', a.id]); }
  protected cancel(a: Appointment) {
    this.confirmDialog.confirm({ title: 'Cancel this appointment?', message: `${a.date} at ${a.startTime} with ${a.doctorName}. The slot is released and an unpaid consultation bill is cancelled.`, confirmLabel: 'Cancel appointment', destructive: true, askReason: true })
      .subscribe((r) => { if (r.confirmed) this.store.dispatch(AppointmentsActions.cancel({ id: a.id, reason: r.reason })); });
  }
  protected complete(a: Appointment) {
    this.confirmDialog.confirm({ title: 'Mark as completed?', message: 'The backend only allows this once the appointment time has started.', confirmLabel: 'Mark completed', askReason: true, reasonLabel: 'Doctor notes (optional)' })
      .subscribe((r) => { if (r.confirmed) this.store.dispatch(AppointmentsActions.complete({ id: a.id, notes: r.reason })); });
  }
}
