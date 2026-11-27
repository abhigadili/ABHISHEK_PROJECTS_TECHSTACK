import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Observable, Subject, exhaustMap, filter, finalize, map, of, switchMap, take, tap, catchError } from 'rxjs';
import { DoctorApiService } from '../../core/api/doctor-api.service';
import { PatientApiService } from '../../core/api/patient-api.service';
import { PrescriptionApiService } from '../../core/api/prescription-api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import type { Patient, Prescription } from '../../core/models';
import { ApiError, errorMessage } from '../../core/models/api-error';
import { CurrentIdentityService } from '../../core/services/current-identity.service';
import { NotificationService } from '../../core/services/notification.service';
import { NoticeComponent, PageHeaderComponent, PatientPickerComponent } from '../../shared/components';
import { dosageValidator, existsInCatalogue } from '../../shared/validators/validators';
import { emptyToNull } from '../../shared/utilities/helpers';
import { PrescriptionViewComponent } from './prescription-view.component';
import { PrescriptionService } from './prescription.service';

export const FREQUENCIES = ['OD', 'BD', 'TID', 'QID', 'HS', 'SOS', 'Weekly'] as const;
type ItemGroup = FormGroup<{ medicineName: FormControl<string>; dosage: FormControl<string>; frequency: FormControl<string>; durationDays: FormControl<number>; quantity: FormControl<number>; instructions: FormControl<string> }>;

/** Cross-row validator on the FormArray: the same medicine twice in one prescription is almost always a mistake. */
const noDuplicateMedicines = (c: AbstractControl): ValidationErrors | null => {
  const names = (c as FormArray<ItemGroup>).controls.map((g) => g.controls.medicineName.value.trim().toLowerCase()).filter(Boolean);
  return new Set(names).size !== names.length ? { duplicateMedicine: true } : null;
};

/**
 * Scenario 5 – PRESCRIPTION GENERATION (Angular Material + typed Reactive Forms).
 *  patient search/select → retrieve patient info (allergies shown) → diagnosis + validity → FormArray of medicines (add/remove dynamically)
 *  sync validators: required, dosage pattern (custom), min/max · cross-row validator on the FormArray (duplicates)
 *  ASYNC validator: the medicine must exist in the pharmacy inventory (real GET /pharmacy/medicines, cached by PrescriptionService.medicines$)
 *  submit: Subject → exhaustMap (a second click while saving is ignored) → POST /prescriptions → generated prescription is displayed
 */
