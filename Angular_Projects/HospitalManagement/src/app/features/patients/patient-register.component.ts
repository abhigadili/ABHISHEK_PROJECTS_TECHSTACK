import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject, catchError, concatMap, exhaustMap, finalize, of, tap, throwError } from 'rxjs';
import { PatientApiService } from '../../core/api/patient-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError, errorMessage } from '../../core/models/api-error';
import type { Patient, PatientInput } from '../../core/models';
import { EventBusService } from '../../core/services/event-bus.service';
import { PatientsActions } from '../../state/actions/patients.actions';
import { matchFields, strongPassword } from '../../shared/validators/validators';
import { PatientNamePipe } from '../../shared/pipes/pipes';
import { PatientFormComponent } from './patient-form.component';

/**
 * Scenario 1 – PATIENT REGISTRATION (Angular Material + Reactive Forms).
 *  anonymous visitor : account FormGroup (username/e-mail/password, cross-field match) + patient FormGroup (nested groups)
 *                      submit = register → login → create patient   (SEQUENTIAL calls with concatMap, protected by exhaustMap)
 *  signed-in PATIENT without profile / ADMIN : patient form only → POST /patients
 * Validation errors from the backend (400 details / 409 duplicates) are pushed back into the form controls (`serverErrors`).
 */
@Component({
  selector: 'app-patient-register',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatCardModule, RouterLink, PatientFormComponent, PatientNamePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (registered(); as p) {
      <mat-card appearance="outlined"><mat-card-content class="space-y-3 !p-6">
        <h1 class="text-xl font-bold">Registration complete</h1>
        <p class="text-sm text-slate-500">{{ p | patientName }} is registered as patient #{{ p.id }}.</p>
        <dl class="grid gap-3 sm:grid-cols-2 text-sm">
          <div><dt class="text-xs uppercase text-slate-500">Date of birth</dt><dd>{{ p.dateOfBirth }}</dd></div><div><dt class="text-xs uppercase text-slate-500">E-mail</dt><dd>{{ p.email }}</dd></div>
          <div><dt class="text-xs uppercase text-slate-500">Phone</dt><dd>{{ p.phone }}</dd></div><div><dt class="text-xs uppercase text-slate-500">Known allergies</dt><dd>{{ p.knownAllergies ?? '—' }}</dd></div>
        </dl>
        <button mat-flat-button color="primary" (click)="openProfile(p)">Open patient profile</button>
      </mat-card-content></mat-card>
    } @else {
      <h1 class="mb-1 text-2xl font-bold">{{ anonymous() ? 'Create your patient account' : 'Register patient' }}</h1>
      <p class="mb-4 text-sm text-slate-500">{{ anonymous() ? 'Create a login and your patient profile in one go.' : 'Enter the patient details.' }}</p>
      @if (error()) { <p role="alert" class="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }
      @if (anonymous()) {
        <form [formGroup]="account" class="mb-2 grid gap-x-4 sm:grid-cols-2" aria-label="Account">
          <mat-form-field><mat-label>Username</mat-label><input matInput formControlName="username" autocomplete="username" required /><mat-error>4-60 letters, digits, . _ -</mat-error></mat-form-field>
          <mat-form-field><mat-label>Account e-mail</mat-label><input matInput type="email" formControlName="email" required /><mat-error>Enter a valid e-mail</mat-error></mat-form-field>
          <mat-form-field><mat-label>Password</mat-label><input matInput type="password" formControlName="password" autocomplete="new-password" required /><mat-error>{{ account.controls.password.errors?.['strongPassword'] ?? 'Required' }}</mat-error></mat-form-field>
          <mat-form-field><mat-label>Confirm password</mat-label><input matInput type="password" formControlName="confirm" autocomplete="new-password" required />@if (account.hasError('mismatch')) { <mat-error>Passwords do not match</mat-error> }</mat-form-field>
        </form>
      }
      <app-patient-form [serverErrors]="serverErrors()" [busy]="busy()" submitLabel="Register" (save)="onPatientSave($event)" />
      @if (anonymous()) { <p class="mt-4 text-sm">Already registered? <a routerLink="/auth/login" class="font-semibold text-brand-600">Sign in</a></p> }
    }`,
})
export class PatientRegisterComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly patients = inject(PatientApiService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly bus = inject(EventBusService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly anonymous = signal(!inject(AuthService).isAuthenticated());
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly registered = signal<Patient | null>(null);
  protected readonly serverErrors = signal<Readonly<Record<string, string>> | null>(null);

  protected readonly account = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(60), Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, strongPassword]],
    confirm: ['', Validators.required],
  }, { validators: matchFields('password', 'confirm') }); // cross-field validation

  /** Every "Register" click is pushed into this Subject; exhaustMap ignores clicks while a registration is already running. */
  private readonly submit$ = new Subject<PatientInput>();

  constructor() {
    this.submit$.pipe(
      tap(() => { this.busy.set(true); this.error.set(null); this.serverErrors.set(null); }),
      exhaustMap((input) => this.register$(input).pipe(
        catchError((e: unknown) => { this.handleError(e); return of(null); }),
        finalize(() => this.busy.set(false)),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((p) => {
      if (!p) return;
      this.store.dispatch(PatientsActions.createSuccess({ patient: p })); // keep the NgRx entity collection in sync
      this.bus.emit({ type: 'patient-registered', patientId: p.id });
      this.registered.set(p);
    });
  }

  protected onPatientSave(input: PatientInput): void {
    if (this.anonymous()) {
      this.account.markAllAsTouched();
      if (this.account.invalid) return;
    }
    this.submit$.next(input);
  }

  /** register → login → create profile: each step needs the previous one (concatMap = sequential, in order). */
  private register$(input: PatientInput) {
    if (!this.anonymous()) return this.patients.create(input);
    const a = this.account.getRawValue();
    return this.auth.register({ username: a.username.trim(), email: a.email.trim(), password: a.password }).pipe(
      concatMap(() => this.auth.login({ username: a.username.trim(), password: a.password })),
      concatMap(() => this.patients.create(input).pipe(
        catchError((e) => throwError(() => Object.assign(ApiError.from(e), { partial: true }))), // the account exists now – tell the user
      )),
    );
  }

  private handleError(e: unknown): void {
    const err = ApiError.from(e);
    const fe: Record<string, string> = { ...err.fieldErrors };
    if (err.isConflict) fe[/phone/i.test(err.message) ? 'phone' : /username/i.test(err.message) ? 'username' : 'email'] = err.message;
    const { username, ...patientErrors } = fe;
    if (username) this.account.controls.username.setErrors({ server: username });
    this.serverErrors.set(patientErrors);
    this.error.set((e as { partial?: boolean }).partial ? `Your account was created and you are signed in, but the patient profile could not be saved: ${errorMessage(e)} Fix the details and submit again.` : errorMessage(e));
  }

  protected openProfile(p: Patient): void {
    void this.router.navigate(this.auth.role() === 'PATIENT' ? ['/profile'] : ['/patients', p.id]);
  }
}
