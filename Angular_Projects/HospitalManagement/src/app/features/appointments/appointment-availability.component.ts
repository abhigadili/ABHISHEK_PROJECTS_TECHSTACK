import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { combineLatest, filter, map, of, startWith, switchMap, forkJoin, catchError } from 'rxjs';
import { AppointmentApiService } from '../../core/api/appointment-api.service';
import { DoctorApiService } from '../../core/api/doctor-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { NotificationService } from '../../core/services/notification.service';
import { DAYS_OF_WEEK } from '../../core/models';
import { DataStateComponent, PageHeaderComponent, SlotPickerComponent } from '../../shared/components';
import { AppointmentStatusPipe } from '../../shared/pipes/pipes';
import { humanize, todayISO } from '../../shared/utilities/helpers';
import { toLoadState } from '../../shared/utilities/load-state';

/**
 * Scenario 3 – APPOINTMENT AVAILABILITY MANAGEMENT. Weekly schedule + live slot grid + bookings of the day for one doctor;
 * doctors (own) and administrators can mark the day off. combineLatest(doctor, date, refresh) → switchMap cancels stale requests;
 * forkJoin loads the three views in parallel; slots occupied by bookings come from the appointment service (`available: false`).
 */
@Component({
  selector: 'app-appointment-availability',
  standalone: true,
  imports: [DatePipe, RouterLink, PageHeaderComponent, SlotPickerComponent, DataStateComponent, AppointmentStatusPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Doctor availability" subtitle="Weekly schedule, free and occupied slots" />
    <div class="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <label class="text-xs font-medium text-slate-500">Doctor<select class="mt-1 block h-9 min-w-56 rounded-md border border-slate-300 bg-transparent px-2 text-sm text-inherit dark:border-slate-600" [value]="doctorId()" (change)="doctorId.set(+$any($event.target).value)">@for (d of doctorList(); track d.id) { <option [value]="d.id">{{ d.fullName }} — {{ d.specialization }}</option> }</select></label>
      <label class="text-xs font-medium text-slate-500">Date<input type="date" class="mt-1 block h-9 rounded-md border border-slate-300 bg-transparent px-2 text-sm text-inherit dark:border-slate-600" [value]="date()" (change)="date.set($any($event.target).value || today)" /></label>
      @if (doctorId()) { <a [routerLink]="['/doctors', doctorId(), 'schedule']" class="text-sm font-medium text-brand-600">{{ canManage() ? 'Edit weekly schedule' : 'Full schedule' }} →</a> }
    </div>
    <app-data-state [state]="view()" [rows]="3">
      <ng-template #loaded let-v>
        <div class="grid gap-4 lg:grid-cols-[1fr_340px]">
          <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 class="font-semibold">{{ date() | date: 'EEEE, dd MMM yyyy' }}</h2><div class="flex gap-2 text-xs"><span class="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">{{ free(v.slots) }} free</span><span class="rounded-full bg-slate-200 px-2 py-0.5">{{ v.slots.length - free(v.slots) }} occupied</span></div></div>
            @if (v.off) { <p class="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Day off: {{ v.off.reason ?? 'the doctor is on leave' }}</p> }
            <app-slot-picker [slots]="v.slots" [readOnly]="true" />
            @if (canManage()) {
              <div class="mt-4 border-t pt-4">@if (v.off) { <button class="rounded-md border px-3 py-2 text-sm" (click)="removeOff(v.off.id)">Remove day off</button> } @else { <button class="rounded-md border px-3 py-2 text-sm" (click)="markOff()">Mark {{ date() | date: 'dd MMM' }} as day off</button> }
                <p class="mt-2 text-xs text-slate-500">Duplicate bookings are prevented by the backend (unique slot key + overlap check); concurrent attempts receive HTTP 409.</p></div>
            }
          </section>
          <div class="space-y-4">
            <section class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h3 class="mb-2 text-sm font-semibold">Weekly schedule</h3>
              @for (d of v.schedule; track d.dayOfWeek) { <div class="flex justify-between text-sm"><span>{{ human(d.dayOfWeek) }}</span><span class="text-slate-500">{{ d.startTime }}–{{ d.endTime }} · {{ d.slotMinutes }}m</span></div> } @empty { <p class="text-sm text-slate-500">No weekly schedule configured.</p> }</section>
            @if (auth.hasRole('ADMIN', 'DOCTOR')) { <section class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><h3 class="mb-2 text-sm font-semibold">Bookings on this day</h3>
              @for (a of v.bookings; track a.id) { <a [routerLink]="['/appointments', a.id]" class="flex items-center justify-between py-1.5 text-sm no-underline"><span>{{ a.startTime }} · {{ a.patientName }}</span><span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class]="a.status | appointmentStatus: 'classes'">{{ a.status | appointmentStatus }}</span></a> } @empty { <p class="text-sm text-slate-500">No bookings.</p> }</section> }
          </div>
        </div>
      </ng-template>
    </app-data-state>`,
})
export class AppointmentAvailabilityComponent {
  protected readonly auth = inject(AuthService);
  private readonly doctors = inject(DoctorApiService);
  private readonly appts = inject(AppointmentApiService);
  private readonly notify = inject(NotificationService);
  private readonly identity = inject(CurrentIdentityService);
  protected readonly today = todayISO();
  protected readonly human = humanize;
  protected readonly date = signal(todayISO());
  protected readonly doctorId = signal(0);
  private readonly refresh = signal(0);
  protected readonly doctorList = toSignal(this.doctors.list({ active: true, size: 100 }).pipe(map((p) => p.content)), { initialValue: [] });
  private readonly own = toSignal(this.identity.doctor$);
  protected readonly canManage = computed(() => this.auth.role() === 'ADMIN' || (this.auth.role() === 'DOCTOR' && this.own()?.id === this.doctorId()));

  constructor() {
    // default selection: the signed-in doctor, otherwise the first active doctor
    toObservable(computed(() => [this.doctorList(), this.own()] as const)).pipe(filter(([l]) => l.length > 0 && this.doctorId() === 0)).subscribe(([l, own]) => this.doctorId.set(own?.id ?? l[0]!.id));
  }

  protected readonly view = toSignal(combineLatest([toObservable(this.doctorId), toObservable(this.date), toObservable(this.refresh)]).pipe(
    filter(([id]) => id > 0),
    switchMap(([id, date]) => toLoadState(forkJoin({
      slots: this.appts.availability(id, date),
      schedule: this.doctors.schedule(id),
      off: this.doctors.unavailability(id).pipe(map((l) => l.find((o) => o.date === date) ?? null)),
      bookings: this.auth.hasRole('ADMIN', 'DOCTOR') ? this.appts.forDoctor(id, date).pipe(catchError(() => of([]))) : of([]),
    }).pipe(map((v) => ({ ...v, schedule: [...v.schedule].sort((a, b) => DAYS_OF_WEEK.indexOf(a.dayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek)) }))))),
    startWith({ status: 'loading' as const }),
  ), { initialValue: { status: 'loading' as const } });
  protected free(slots: readonly { available: boolean }[]) { return slots.filter((s) => s.available).length; }
  protected markOff() { this.doctors.addUnavailability(this.doctorId(), { date: this.date(), reason: 'Unavailable' }).subscribe(() => { this.notify.success('Day marked as off – slots closed'); this.refresh.update((n) => n + 1); }); }
  protected removeOff(id: number) { this.doctors.removeUnavailability(this.doctorId(), id).subscribe(() => { this.notify.success('Day off removed'); this.refresh.update((n) => n + 1); }); }
}
