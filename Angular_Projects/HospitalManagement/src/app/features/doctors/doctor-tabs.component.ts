import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, resource, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom, map, switchMap, filter, tap } from 'rxjs';
import { AppointmentApiService } from '../../core/api/appointment-api.service';
import { DoctorApiService } from '../../core/api/doctor-api.service';
import { DAYS_OF_WEEK, type DayOfWeek, type ScheduleDay, type Slot, type Unavailability } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { selectAllDepartments } from '../../state/selectors/hospitals.selectors';
import { DataStateComponent, NoticeComponent, SlotPickerComponent } from '../../shared/components';
import { AppointmentStatusPipe } from '../../shared/pipes/pipes';
import { timeOrder } from '../../shared/validators/validators';
import { emptyToNull, humanize, todayISO } from '../../shared/utilities/helpers';
import { toLoadState } from '../../shared/utilities/load-state';
import { DoctorContext } from './doctor-context';

@Component({
  selector: 'app-doctor-profile',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (ctx.doctor(); as d) { <dl class="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-700 dark:bg-slate-900">
    @for (f of facts(d); track f[0]) { <div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ f[0] }}</dt><dd class="text-sm break-words">{{ f[1] || '—' }}</dd></div> }</dl> }`,
})
export class DoctorProfileComponent {
  protected readonly ctx = inject(DoctorContext);
  private readonly depts = inject(Store).selectSignal(selectAllDepartments);
  protected facts(d: NonNullable<ReturnType<DoctorContext['doctor']>>): [string, string | number | null][] {
    const dept = this.depts().find((x) => x.id === d.departmentId)?.name ?? (d.departmentId ? `#${d.departmentId}` : null);
    return [['Full name', d.fullName], ['Specialization', d.specialization], ['Qualification', d.qualification], ['Experience', d.experienceYears !== null ? `${d.experienceYears} years` : null], ['Consultation fee', `₹${d.consultationFee}`], ['Licence number', d.licenseNumber], ['E-mail', d.email], ['Phone', d.phone], ['Hospital id', d.hospitalId], ['Department', dept], ['Status', d.active ? 'Active' : 'Inactive']];
  }
}

/**
 * Weekly schedule: read-only table for everybody, REACTIVE FORM EDITOR (FormArray of FormGroups – "Doctor Availability Form") for the
 * doctor themself and administrators. Cross-field validator per row (end after start, break inside working hours), dynamic rows (add/remove),
 * `patchValue` to load, `getRawValue` to save, dirty/reset handling.
 */
