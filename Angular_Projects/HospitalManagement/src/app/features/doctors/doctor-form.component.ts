import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { startWith, take, of, map, filter } from 'rxjs';
import { UserApiService } from '../../core/api/auth-api.service';
import type { Doctor } from '../../core/models';
import { ApiError, errorMessage } from '../../core/models/api-error';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import * as A from '../../state/actions/doctors.actions';
import { HospitalsActions } from '../../state/actions/hospitals.actions';
import { selectAllDepartments, selectAllHospitals } from '../../state/selectors/hospitals.selectors';
import { PageHeaderComponent } from '../../shared/components';
import { emptyToNull } from '../../shared/utilities/helpers';
import { phoneValidator, requiredIf, strongPassword } from '../../shared/validators/validators';

/**
 * Doctor registration / edit (Material, typed Reactive Form). Dynamic validation: the login fields are required only while
 * "create login" is ticked (conditional validation via valueChanges + setValidators + updateValueAndValidity) and the department list
 * depends on the chosen hospital (Disabled/enabled control, dependent options from the NgRx hospitals slice).
 * Create/update go through NgRx (effects use exhaustMap/concatMap); creating a login first is a SEQUENTIAL call (users → doctor).
 */
@Component({
  selector: 'app-doctor-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatButtonModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl"><app-page-header [title]="doctor ? 'Edit ' + doctor.fullName : 'Register doctor'" subtitle="Doctor Service" />
      @if (error()) { <p role="alert" class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="grid gap-x-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900" aria-label="Doctor form">
        <mat-form-field><mat-label>First name</mat-label><input matInput formControlName="firstName" required /><mat-error>Required</mat-error></mat-form-field>
        <mat-form-field><mat-label>Last name</mat-label><input matInput formControlName="lastName" required /><mat-error>Required</mat-error></mat-form-field>
        <mat-form-field><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" required /><mat-error>Enter a valid e-mail</mat-error></mat-form-field>
        <mat-form-field><mat-label>Phone</mat-label><input matInput formControlName="phone" /><mat-error>{{ form.controls.phone.errors?.['phone'] }}</mat-error></mat-form-field>
        <mat-form-field><mat-label>Licence number</mat-label><input matInput formControlName="licenseNumber" required /><mat-error>Required</mat-error></mat-form-field>
        <mat-form-field><mat-label>Specialization</mat-label><input matInput formControlName="specialization" required /><mat-error>Required</mat-error></mat-form-field>
        <mat-form-field><mat-label>Qualification</mat-label><input matInput formControlName="qualification" /></mat-form-field>
        <div class="grid grid-cols-2 gap-x-4"><mat-form-field><mat-label>Experience (years)</mat-label><input matInput type="number" formControlName="experienceYears" /></mat-form-field><mat-form-field><mat-label>Fee (INR)</mat-label><input matInput type="number" formControlName="consultationFee" required /></mat-form-field></div>
        <mat-form-field><mat-label>Hospital</mat-label><mat-select formControlName="hospitalId" required>@for (h of hospitals(); track h.id) { <mat-option [value]="h.id">{{ h.name }}</mat-option> }</mat-select><mat-error>Select a hospital</mat-error></mat-form-field>
        <mat-form-field><mat-label>Department</mat-label><mat-select formControlName="departmentId"><mat-option [value]="null">None</mat-option>@for (d of departments(); track d.id) { <mat-option [value]="d.id">{{ d.name }}</mat-option> }</mat-select></mat-form-field>
        @if (!doctor) {
          <div class="sm:col-span-2 border-t pt-3"><mat-checkbox formControlName="createLogin">Also create a login for this doctor (role DOCTOR)</mat-checkbox></div>
          @if (form.controls.createLogin.value) {
            <mat-form-field><mat-label>Username</mat-label><input matInput formControlName="username" /><mat-error>4+ letters, digits, . _ -</mat-error></mat-form-field>
            <mat-form-field><mat-label>Initial password</mat-label><input matInput type="password" formControlName="password" /><mat-error>{{ form.controls.password.errors?.['strongPassword'] ?? 'Required' }}</mat-error></mat-form-field>
            <p class="sm:col-span-2 text-xs text-slate-500">Sequential calls: POST /users creates the account, then POST /doctors links it with its user id.</p>
          }
        }
        <div class="flex justify-end gap-2 sm:col-span-2"><button mat-button type="button" (click)="cancel()">Cancel</button><button mat-flat-button color="primary" type="submit" [disabled]="busy()">{{ busy() ? 'Saving…' : doctor ? 'Save changes' : 'Register doctor' }}</button></div>
      </form></div>`,
})
export class DoctorFormComponent implements OnInit, HasUnsavedChanges {
  @Input() doctor: Doctor | null = null;
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly users = inject(UserApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hospitals = this.store.selectSignal(selectAllHospitals);
  private readonly allDepartments = this.store.selectSignal(selectAllDepartments);
  private done = false;

  private readonly createLoginCtrl = this.fb.control(false);
  protected readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(60)]], lastName: ['', [Validators.required, Validators.maxLength(60)]], email: ['', [Validators.required, Validators.email]],
    phone: ['', phoneValidator], licenseNumber: ['', [Validators.required, Validators.maxLength(40)]], specialization: ['', [Validators.required, Validators.maxLength(80)]], qualification: [''],
    experienceYears: new FormControl<number | null>(null, [Validators.min(0), Validators.max(70)]), consultationFee: [500, [Validators.required, Validators.min(0)]],
    hospitalId: new FormControl<number | null>(null, Validators.required), departmentId: new FormControl<number | null>({ value: null, disabled: true }),
    createLogin: this.createLoginCtrl, username: ['', [requiredIf(() => this.createLoginCtrl.value), Validators.pattern(/^([A-Za-z0-9._-]{4,60})?$/)]], password: ['', [requiredIf(() => this.createLoginCtrl.value), strongPassword]],
  });
  private readonly hospitalId = toSignal(this.form.controls.hospitalId.valueChanges.pipe(startWith(this.form.controls.hospitalId.value)));
  protected readonly departments = () => this.allDepartments().filter((d) => d.hospitalId === this.hospitalId());

  constructor() {
    this.store.dispatch(HospitalsActions.load({}));
    // dependent select: choosing a hospital loads its departments and ENABLES the department control
    this.form.controls.hospitalId.valueChanges.pipe(filter((id): id is number => id !== null), takeUntilDestroyed()).subscribe((id) => {
      this.store.dispatch(HospitalsActions.loadDepartments({ hospitalId: id }));
      this.form.controls.departmentId.enable({ emitEvent: false });
      this.form.controls.departmentId.setValue(null);
    });
    // dynamic validation: revalidate login fields when the checkbox flips
    this.form.controls.createLogin.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => { this.form.controls.username.updateValueAndValidity(); this.form.controls.password.updateValueAndValidity(); });
  }

  /** Called by the router with the resolved doctor (component input binding) – patches the form. */
  ngOnInit(): void {
    const d = this.doctor;
    if (!d) return;
    this.form.patchValue({ firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone ?? '', licenseNumber: d.licenseNumber, specialization: d.specialization, qualification: d.qualification ?? '', experienceYears: d.experienceYears, consultationFee: d.consultationFee, hospitalId: d.hospitalId });
    this.store.dispatch(HospitalsActions.loadDepartments({ hospitalId: d.hospitalId }));
    this.form.controls.departmentId.enable({ emitEvent: false });
    this.form.controls.departmentId.setValue(d.departmentId);
    this.form.markAsPristine();
  }

  protected submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body = { firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email.trim(), phone: emptyToNull(v.phone), licenseNumber: v.licenseNumber.trim(), specialization: v.specialization.trim(), qualification: emptyToNull(v.qualification), experienceYears: v.experienceYears, consultationFee: Number(v.consultationFee), hospitalId: Number(v.hospitalId), departmentId: v.departmentId ? Number(v.departmentId) : null, userId: this.doctor?.userId ?? null };
    this.busy.set(true); this.error.set(null);
    const withUser$ = !this.doctor && v.createLogin ? this.users.create({ username: v.username.trim(), email: body.email, password: v.password, role: 'DOCTOR' }).pipe(map((u) => ({ ...body, userId: u.id }))) : of(body);
    this.actions$.pipe(ofType(A.createDoctorSuccess, A.updateDoctorSuccess, A.doctorsFailure), take(1), takeUntilDestroyed(this.destroyRef)).subscribe((a) => {
      this.busy.set(false);
      if (a.type === A.doctorsFailure.type) { this.error.set((a as ReturnType<typeof A.doctorsFailure>).error); return; }
      this.done = true;
      void this.router.navigate(['/doctors', (a as ReturnType<typeof A.createDoctorSuccess>).doctor.id]);
    });
    withUser$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (payload) => this.store.dispatch(this.doctor ? A.updateDoctor({ id: this.doctor.id, doctor: payload }) : A.createDoctor({ doctor: payload })),
      error: (e: unknown) => { this.busy.set(false); this.error.set(ApiError.from(e).details.length ? errorMessage(e) : ApiError.from(e).message); },
    });
  }
  protected cancel() { void this.router.navigate(this.doctor ? ['/doctors', this.doctor.id] : ['/doctors']); }
  hasUnsavedChanges(): boolean { return !this.done && this.form.dirty; }
}
