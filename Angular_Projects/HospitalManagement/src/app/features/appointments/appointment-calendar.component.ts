import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import type { Appointment } from '../../core/models';
import { selectAllAppointments } from '../../state/selectors/appointments.selectors';
import { PageHeaderComponent } from '../../shared/components';
import { AppointmentStatusPipe } from '../../shared/pipes/pipes';
import { toISODate } from '../../shared/utilities/helpers';
import { AppointmentFeedFacade } from './appointment-feed.facade';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Month calendar (Tailwind CSS Grid, 7 columns). Appointments come from the NgRx feed; grouping by date is a computed signal. */
@Component({
  selector: 'app-appointment-calendar',
  standalone: true,
  imports: [DatePipe, RouterLink, PageHeaderComponent, AppointmentStatusPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Appointment calendar" [subtitle]="feed.scopeLabel()"><a actions routerLink="/appointments" class="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">List view</a></app-page-header>
    <div class="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div class="mb-3 flex items-center justify-between"><h2 class="text-lg font-semibold">{{ month() | date: 'MMMM yyyy' }}</h2>
          <div class="flex gap-1"><button class="h-9 w-9 rounded-md border" aria-label="Previous month" (click)="shift(-1)">‹</button><button class="rounded-md border px-3 text-sm" (click)="today()">Today</button><button class="h-9 w-9 rounded-md border" aria-label="Next month" (click)="shift(1)">›</button></div></div>
        <div class="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700" role="grid" aria-label="Appointment calendar">
          @for (d of dow; track d) { <div class="bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold text-slate-500 dark:bg-slate-800" role="columnheader">{{ d }}</div> }
          @for (c of cells(); track c.iso) {
            <button type="button" role="gridcell" [attr.aria-selected]="c.iso === selected()" [attr.aria-label]="c.day + ': ' + c.active + ' appointments'" (click)="selected.set(c.iso)"
              class="flex min-h-16 flex-col items-start gap-1 bg-white p-1.5 text-left hover:bg-sky-50 sm:min-h-20 dark:bg-slate-900 dark:hover:bg-slate-800" [class.opacity-40]="!c.inMonth" [class.ring-2]="c.iso === selected()" [class.ring-inset]="c.iso === selected()" [class.ring-brand-500]="c.iso === selected()">
              <span class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold" [class]="c.iso === todayIso ? 'bg-brand-600 text-white' : ''">{{ c.day }}</span>
              @if (c.active > 0) { <span class="rounded bg-sky-100 px-1.5 text-[10px] font-semibold text-sky-800">{{ c.active }} appt{{ c.active > 1 ? 's' : '' }}</span> }
              @if (c.cancelled > 0) { <span class="text-[10px] text-slate-500">{{ c.cancelled }} cancelled</span> }
            </button> }
        </div>
      </section>
      <section class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 class="mb-3 font-semibold">{{ selected() | date: 'dd MMM yyyy' }}</h2>
        @for (a of dayList(); track a.id) { <button type="button" class="mb-2 w-full rounded-lg border border-slate-200 p-3 text-left text-sm hover:border-brand-500 dark:border-slate-700" (click)="open(a)"><div class="flex items-center justify-between"><b>{{ a.startTime }}–{{ a.endTime }}</b><span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class]="a.status | appointmentStatus: 'classes'">{{ a.status | appointmentStatus }}</span></div><div class="text-slate-500">{{ a.patientName }} · {{ a.doctorName }}</div></button> }
        @empty { <p class="text-sm text-slate-500">No appointments on this day.</p> }
      </section>
    </div>`,
})
export class AppointmentCalendarComponent {
  protected readonly feed = inject(AppointmentFeedFacade);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly all = this.store.selectSignal(selectAllAppointments);
  protected readonly dow = DOW;
  protected readonly todayIso = toISODate(new Date());
  protected readonly selected = signal(this.todayIso);
  protected readonly month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  private readonly byDate = computed(() => { const m = new Map<string, Appointment[]>(); for (const a of this.all()) m.set(a.date, [...(m.get(a.date) ?? []), a]); return m; });
  protected readonly cells = computed(() => {
    const start = this.month();
    const offset = (start.getDay() + 6) % 7;
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const total = Math.ceil((offset + days) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), i - offset + 1);
      const list = this.byDate().get(toISODate(d)) ?? [];
      return { iso: toISODate(d), day: d.getDate(), inMonth: d.getMonth() === start.getMonth(), active: list.filter((a) => a.status !== 'CANCELLED').length, cancelled: list.filter((a) => a.status === 'CANCELLED').length };
    });
  });
  protected readonly dayList = computed(() => (this.byDate().get(this.selected()) ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime)));
  constructor() { this.feed.load(); }
  protected shift(n: number) { const m = this.month(); this.month.set(new Date(m.getFullYear(), m.getMonth() + n, 1)); }
  protected today() { this.month.set(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); this.selected.set(this.todayIso); }
  protected open(a: Appointment) { void this.router.navigate(['/appointments', a.id]); }
}
