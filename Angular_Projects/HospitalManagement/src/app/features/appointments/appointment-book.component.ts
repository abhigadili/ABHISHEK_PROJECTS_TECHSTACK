import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { combineLatest, debounceTime, distinctUntilChanged, filter, map, of, startWith, switchMap, take } from 'rxjs';
import { AppointmentApiService } from '../../core/api/appointment-api.service';
import { DoctorApiService } from '../../core/api/doctor-api.service';
import { PatientApiService } from '../../core/api/patient-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { Appointment, AvailableDoctor, Patient, Slot } from '../../core/models';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { AppointmentsActions } from '../../state/actions/appointments.actions';
import { selectAppointmentBooking } from '../../state/selectors/appointments.selectors';
import { EmptyStateComponent, ErrorStateComponent, NoticeComponent, PageHeaderComponent, PatientPickerComponent, SlotPickerComponent } from '../../shared/components';
import { AppointmentStatusPipe, PatientNamePipe, SpecializationPipe } from '../../shared/pipes/pipes';
import { avatarUri, todayISO } from '../../shared/utilities/helpers';
import { toLoadState } from '../../shared/utilities/load-state';
import { futureOrTodayValidator } from '../../shared/validators/validators';
import { AppointmentFeedFacade } from './appointment-feed.facade';

/**
 * Scenario 2 – DOCTOR APPOINTMENT BOOKING (Tailwind + typed Reactive Form).
 *   1  doctors working on a date (GET /doctors/available) – combineLatest(date, specialization) → debounceTime → distinctUntilChanged → switchMap
 *      (switchMap CANCELS the previous availability request when the user changes the date/specialization again)
 *   2  select a doctor   3  live slots (GET /appointments/availability): switchMap on (doctor, date)
 *   4  patient (own profile | searchable picker, model())  + patient details retrieval (GET /patients/{id})
 *   5  submit → NgRx `book` action → effect with exhaustMap (no duplicate booking) → success/failure ACTION
 *   6  confirmation, history from API, NgRx feed refreshed
 * linkedSignal: the chosen time slot is writable but automatically resets whenever the doctor or date changes.
 */
