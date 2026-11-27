import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { Store } from '@ngrx/store';
import { EMPTY, Subject, catchError, exhaustMap, filter, finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { APP_CONFIG } from '../../core/config/tokens';
import type { BookingPayload, Gender, SavedPassenger, SeatMap, Station } from '../../core/models/models';
import { BookingService, PassengerService } from '../../core/services/account.services';
import { SeatService, StationService } from '../../core/services/catalog.services';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { SeatMapComponent } from '../../shared/components/seat-map.component';
import { ErrorStateComponent, FieldErrorComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { DigitsOnlyDirective } from '../../shared/directives/directives';
import { applyServerErrors, ageRange, indianMobile } from '../../shared/validators/validators';
import { BookingFlowActions, PassengerDraft, selectPassengers } from '../../store/booking-flow/booking-flow.store';
import { fromIsoDate } from '../../shared/utils';
import type { HasUnsavedChanges } from '../../core/guards/guards';

type PassengerGroup = FormGroup<{ passengerId: FormControl<number | null>; name: FormControl<string>; age: FormControl<number | null>; gender: FormControl<Gender | ''>; mobile: FormControl<string> }>;

/** Booking workflow: 1) segment-aware seat map (optional) 2) passengers (FormArray) 3) review -> POST /bookings -> payment. */
@Component({
  selector: 'app-booking-wizard',
  imports: [ReactiveFormsModule, DatePipe, CurrencyPipe, MatStepperModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, SeatMapComponent, FieldErrorComponent, PageHeaderComponent, ErrorStateComponent, DigitsOnlyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Book tickets" [subtitle]="subtitle()" />
    @if (seatMap(); as sm) {
      <div class="summary card">
        <div><strong>{{ fromSt()?.name }} → {{ toSt()?.name }}</strong><br /><span class="muted">Boarding {{ boarding() | date: 'EEE, dd MMM yyyy' }} · {{ sm.coachType.name }}</span></div>
        <div class="fare"><b>{{ sm.fare | currency: 'INR' : 'symbol' : '1.2-2' }}</b><small class="muted"> per passenger (incl. reservation fee)</small></div>
      </div>
      <mat-stepper linear #stepper [orientation]="'horizontal'" class="stp">
        <mat-step label="Seats" [completed]="true">
          <p class="muted">Seat availability is calculated by the server for <strong>this exact journey segment</strong>: a seat already booked for an earlier or later leg can still be free here. Choose seats or skip to let the system allocate them automatically.</p>
          <mat-checkbox [checked]="auto()" (change)="setAuto($event.checked)">Allocate seats automatically</mat-checkbox>
          @if (!auto()) { <app-seat-map [map]="sm" [(selected)]="selectedSeats" [max]="maxPax" /> <p role="status" aria-live="polite">{{ selectedSeats().length }} seat(s) selected</p> }
          <div class="actions"><button mat-flat-button matStepperNext type="button" (click)="onSeatsDone()">Continue</button></div>
        </mat-step>
        <mat-step [stepControl]="form" label="Passengers">
          <form [formGroup]="form" novalidate>
            <div formArrayName="passengers">
              @for (g of passengers.controls; track g; let i = $index) {
                <fieldset class="pax card" [formGroupName]="i">
                  <legend>Passenger {{ i + 1 }}@if (selectedSeats()[i]; as sid) { · seat {{ seatLabel(sid) }} }</legend>
                  @if (saved().length) {
                    <mat-form-field class="full"><mat-label>Fill from a saved passenger</mat-label>
                      <mat-select (selectionChange)="fillFrom(i, $event.value)"><mat-option [value]="null">— none —</mat-option>@for (s of saved(); track s.id) { <mat-option [value]="s">{{ s.name }}, {{ s.age }}</mat-option> }</mat-select></mat-form-field>
                  }
                  <div class="grid cols-4">
                    <mat-form-field><mat-label>Full name</mat-label><input matInput formControlName="name" autocomplete="off" /><mat-error><app-field-error [control]="g.controls.name" label="Name" /></mat-error></mat-form-field>
                    <mat-form-field><mat-label>Age</mat-label><input matInput type="number" min="1" max="120" formControlName="age" /><mat-error><app-field-error [control]="g.controls.age" label="Age" /></mat-error></mat-form-field>
                    <mat-form-field><mat-label>Gender</mat-label><mat-select formControlName="gender"><mat-option value="MALE">Male</mat-option><mat-option value="FEMALE">Female</mat-option><mat-option value="OTHER">Other</mat-option></mat-select><mat-error><app-field-error [control]="g.controls.gender" label="Gender" /></mat-error></mat-form-field>
                    <mat-form-field><mat-label>Mobile (optional)</mat-label><input matInput formControlName="mobile" maxlength="10" inputmode="numeric" appDigitsOnly /><mat-error><app-field-error [control]="g.controls.mobile" label="Mobile" /></mat-error></mat-form-field>
                  </div>
                  @if (passengers.length > 1) { <button mat-button type="button" color="warn" (click)="removePassenger(i)"><mat-icon>delete</mat-icon>Remove passenger</button> }
                </fieldset>
              }
            </div>
            @if (form.hasError('seatCount')) { <p class="err" role="alert">You selected {{ selectedSeats().length }} seat(s): add exactly that many passengers, or choose automatic allocation.</p> }
            @if (serverError()) { <p class="err" role="alert">{{ serverError() }}</p> }
            <div class="actions">
              <button mat-stroked-button matStepperPrevious type="button">Back</button>
              <button mat-stroked-button type="button" (click)="addPassenger()" [disabled]="passengers.length >= maxPax"><mat-icon>person_add</mat-icon>Add passenger</button>
              <button mat-flat-button matStepperNext type="button" (click)="form.markAllAsTouched()" [disabled]="form.invalid">Review</button>
            </div>
          </form>
        </mat-step>
        <mat-step label="Review & confirm">
          <div class="card">
            <h2>Passengers</h2>
            @for (p of passengerValues(); track $index) { <p>{{ $index + 1 }}. {{ p.name }} · {{ p.age }} · {{ p.gender }} @if (selectedSeats()[$index]; as sid) { <span class="muted">· seat {{ seatLabel(sid) }}</span> } @else { <span class="muted">· auto seat</span> }</p> }
            <hr />
            <p class="row spread"><span>{{ passengers.length }} × {{ sm.fare | currency: 'INR' }}</span><strong>Total {{ sm.fare * passengers.length | currency: 'INR' }}</strong></p>
            <p class="muted">Seats are held for {{ holdMinutes }} minutes after booking while you pay. The final fare is confirmed by the server.</p>
            @if (serverError()) { <p class="err" role="alert">{{ serverError() }}</p> }
          </div>
          <div class="actions">
            <button mat-stroked-button matStepperPrevious type="button">Back</button>
            <button mat-flat-button type="button" (click)="confirm$.next()" [disabled]="submitting()">{{ submitting() ? 'Booking…' : 'Confirm & proceed to payment' }}</button>
          </div>
        </mat-step>
      </mat-stepper>
    } @else if (loadError()) { <app-error-state [message]="loadError()!" (retry)="reload()" /> }
    @else { <div class="card muted" role="status">Loading seat availability…</div> }`,
  styles: [`.summary{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;margin-bottom:16px}.fare b{font-size:1.4rem}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.pax{margin:12px 0;border:1px solid var(--c-border)}legend{font-weight:700;padding:0 6px}.stp{background:transparent}`],
})
export class BookingWizardComponent implements HasUnsavedChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly seats = inject(SeatService);
  private readonly stations = inject(StationService);
  private readonly bookings = inject(BookingService);
  private readonly passengersApi = inject(PassengerService);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly toast = inject(ToastService);
  private readonly cfg = inject(APP_CONFIG);
  private readonly destroyRef = inject(DestroyRef);
  readonly maxPax = this.cfg.maxPassengers; readonly holdMinutes = 10;

  // query params -> signal inputs
  readonly trainId = input<string>(); readonly date = input<string>(); readonly from = input<string>(undefined, { alias: 'from' }); readonly to = input<string>(undefined, { alias: 'to' });
  readonly cls = input<string>(); readonly pax = input<string>();

  readonly seatMap = signal<SeatMap | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly selectedSeats = signal<number[]>([]);
  readonly auto = signal(true);
  readonly saved = signal<SavedPassenger[]>([]);
  readonly submitting = signal(false);
  readonly serverError = signal('');
  readonly fromSt = signal<Station | null>(null); readonly toSt = signal<Station | null>(null);
  readonly boarding = computed(() => (this.date() ? fromIsoDate(this.date()!) : null));
  readonly subtitle = computed(() => `${this.fromSt()?.code ?? ''} → ${this.toSt()?.code ?? ''}`);
  readonly reloadTick = signal(0);
  reload() { this.reloadTick.update((n) => n + 1); }
  readonly confirm$ = new Subject<void>();
  private done = false;
  private seatIndex = new Map<number, string>();

  readonly form = this.fb.group({ passengers: this.fb.array<PassengerGroup>([], { validators: [] }) }, { validators: [(c): ValidationErrors | null => {
    const n = (c.get('passengers') as FormArray).length; const seats = this.selectedSeats().length;
    return seats > 0 && seats !== n ? { seatCount: true } : null;
  }] });
  get passengers() { return this.form.controls.passengers; }
  readonly passengerValues = signal<{ name: string; age: number | null; gender: string }[]>([]);

  constructor() {
    // (re)load the seat map + stations whenever the query params change or the user retries (switchMap cancels the stale request)
    const params$ = toObservable(computed(() => ({ t: this.trainId(), d: this.date(), f: this.from(), to: this.to(), c: this.cls(), p: this.pax(), tick: this.reloadTick() })));
    params$.pipe(
      filter((p) => !!p.t && !!p.d && !!p.f && !!p.to && !!p.c),
      tap(() => this.loadError.set(null)),
      switchMap((p) => forkJoin({ map: this.seats.seatMap({ trainId: +p.t!, date: p.d!, from: +p.f!, to: +p.to!, coachTypeId: +p.c! }), f: this.stations.get(+p.f!), t: this.stations.get(+p.to!), saved: this.passengersApi.list({ size: 50 }).pipe(map((r) => r.items), catchError(() => of([] as SavedPassenger[]))) }).pipe(
        catchError((e) => { this.loadError.set(toApiError(e).message); return EMPTY; }),
      )),
      takeUntilDestroyed(),
    ).subscribe((r) => {
      this.loadError.set(null); this.seatMap.set(r.map); this.fromSt.set(r.f); this.toSt.set(r.t); this.saved.set(r.saved);
      this.seatIndex = new Map(r.map.coaches.flatMap((c) => c.seats.map((s) => [s.id, `${c.number}/${s.number}`] as const)));
      // drop selections that have become unavailable since the last load
      const free = new Set(r.map.coaches.flatMap((c) => c.seats.filter((s) => s.status === 'AVAILABLE').map((s) => s.id)));
      this.selectedSeats.update((cur) => cur.filter((id) => free.has(id)));
      if (!this.passengers.length) this.initPassengers();
    });
    // keep the NgRx booking-flow slice in step with the form (survives navigating away and back)
    effect(() => this.store.dispatch(BookingFlowActions.setSeats({ seatIds: this.selectedSeats() })));
    effect(() => { this.selectedSeats(); this.form.updateValueAndValidity(); });
    this.passengers.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => {
      this.passengerValues.set(v.map((x) => ({ name: x.name ?? '', age: x.age ?? null, gender: x.gender ?? '' })));
      this.store.dispatch(BookingFlowActions.setPassengers({ passengers: v.map((x) => ({ passengerId: x.passengerId ?? undefined, name: x.name ?? '', age: x.age ?? null, gender: (x.gender ?? '') as Gender | '', mobile: x.mobile })) as PassengerDraft[] }));
    });

    // submit: exhaustMap = ignore double clicks while the request is in flight (no duplicate bookings)
    this.confirm$.pipe(exhaustMap(() => this.submit()), takeUntilDestroyed()).subscribe();
  }

  private initPassengers() {
    const draft = this.store.selectSignal(selectPassengers)();
    const n = Math.min(this.maxPax, Math.max(1, Number(this.pax()) || 1));
    for (let i = 0; i < Math.max(n, draft.length && draft.length <= this.maxPax ? draft.length : 0); i++) this.passengers.push(this.newPassenger(draft[i]));
  }
  newPassenger(d?: PassengerDraft): PassengerGroup {
    return this.fb.group({
      passengerId: new FormControl<number | null>(d?.passengerId ?? null),
      name: this.fb.control(d?.name ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]),
      age: new FormControl<number | null>(d?.age ?? null, [Validators.required, ageRange]),
      gender: new FormControl<Gender | ''>(d?.gender ?? '', { nonNullable: true, validators: [Validators.required] }),
      mobile: this.fb.control(d?.mobile ?? '', [indianMobile]),
    });
  }
  addPassenger() { if (this.passengers.length < this.maxPax) this.passengers.push(this.newPassenger()); }
  removePassenger(i: number) { this.passengers.removeAt(i); this.selectedSeats.update((s) => s.slice(0, this.passengers.length)); }
  fillFrom(i: number, s: SavedPassenger | null) { if (s) this.passengers.at(i).patchValue({ passengerId: s.id, name: s.name, age: s.age, gender: s.gender, mobile: s.mobile ?? '' }); else this.passengers.at(i).patchValue({ passengerId: null }); }
  setAuto(v: boolean) { this.auto.set(v); if (v) this.selectedSeats.set([]); }
  seatLabel(id: number) { return this.seatIndex.get(id) ?? '#' + id; }
  onSeatsDone() { while (this.passengers.length < this.selectedSeats().length && this.passengers.length < this.maxPax) this.addPassenger(); this.form.updateValueAndValidity(); }
  hasUnsavedChanges() { return !this.done && this.form.dirty; }

  /** Re-verify availability right before booking (the server is the authority and re-checks inside its transaction). */
  private submit() {
    this.form.markAllAsTouched(); if (this.form.invalid) return EMPTY;
    this.submitting.set(true); this.serverError.set('');
    const chosen = this.selectedSeats();
    const recheck$ = this.seats.seatMap({ trainId: +this.trainId()!, date: this.date()!, from: +this.from()!, to: +this.to()!, coachTypeId: +this.cls()! });
    return recheck$.pipe(
      switchMap((fresh) => {
        const free = new Set(fresh.coaches.flatMap((c) => c.seats.filter((s) => s.status === 'AVAILABLE').map((s) => s.id)));
        const gone = chosen.filter((id) => !free.has(id));
        if (gone.length) { this.seatMap.set(fresh); this.selectedSeats.set(chosen.filter((id) => free.has(id))); throw new Error('Some selected seats were just taken. Please choose seats again.'); }
        const body: BookingPayload = {
          trainId: +this.trainId()!, date: this.date()!, fromStationId: +this.from()!, toStationId: +this.to()!, coachTypeId: +this.cls()!,
          passengers: this.passengers.getRawValue().map((p, i) => ({ ...(p.passengerId ? { passengerId: p.passengerId } : {}), name: p.name.trim(), age: Number(p.age), gender: p.gender as Gender, ...(p.mobile ? { mobile: p.mobile } : {}), ...(chosen.length ? { seatId: chosen[i] } : {}) })),
        };
        return this.bookings.create(body);
      }),
      tap((b) => { this.done = true; this.store.dispatch(BookingFlowActions.reset()); this.toast.info('Seats held. Complete the payment to confirm your ticket.'); void this.router.navigate(['/app/bookings', b.id, 'payment']); }),
      catchError((e) => { const err = toApiError(e); this.serverError.set(err.message); applyServerErrors(this.form, err.fields); return EMPTY; }),
      finalize(() => this.submitting.set(false)),
    );
  }
}