@Component({
  selector: 'app-doctor-schedule',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, DataStateComponent, NoticeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-data-state [state]="state()" [rows]="2">
      <ng-template #loaded let-days>
        @if (ctx.canManageSchedule()) {
          <form [formGroup]="form" (ngSubmit)="save()" aria-label="Weekly schedule editor" class="space-y-3">
            <div formArrayName="days" class="space-y-3">
              @for (g of rows.controls; track g; let i = $index) {
                <div [formGroupName]="i" class="grid items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1.2fr_1fr_1fr_.8fr_1fr_1fr_auto] dark:border-slate-700 dark:bg-slate-900">
                  <mat-form-field subscriptSizing="dynamic"><mat-label>Day</mat-label><mat-select formControlName="dayOfWeek">@for (d of days_; track d) { <mat-option [value]="d">{{ human(d) }}</mat-option> }</mat-select></mat-form-field>
                  <mat-form-field subscriptSizing="dynamic"><mat-label>Start</mat-label><input matInput type="time" formControlName="startTime" /></mat-form-field>
                  <mat-form-field subscriptSizing="dynamic"><mat-label>End</mat-label><input matInput type="time" formControlName="endTime" /></mat-form-field>
                  <mat-form-field subscriptSizing="dynamic"><mat-label>Slot (min)</mat-label><input matInput type="number" formControlName="slotMinutes" min="5" max="180" /></mat-form-field>
                  <mat-form-field subscriptSizing="dynamic"><mat-label>Break from</mat-label><input matInput type="time" formControlName="breakStart" /></mat-form-field>
                  <mat-form-field subscriptSizing="dynamic"><mat-label>Break to</mat-label><input matInput type="time" formControlName="breakEnd" /></mat-form-field>
                  <button mat-icon-button type="button" (click)="remove(i)" [attr.aria-label]="'Remove row ' + (i + 1)"><mat-icon>delete</mat-icon></button>
                  @if (g.errors?.['timeOrder']) { <p class="col-span-full text-xs text-red-600">{{ g.errors?.['timeOrder'] }}</p> }
                  @if (g.errors?.['breakOutside']) { <p class="col-span-full text-xs text-red-600">The break must fall inside working hours and have both times.</p> }
                </div>
              }
            </div>
            @if (rows.errors?.['duplicateDay']) { <p class="text-xs text-red-600">Each weekday can only appear once.</p> }
            <div class="flex gap-2"><button mat-stroked-button type="button" (click)="add()" [disabled]="nextDay() === null"><mat-icon>add</mat-icon> Add working day</button><span class="flex-1"></span>
              <button mat-button type="button" (click)="discard()" [disabled]="!form.dirty">Discard</button><button mat-flat-button color="primary" type="submit" [disabled]="busy() || form.invalid || !form.dirty">{{ busy() ? 'Saving…' : 'Save schedule' }}</button></div>
          </form>
        } @else {
          <table class="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"><thead><tr class="border-b text-left text-xs uppercase text-slate-500"><th class="p-3">Day</th><th>Hours</th><th>Slot</th><th>Break</th></tr></thead>
            <tbody>@for (d of days; track d.dayOfWeek) { <tr class="border-b last:border-0"><td class="p-3">{{ human(d.dayOfWeek) }}</td><td>{{ d.startTime }}–{{ d.endTime }}</td><td>{{ d.slotMinutes }} min</td><td>{{ d.breakStart ? d.breakStart + '–' + d.breakEnd : '—' }}</td></tr> }</tbody></table>
        }
      </ng-template>
    </app-data-state>
    @if ((state().status === 'loaded' && $any(state()).data.length === 0) && !ctx.canManageSchedule()) { <app-notice class="mt-3 block" heading="No weekly schedule">This doctor has no working hours configured.</app-notice> }`,
})
export class DoctorScheduleComponent {
  protected readonly ctx = inject(DoctorContext);
  private readonly api = inject(DoctorApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notify = inject(NotificationService);
  protected readonly days_ = DAYS_OF_WEEK;
  protected readonly human = humanize;
  protected readonly busy = signal(false);
  private readonly reloadTick = signal(0);

  protected readonly state = toSignal(toObservable(computed(() => [this.ctx.id(), this.reloadTick()] as const)).pipe(
    filter(([id]) => id > 0),
    switchMap(([id]) => toLoadState(this.api.schedule(id)).pipe(tap((s) => { if (s.status === 'loaded') this.patch(s.data); }))),
  ), { initialValue: { status: 'loading' as const } });

  readonly rows = this.fb.array<FormGroup<RowControls>>([], { validators: (c) => { const v = (c as FormArray<FormGroup<RowControls>>).getRawValue().map((r) => r.dayOfWeek); return new Set(v).size !== v.length ? { duplicateDay: true } : null; } });
  protected readonly form = this.fb.group({ days: this.rows });
  protected readonly nextDay = computed(() => { this.reloadTick(); return DAYS_OF_WEEK.find((d) => !this.rows.getRawValue().some((r) => r.dayOfWeek === d)) ?? null; });

  private row(d?: ScheduleDay): FormGroup<RowControls> {
    return this.fb.group({
      dayOfWeek: this.fb.control<DayOfWeek>(d?.dayOfWeek ?? DAYS_OF_WEEK.find((x) => !this.rows.getRawValue().some((r) => r.dayOfWeek === x)) ?? 'MONDAY', Validators.required),
      startTime: [d?.startTime.slice(0, 5) ?? '09:00', Validators.required], endTime: [d?.endTime.slice(0, 5) ?? '13:00', Validators.required],
      slotMinutes: [d?.slotMinutes ?? 30, [Validators.required, Validators.min(5), Validators.max(180)]], breakStart: [d?.breakStart?.slice(0, 5) ?? ''], breakEnd: [d?.breakEnd?.slice(0, 5) ?? ''],
    }, { validators: [timeOrder('startTime', 'endTime'), (g) => { const v = g.getRawValue() as { startTime: string; endTime: string; breakStart: string; breakEnd: string }; if (!v.breakStart && !v.breakEnd) return null; return v.breakStart && v.breakEnd && v.breakStart >= v.startTime && v.breakEnd <= v.endTime && v.breakEnd > v.breakStart ? null : { breakOutside: true }; }] });
  }
  private patch(days: ScheduleDay[]) {
    this.rows.clear();
    days.forEach((d) => this.rows.push(this.row(d)));
    this.form.markAsPristine();
    this.reloadTick.update((n) => n); // nextDay recalculation
  }
  protected add() { this.rows.push(this.row()); this.form.markAsDirty(); this.reloadTick.update((n) => n + 0); }
  protected remove(i: number) { this.rows.removeAt(i); this.form.markAsDirty(); }
  protected discard() { this.reloadTick.update((n) => n + 1); }
  protected save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const days: ScheduleDay[] = this.rows.getRawValue().map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, slotMinutes: Number(r.slotMinutes), breakStart: emptyToNull(r.breakStart), breakEnd: emptyToNull(r.breakEnd) }));
    this.busy.set(true);
    this.api.saveSchedule(this.ctx.id(), days).subscribe({ next: () => { this.busy.set(false); this.notify.success('Weekly schedule saved'); this.form.markAsPristine(); this.reloadTick.update((n) => n + 1); }, error: () => this.busy.set(false) });
  }
}
type RowControls = { dayOfWeek: FormControl<DayOfWeek>; startTime: FormControl<string>; endTime: FormControl<string>; slotMinutes: FormControl<number>; breakStart: FormControl<string>; breakEnd: FormControl<string> };

/**
 * Availability = resource() (Signal-based async loading, Angular 19 experimental API). Two resources react to the `date` signal:
 *  - slotsResource : the doctor's schedule grid for the day (GET /doctors/{id}/slots)
 *  - bookedResource: the appointment service's view (booked slots are `available: false`)
 * `request` is a computed of signals; when `date` or the doctor changes the previous request is aborted (AbortSignal) and reloaded.
 * linkedSignal() keeps the picked slot but resets it whenever the date changes.
 */
@Component({
  selector: 'app-doctor-availability',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, SlotPickerComponent, DataStateComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div class="mb-3 flex flex-wrap items-center gap-3"><label class="text-sm font-medium">Date <input type="date" class="ml-2 h-9 rounded-md border border-slate-300 bg-transparent px-2 dark:border-slate-600" [value]="date()" (change)="date.set($any($event.target).value || today)" /></label>
          <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">{{ free() }} free</span><span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs">{{ busy() }} occupied</span></div>
        @switch (merged.status()) {
          @case ('loading') { <p class="text-sm text-slate-500">Loading slots…</p> }
          @case ('error') { <p class="text-sm text-red-600">Could not load the slots. <button class="underline" (click)="merged.reload()">Retry</button></p> }
          @default { <app-slot-picker [slots]="merged.value() ?? []" [(selected)]="picked" /> }
        }
        @if (picked() && ctx.doctor()?.active) { <a class="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white no-underline" routerLink="/appointments/book" [queryParams]="{ doctorId: ctx.id(), date: date(), time: picked() }">Book {{ picked() }} on {{ date() | date: 'dd MMM' }}</a> }
      </section>
      <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 class="mb-2 font-semibold">Days off</h3>
        <app-data-state [state]="off()" emptyTitle="No days off"><ng-template #loaded let-rows><ul class="divide-y text-sm">@for (o of rows; track o.id) { <li class="flex items-center justify-between py-2"><span>{{ o.date | date: 'dd MMM yyyy' }}<span class="block text-xs text-slate-500">{{ o.reason ?? '' }}</span></span>@if (ctx.canManageSchedule()) { <button mat-icon-button (click)="removeOff(o)" [attr.aria-label]="'Remove ' + o.date"><mat-icon>delete</mat-icon></button> }</li> }</ul></ng-template></app-data-state>
        @if (ctx.canManageSchedule()) { <form [formGroup]="offForm" (ngSubmit)="addOff()" class="mt-3 space-y-2"><mat-form-field class="w-full" subscriptSizing="dynamic"><mat-label>Reason (optional)</mat-label><input matInput formControlName="reason" maxlength="200" /></mat-form-field><button mat-stroked-button type="submit" class="w-full">Mark {{ date() | date: 'dd MMM' }} as day off</button></form> }
      </section>
    </div>`,
})
export class DoctorAvailabilityComponent {
  protected readonly ctx = inject(DoctorContext);
  private readonly doctors = inject(DoctorApiService);
  private readonly appts = inject(AppointmentApiService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly today = todayISO();
  protected readonly date = signal(todayISO());
  private readonly req = computed(() => ({ id: this.ctx.id(), date: this.date() }));
  /** linkedSignal: writable, but automatically reset to null whenever the request (doctor/date) changes. */
  protected readonly picked = linkedSignal<{ id: number; date: string }, string | null>({ source: this.req, computation: () => null });

  protected readonly slotsResource = resource({ request: this.req, loader: ({ request }) => (request.id > 0 ? firstValueFrom(this.doctors.slots(request.id, request.date)) : Promise.resolve([] as Slot[])) });
  protected readonly bookedResource = resource({ request: this.req, loader: ({ request }) => (request.id > 0 ? firstValueFrom(this.appts.availability(request.id, request.date)) : Promise.resolve([] as Slot[])) });
  /** Combination of both resources (computed over resource signals). */
  protected readonly merged = {
    status: computed(() => (this.slotsResource.isLoading() || this.bookedResource.isLoading() ? 'loading' : this.slotsResource.error() ? 'error' : 'loaded')),
    value: computed<Slot[]>(() => { const occupied = new Set((this.bookedResource.value() ?? []).filter((s) => !s.available).map((s) => s.startTime)); return (this.slotsResource.value() ?? []).map((s) => ({ ...s, available: s.available && !occupied.has(s.startTime) })); }),
    reload: () => { this.slotsResource.reload(); this.bookedResource.reload(); },
  };
  protected readonly free = computed(() => this.merged.value().filter((s) => s.available).length);
  protected readonly busy = computed(() => this.merged.value().filter((s) => !s.available).length);

  private readonly offTick = signal(0);
  protected readonly off = toSignal(toObservable(computed(() => [this.ctx.id(), this.offTick()] as const)).pipe(filter(([id]) => id > 0), switchMap(([id]) => toLoadState(this.doctors.unavailability(id)))), { initialValue: { status: 'loading' as const } });
  protected readonly offForm = this.fb.group({ reason: [''] });
  protected addOff() { this.doctors.addUnavailability(this.ctx.id(), { date: this.date(), reason: emptyToNull(this.offForm.getRawValue().reason) }).subscribe(() => { this.notify.success('Day off added – slots closed'); this.offTick.update((n) => n + 1); this.merged.reload(); this.offForm.reset(); }); }
  protected removeOff(o: Unavailability) { this.doctors.removeUnavailability(this.ctx.id(), o.id).subscribe(() => { this.notify.success('Day off removed'); this.offTick.update((n) => n + 1); this.merged.reload(); }); }
  constructor() { effect(() => { this.ctx.id(); untracked(() => this.picked.set(null)); }); }
}

@Component({
  selector: 'app-doctor-appointments',
  standalone: true,
  imports: [DatePipe, RouterLink, DataStateComponent, AppointmentStatusPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="mb-3 flex items-center gap-3 text-sm"><label>Filter by date <input type="date" class="ml-2 h-9 rounded-md border border-slate-300 bg-transparent px-2 dark:border-slate-600" [value]="date()" (change)="date.set($any($event.target).value)" /></label>@if (date()) { <button class="underline" (click)="date.set('')">Show all</button> }</div>
    <app-data-state [state]="state()" emptyTitle="No appointments" emptyDescription="Nothing is booked for this selection.">
      <ng-template #loaded let-rows><table class="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"><thead><tr class="border-b text-left text-xs uppercase text-slate-500"><th class="p-3">Date</th><th>Time</th><th>Patient</th><th>Reason</th><th>Status</th></tr></thead>
        <tbody>@for (a of rows; track a.id) { <tr class="border-b last:border-0"><td class="p-3"><a [routerLink]="['/appointments', a.id]" class="font-semibold text-brand-600">{{ a.date | date: 'dd MMM yyyy' }}</a></td><td>{{ a.startTime }}–{{ a.endTime }}</td><td>{{ a.patientName }}</td><td>{{ a.reason ?? '—' }}</td><td><span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class]="a.status | appointmentStatus: 'classes'">{{ a.status | appointmentStatus }}</span></td></tr> }</tbody></table></ng-template></app-data-state>`,
})
export class DoctorAppointmentsComponent {
  private readonly ctx = inject(DoctorContext);
  private readonly api = inject(AppointmentApiService);
  protected readonly date = signal('');
  protected readonly state = toSignal(toObservable(computed(() => [this.ctx.id(), this.date()] as const)).pipe(filter(([id]) => id > 0), switchMap(([id, d]) => toLoadState(this.api.forDoctor(id, d || undefined).pipe(map((l) => [...l].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))))))), { initialValue: { status: 'loading' as const } });
}