@Component({
  selector: 'app-appointment-book',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, PageHeaderComponent, SlotPickerComponent, PatientPickerComponent, EmptyStateComponent, ErrorStateComponent, NoticeComponent, SpecializationPipe, PatientNamePipe, AppointmentStatusPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (booked(); as b) {
      <div class="mx-auto max-w-3xl space-y-4">
        <app-page-header title="Appointment confirmed" subtitle="The booking was accepted by the Appointment Service" />
        <section class="rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Appointment #{{ b.id }}</div>
          <div class="text-lg font-bold">{{ b.date | date: 'EEEE, dd MMM yyyy' }} · {{ b.startTime }}–{{ b.endTime }}</div>
          <div class="mt-1 text-sm">{{ b.patientName }} with {{ b.doctorName }} · fee {{ b.fee | currency: 'INR' }}</div>
          <div class="mt-4 flex flex-wrap gap-2"><a [routerLink]="['/appointments', b.id]" class="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white no-underline">View appointment</a><a routerLink="/appointments" class="rounded-md border border-slate-300 px-4 py-2 text-sm no-underline">Appointment list</a><button type="button" class="px-3 text-sm text-slate-500" (click)="again()">Book another</button></div>
        </section>
        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h3 class="mb-2 font-semibold">Patient appointment history</h3>
          <ul class="divide-y text-sm">@for (a of history(); track a.id) { <li class="flex items-center justify-between py-2" [class.font-semibold]="a.id === b.id"><span>{{ a.date | date: 'dd MMM yyyy' }} {{ a.startTime }} · {{ a.doctorName }} @if (a.id === b.id) { <span class="ml-1 rounded bg-emerald-100 px-1.5 text-xs text-emerald-800">new</span> }</span><span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class]="a.status | appointmentStatus: 'classes'">{{ a.status | appointmentStatus }}</span></li> } @empty { <li class="py-2 text-slate-500">Loading history…</li> }</ul></section>
        <app-notice heading="Asynchronous follow-up">The consultation bill and the confirmation e-mail are created by the Billing and Notification services (Kafka) a few seconds after booking.</app-notice>
      </div>
    } @else {
      <div class="mx-auto max-w-4xl space-y-4">
        <app-page-header title="Book an appointment" subtitle="Find a doctor, choose a free slot and confirm" />
        @if (identityMissing()) { <app-notice tone="warning" heading="Patient profile required">Appointments are booked for a patient profile. <a routerLink="/auth/register" class="font-semibold underline">Complete your profile</a> first.</app-notice> }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate aria-label="Appointment booking form" class="space-y-4">
          <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 class="mb-3 font-semibold">1 · Find a doctor</h2>
            <div class="mb-4 flex flex-wrap items-end gap-3">
              <label class="text-xs font-medium text-slate-500">Date<input type="date" formControlName="date" [min]="today" class="mt-1 block h-9 rounded-md border border-slate-300 bg-transparent px-2 text-sm text-inherit dark:border-slate-600" /></label>
              <label class="text-xs font-medium text-slate-500">Specialization<select formControlName="specialization" class="mt-1 block h-9 min-w-40 rounded-md border border-slate-300 bg-transparent px-2 text-sm text-inherit dark:border-slate-600"><option value="">All specializations</option>@for (s of specializations(); track s) { <option [value]="s">{{ s }}</option> }</select></label>
              <label class="text-xs font-medium text-slate-500">Doctor name<input formControlName="doctorName" placeholder="Search…" class="mt-1 block h-9 rounded-md border border-slate-300 bg-transparent px-2 text-sm text-inherit dark:border-slate-600" /></label>
            </div>
            @if (form.controls.date.errors?.['futureDate']) { <p class="mb-2 text-xs text-red-600">{{ form.controls.date.errors?.['futureDate'] }}</p> }
            @switch (doctorsState().status) {
              @case ('loading') { <p class="text-sm text-slate-500">Searching doctors…</p> }
              @case ('error') { <app-error-state [error]="$any(doctorsState()).error" /> }
              @default {
                <div class="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Available doctors">
                  @for (a of visibleDoctors(); track a.doctor.id) {
                    <button type="button" role="radio" [attr.aria-checked]="a.doctor.id === form.controls.doctorId.value" (click)="selectDoctor(a)" class="flex items-center gap-3 rounded-lg border p-3 text-left hover:border-brand-500" [class]="a.doctor.id === form.controls.doctorId.value ? 'border-brand-600 bg-sky-50 dark:bg-sky-950/30' : 'border-slate-200 dark:border-slate-700'">
                      <img [src]="avatar(a.doctor.fullName)" alt="" width="44" height="44" loading="lazy" class="rounded-full" />
                      <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ a.doctor.fullName }}</span><span class="block text-xs text-slate-500">{{ a.doctor.specialization | specialization }} · {{ a.doctor.experienceYears ?? '—' }} yrs · {{ a.doctor.consultationFee | currency: 'INR' }}</span><span class="block text-xs text-emerald-700">{{ a.slotCount }} slots · {{ a.firstSlot }}–{{ a.lastSlotEnd }}</span></span></button>
                  } @empty { <div class="sm:col-span-2"><app-empty-state title="No doctors available" description="No doctor works on this date for the chosen specialization. Try another date." /></div> }
                </div>
              }
            }
          </section>
          <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" [class.opacity-50]="!doctorId()">
            <h2 class="mb-3 font-semibold">2 · Choose a time {{ selectedDoctor() ? 'with ' + selectedDoctor()!.fullName : '' }}</h2>
            @if (doctorId()) { @switch (slotsState().status) { @case ('loading') { <p class="text-sm text-slate-500">Loading live slots…</p> } @case ('error') { <app-error-state [error]="$any(slotsState()).error" /> } @default { <app-slot-picker [slots]="slots()" [(selected)]="time" /> } } }
          </section>
          <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" [class.opacity-50]="!time()">
            <h2 class="mb-3 font-semibold">3 · Patient</h2>
            @if (auth.role() === 'PATIENT') { <p class="text-sm">Booking for yourself: <b>{{ ownPatient() | patientName }}</b> (patient #{{ ownPatient()?.id }})</p> } @else { <app-patient-picker [(patient)]="picked" /> }
            @if (patientDetail(); as p) { <dl class="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3 dark:bg-slate-800"><div><dt class="text-xs text-slate-500">Date of birth</dt><dd>{{ p.dateOfBirth }}</dd></div><div><dt class="text-xs text-slate-500">Phone</dt><dd>{{ p.phone }}</dd></div><div><dt class="text-xs text-slate-500">Allergies</dt><dd>{{ p.knownAllergies ?? 'none recorded' }}</dd></div></dl> }
          </section>
          <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" [class.opacity-50]="!patient()">
            <h2 class="mb-3 font-semibold">4 · Reason & confirm</h2>
            <label class="block text-sm font-medium">Reason for visit (optional)<textarea formControlName="reason" rows="3" maxlength="255" placeholder="e.g. Chest pain follow-up" class="mt-1 w-full rounded-md border border-slate-300 bg-transparent p-2 text-sm dark:border-slate-600"></textarea></label>
            @if (error()) { <p role="alert" class="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }
            <div class="mt-4 flex justify-end"><button type="submit" class="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" [disabled]="!canSubmit() || booking()">{{ booking() ? 'Booking…' : 'Confirm booking' }}</button></div>
          </section>
        </form>
      </div>
    }`,
})
export class AppointmentBookComponent {
  // route/query inputs (withComponentInputBinding): /appointments/book?doctorId=3&date=2026-11-16&time=09:30
  readonly doctorId0 = input<string | undefined>(undefined, { alias: 'doctorId' });
  readonly date0 = input<string | undefined>(undefined, { alias: 'date' });
  readonly time0 = input<string | undefined>(undefined, { alias: 'time' });

  protected readonly auth = inject(AuthService);
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly doctors = inject(DoctorApiService);
  private readonly appts = inject(AppointmentApiService);
  private readonly patients = inject(PatientApiService);
  private readonly identity = inject(CurrentIdentityService);
  private readonly feed = inject(AppointmentFeedFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly today = todayISO();

  protected readonly form = this.fb.group({
    date: [todayISO(), [Validators.required, futureOrTodayValidator]], specialization: [''], doctorName: [''],
    doctorId: this.fb.control<number | null>(null, Validators.required), reason: ['', Validators.maxLength(255)],
  });
  private readonly date = toSignal(this.form.controls.date.valueChanges.pipe(startWith(this.form.controls.date.value)), { initialValue: todayISO() });
  protected readonly doctorId = toSignal(this.form.controls.doctorId.valueChanges.pipe(startWith(this.form.controls.doctorId.value)), { initialValue: null as number | null });
  private readonly spec = toSignal(this.form.controls.specialization.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly nameQuery = toSignal(this.form.controls.doctorName.valueChanges.pipe(startWith(''), debounceTime(200)), { initialValue: '' });

  protected readonly specializations = toSignal(this.doctors.specializations(), { initialValue: [] as string[] });
  /** combineLatest + switchMap: new date/specialization → previous doctor search is cancelled. */
  protected readonly doctorsState = toSignal(
    combineLatest([toObservable(this.date), toObservable(this.spec)]).pipe(
      debounceTime(150), distinctUntilChanged((a, b) => a[0] === b[0] && a[1] === b[1]),
      switchMap(([d, s]) => (d && !this.form.controls.date.invalid ? toLoadState(this.doctors.available(d, s || undefined)) : of({ status: 'loaded', data: [] as AvailableDoctor[] } as const))),
    ),
    { initialValue: { status: 'loading' as const } },
  );
  protected readonly visibleDoctors = computed(() => {
    const s = this.doctorsState();
    if (s.status !== 'loaded') return [] as AvailableDoctor[];
    const q = this.nameQuery().trim().toLowerCase();
    return s.data.filter((a) => !q || a.doctor.fullName.toLowerCase().includes(q) || a.doctor.specialization.toLowerCase().includes(q));
  });
  protected readonly selectedDoctor = computed(() => { const s = this.doctorsState(); return s.status === 'loaded' ? (s.data.find((a) => a.doctor.id === this.doctorId())?.doctor ?? null) : null; });

  protected readonly slotsState = toSignal(
    combineLatest([toObservable(this.doctorId), toObservable(this.date)]).pipe(switchMap(([id, d]) => (id && d ? toLoadState(this.appts.availability(id, d)) : of({ status: 'loaded', data: [] as Slot[] } as const)))),
    { initialValue: { status: 'loaded' as const, data: [] as Slot[] } },
  );
  protected readonly slots = computed(() => { const s = this.slotsState(); return s.status === 'loaded' ? s.data : []; });
  /** LINKED SIGNAL: writable selected time, reset to null (or to the ?time= hint once) whenever doctor/date change. */
  private hintUsed = false;
  protected readonly time = linkedSignal<{ id: number | null; date: string }, string | null>({
    source: () => ({ id: this.doctorId(), date: this.date() }),
    computation: () => { if (!this.hintUsed && this.time0()) { this.hintUsed = true; return this.time0() ?? null; } return null; },
  });

  protected readonly ownPatient = toSignal(this.identity.patient$); // undefined = still resolving, null = no profile
  protected readonly identityMissing = computed(() => this.auth.role() === 'PATIENT' && this.ownPatient() === null);
  protected readonly picked = signal<Patient | null>(null);
  protected readonly patient = computed(() => (this.auth.role() === 'PATIENT' ? (this.ownPatient() ?? null) : this.picked()));
  /** Scenario step 6: "Retrieve patient details" – fresh GET /patients/{id}. */
  protected readonly patientDetail = toSignal(toObservable(computed(() => this.patient()?.id ?? 0)).pipe(filter((id) => id > 0), switchMap((id) => this.patients.getById(id)), map((p): Patient | null => p)), { initialValue: null as Patient | null });
  protected readonly canSubmit = computed(() => !!this.patient() && !!this.doctorId() && !!this.time() && this.form.controls.date.valid && this.patientDetail()?.status !== 'INACTIVE');

  protected readonly booking = this.store.selectSignal(selectAppointmentBooking);
  protected readonly error = signal<string | null>(null);
  protected readonly booked = signal<Appointment | null>(null);
  protected readonly history = toSignal(toObservable(this.booked).pipe(filter((b): b is Appointment => !!b), switchMap((b) => this.appts.forPatient(b.patientId).pipe(map((l) => [...l].sort((x, y) => (y.date + y.startTime).localeCompare(x.date + x.startTime)).slice(0, 6))))), { initialValue: [] as Appointment[] });

  constructor() {
    // first values from the URL (?date=&doctorId=)
    effect(() => {
      const d = this.date0(), id = this.doctorId0();
      if (d && d >= todayISO()) this.form.controls.date.setValue(d, { emitEvent: true });
      if (id) this.form.controls.doctorId.setValue(Number(id));
    }, { allowSignalWrites: true });
    // a new date or specialization invalidates the chosen doctor if that doctor no longer appears in the list
    toObservable(this.visibleDoctors).pipe(takeUntilDestroyed()).subscribe((list) => {
      const id = this.form.controls.doctorId.value;
      if (id && this.doctorsState().status === 'loaded' && !list.some((a) => a.doctor.id === id) && !this.nameQuery()) this.form.controls.doctorId.setValue(null);
    });
  }
  protected avatar(n: string) { return avatarUri(n, 88); }
  protected selectDoctor(a: AvailableDoctor) { this.form.controls.doctorId.setValue(a.doctor.id); }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.error.set(null);
    this.actions$.pipe(ofType(AppointmentsActions.bookSuccess, AppointmentsActions.bookFailure), take(1), takeUntilDestroyed(this.destroyRef)).subscribe((a) => {
      if (a.type === AppointmentsActions.bookSuccess.type) { this.booked.set((a as ReturnType<typeof AppointmentsActions.bookSuccess>).appointment); this.feed.load(); }
      else { const f = a as ReturnType<typeof AppointmentsActions.bookFailure>; this.error.set(f.error); if (f.status === 409 || f.status === 400) this.time.set(null); }
    });
    this.store.dispatch(AppointmentsActions.book({ request: { patientId: this.patient()!.id, doctorId: this.doctorId()!, date: this.date(), startTime: this.time()!, reason: this.form.controls.reason.value.trim() || null } }));
  }
  protected again() { this.booked.set(null); this.time.set(null); this.picked.set(null); this.form.controls.reason.reset(); }
}