@Component({
  selector: 'app-prescription-generate',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatAutocompleteModule, PageHeaderComponent, PatientPickerComponent, NoticeComponent, PrescriptionViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (result(); as r) {
      <div class="mx-auto max-w-3xl space-y-4"><app-page-header title="Prescription generated" subtitle="Saved by the Prescription Service" />
        <app-prescription-view [prescription]="r"><ng-container actions>
          <a mat-flat-button color="primary" [routerLink]="['/prescriptions', r.id]">Open prescription</a><button mat-stroked-button type="button" (click)="svc.print(r)">Print</button><button mat-stroked-button type="button" (click)="svc.download(r)">Download</button><button mat-button type="button" (click)="reset()">Write another</button></ng-container></app-prescription-view>
        <app-notice heading="What happens next">The pharmacy receives this prescription (Kafka) and creates a pharmacy order, the patient's medical record gets a timeline entry and a notification is queued.</app-notice></div>
    } @else {
      <div class="mx-auto max-w-4xl"><app-page-header title="Generate prescription" subtitle="Diagnosis and medicines for a patient" />
        @if (auth.role() === 'DOCTOR' && doctorMissing()) { <app-notice tone="warning" heading="No doctor profile">Your login is not linked to a doctor profile, so prescriptions cannot be issued under your name.</app-notice> }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-4" aria-label="Prescription form">
          @if (error()) { <p role="alert" class="rounded-md bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }
          <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 class="font-semibold">1 · Patient & doctor</h2>
            <app-patient-picker [(patient)]="patient" />
            @if (patientTouched() && !patient()) { <p class="text-xs text-red-600">Select a patient</p> }
            @if (info(); as p) { <div class="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4 dark:bg-slate-800"><div><span class="block text-xs text-slate-500">Date of birth</span>{{ p.dateOfBirth }}</div><div><span class="block text-xs text-slate-500">Blood group</span>{{ p.bloodGroup ?? '—' }}</div><div class="sm:col-span-2"><span class="block text-xs text-slate-500">Known allergies</span><span [class]="p.knownAllergies ? 'font-semibold text-amber-700' : ''">{{ p.knownAllergies ?? 'none recorded' }}</span></div></div> }
            @if (auth.role() === 'DOCTOR') { <p class="text-sm text-slate-500">Prescribing as <b>{{ ownDoctor()?.fullName ?? '…' }}</b></p> } @else {
              <mat-form-field class="w-full"><mat-label>Prescribing doctor</mat-label><mat-select formControlName="doctorId">@for (d of doctors(); track d.id) { <mat-option [value]="d.id">{{ d.fullName }} — {{ d.specialization }}</mat-option> }</mat-select><mat-error>Select a doctor</mat-error></mat-form-field> }</section>
          <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 class="font-semibold">2 · Diagnosis</h2>
            <mat-form-field class="w-full"><mat-label>Diagnosis</mat-label><input matInput formControlName="diagnosis" placeholder="e.g. Acute pharyngitis" /><mat-error>Enter the diagnosis (at least 3 characters)</mat-error></mat-form-field>
            <div class="grid gap-x-4 sm:grid-cols-[1fr_180px]"><mat-form-field><mat-label>Notes (optional)</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field><mat-form-field><mat-label>Valid for (days)</mat-label><input matInput type="number" formControlName="validDays" /><mat-error>1–365 days</mat-error></mat-form-field></div></section>
          <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><div class="flex items-center justify-between"><h2 class="font-semibold">3 · Medicines</h2><span class="text-xs text-slate-500">{{ items.length }} added</span></div>
            <div formArrayName="items" class="space-y-3">
              @for (g of items.controls; track g; let i = $index) {
                <div [formGroupName]="i" class="grid items-start gap-x-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-6 dark:border-slate-700" [attr.data-testid]="'rx-item-' + i">
                  <mat-form-field class="sm:col-span-2" subscriptSizing="dynamic"><mat-label>Medicine</mat-label><input matInput formControlName="medicineName" [matAutocomplete]="auto" /><mat-autocomplete #auto="matAutocomplete">@for (m of suggestions(); track m) { <mat-option [value]="m">{{ m }}</mat-option> }</mat-autocomplete>
                    @if (g.controls.medicineName.pending) { <mat-hint>checking inventory…</mat-hint> }<mat-error>{{ g.controls.medicineName.errors?.['required'] ? 'Required' : g.controls.medicineName.errors?.['notInInventory'] }}</mat-error></mat-form-field>
                  <mat-form-field subscriptSizing="dynamic"><mat-label>Dosage</mat-label><input matInput formControlName="dosage" placeholder="500mg" /><mat-error>{{ g.controls.dosage.errors?.['dosage'] ?? 'Required' }}</mat-error></mat-form-field>
                  <mat-form-field subscriptSizing="dynamic"><mat-label>Frequency</mat-label><mat-select formControlName="frequency">@for (f of frequencies; track f) { <mat-option [value]="f">{{ f }}</mat-option> }</mat-select></mat-form-field>
                  <mat-form-field subscriptSizing="dynamic"><mat-label>Days</mat-label><input matInput type="number" formControlName="durationDays" /><mat-error>1–365</mat-error></mat-form-field>
                  <mat-form-field subscriptSizing="dynamic"><mat-label>Qty</mat-label><input matInput type="number" formControlName="quantity" /><mat-error>1–1000</mat-error></mat-form-field>
                  <mat-form-field class="sm:col-span-5" subscriptSizing="dynamic"><mat-label>Instructions (optional)</mat-label><input matInput formControlName="instructions" placeholder="after food" /></mat-form-field>
                  <div class="flex items-center justify-end"><button mat-icon-button type="button" (click)="remove(i)" [disabled]="items.length === 1" [attr.aria-label]="'Remove medicine ' + (i + 1)"><mat-icon>delete</mat-icon></button></div>
                </div> }
            </div>
            @if (items.errors?.['duplicateMedicine']) { <p role="alert" class="text-xs text-red-600">The same medicine appears more than once.</p> }
            <button mat-stroked-button type="button" (click)="add()"><mat-icon>add</mat-icon> Add another medicine</button></section>
          <div class="flex justify-end gap-2"><a mat-button routerLink="/prescriptions">Cancel</a><button mat-flat-button color="primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Generate prescription' }}</button></div>
        </form></div>
    }`,
})
export class PrescriptionGenerateComponent implements HasUnsavedChanges {
  // query params from the appointment page: ?patientId=&doctorId=&appointmentId=
  readonly patientId0 = input<string | undefined>(undefined, { alias: 'patientId' });
  readonly doctorId0 = input<string | undefined>(undefined, { alias: 'doctorId' });
  readonly appointmentId0 = input<string | undefined>(undefined, { alias: 'appointmentId' });

  protected readonly auth = inject(AuthService);
  protected readonly svc = inject(PrescriptionService);
  private readonly api = inject(PrescriptionApiService);
  private readonly patients = inject(PatientApiService);
  private readonly doctorsApi = inject(DoctorApiService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly frequencies = FREQUENCIES;
  protected readonly ownDoctor = toSignal(inject(CurrentIdentityService).doctor$);
  protected readonly doctorMissing = computed(() => this.ownDoctor() === null);
  protected readonly doctors = toSignal(this.doctorsApi.list({ active: true, size: 100 }).pipe(map((p) => p.content)), { initialValue: [] });
  protected readonly patient = signal<Patient | null>(null);
  protected readonly patientTouched = signal(false);
  /** Retrieved patient information (fresh GET) – allergies are shown while prescribing. */
  protected readonly info = toSignal(toObservable(computed(() => this.patient()?.id ?? 0)).pipe(filter((id) => id > 0), switchMap((id) => this.patients.getById(id)), map((p): Patient | null => p)), { initialValue: null as Patient | null });

  readonly items = this.fb.array<ItemGroup>([], { validators: [noDuplicateMedicines, Validators.minLength(1)] });
  protected readonly form = this.fb.group({
    doctorId: this.fb.control<number | null>(null),
    diagnosis: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]], notes: ['', Validators.maxLength(1000)],
    validDays: [30, [Validators.required, Validators.min(1), Validators.max(365)]], items: this.items,
  });
  /** Autocomplete suggestions: current text → catalogue (cached observable) → filtered names. */
  protected readonly suggestions = toSignal(this.svc.medicines$.pipe(map((m) => [...new Set(m.map((x) => x.name))].sort())), { initialValue: [] as string[] });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<Prescription | null>(null);
  private readonly submit$ = new Subject<void>();
  private done = false;

  constructor() {
    this.add();
    effect(() => { const id = this.patientId0(); if (id && !this.patient()) this.patients.getById(Number(id)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => this.patient.set(p)); });
    effect(() => { const id = this.doctorId0(); if (id && this.auth.role() !== 'DOCTOR') this.form.controls.doctorId.setValue(Number(id)); });
    // exhaustMap: one submission at a time – further submits are ignored until the request completes
    this.submit$.pipe(
      tap(() => { this.saving.set(true); this.error.set(null); }),
      exhaustMap(() => this.create().pipe(finalize(() => this.saving.set(false)), catchError((e: unknown) => { this.error.set(ApiError.from(e).details.length ? errorMessage(e) : ApiError.from(e).message); return of(null); }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((p) => { if (p) { this.done = true; this.result.set(p); this.notify.success('Prescription saved'); } });
  }

  private newItem(): ItemGroup {
    return this.fb.group({
      medicineName: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)], asyncValidators: [existsInCatalogue(() => this.svc.names$)] }),
      dosage: ['', [Validators.required, Validators.maxLength(60), dosageValidator]], frequency: ['OD', Validators.required],
      durationDays: [5, [Validators.required, Validators.min(1), Validators.max(365)]], quantity: [5, [Validators.required, Validators.min(1), Validators.max(1000)]], instructions: ['', Validators.maxLength(255)],
    });
  }
  protected add() { this.items.push(this.newItem()); }
  protected remove(i: number) { if (this.items.length > 1) { this.items.removeAt(i); this.form.markAsDirty(); } }
  protected reset() { this.result.set(null); this.done = false; this.patient.set(null); this.items.clear(); this.add(); this.form.reset({ doctorId: null, diagnosis: '', notes: '', validDays: 30 }); }

  protected submit(): void {
    this.patientTouched.set(true);
    this.form.markAllAsTouched();
    if (!this.patient() || this.form.invalid) return;
    if (this.form.pending) { /* async validators still running: wait for statusChanges */ this.form.statusChanges.pipe(filter((s) => s !== 'PENDING'), take(1), takeUntilDestroyed(this.destroyRef)).subscribe(() => { if (this.form.valid) this.submit$.next(); }); return; }
    this.submit$.next();
  }
  private create(): Observable<Prescription | null> {
    const v = this.form.getRawValue();
    const doctorId = this.auth.role() === 'DOCTOR' ? this.ownDoctor()?.id : v.doctorId;
    if (!doctorId) { this.error.set('Select the prescribing doctor.'); return of(null); }
    return this.api.create({
      patientId: this.patient()!.id, doctorId, appointmentId: Number(this.appointmentId0()) || null, diagnosis: emptyToNull(v.diagnosis), notes: emptyToNull(v.notes), validDays: Number(v.validDays),
      items: v.items.map((i) => ({ medicineName: i.medicineName.trim(), dosage: i.dosage.trim(), frequency: i.frequency, durationDays: Number(i.durationDays), quantity: Number(i.quantity), instructions: emptyToNull(i.instructions) })),
    });
  }
  hasUnsavedChanges(): boolean { return !this.done && (this.form.dirty || !!this.patient()); }
}
