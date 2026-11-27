import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, effect, input, model, viewChild, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { inject, DestroyRef } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { startWith } from 'rxjs';
import type { BloodGroup, Gender, Patient, PatientInput } from '../../core/models';
import { emptyToNull, toISODate } from '../../shared/utilities/helpers';
import { pastDateValidator, phoneValidator } from '../../shared/validators/validators';

/** Strongly typed form model (Typed Reactive Forms). Nested FormGroups: personal, contact, address, emergency. */
export interface PatientFormModel {
  personal: FormGroup<{ firstName: FormControl<string>; lastName: FormControl<string>; dateOfBirth: FormControl<Date | null>; gender: FormControl<Gender>; bloodGroup: FormControl<BloodGroup | ''>; identityNumber: FormControl<string> }>;
  contact: FormGroup<{ email: FormControl<string>; phone: FormControl<string> }>;
  address: FormGroup<{ street: FormControl<string>; city: FormControl<string>; postalCode: FormControl<string> }>;
  emergency: FormGroup<{ name: FormControl<string>; phone: FormControl<string> }>;
  knownAllergies: FormControl<string>;
}

/**
 * Reusable patient form (Angular Material) used by registration AND edit.
 * Communication API deliberately mixes both generations:
 *   traditional  : @Input() patient (+ ngOnChanges), @Output() save = EventEmitter, @Output() dirtyChange
 *   signal based : input() submitLabel, input() busy, model() `compact` (two-way), viewChild(), viewChildren()
 */
@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate aria-label="Patient form" class="space-y-2">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Personal details</h3>
      <div formGroupName="personal" class="grid gap-x-4 sm:grid-cols-2">
        <mat-form-field><mat-label>First name</mat-label><input #firstName matInput formControlName="firstName" required /><mat-error>{{ err('personal.firstName') }}</mat-error></mat-form-field>
        <mat-form-field><mat-label>Last name</mat-label><input matInput formControlName="lastName" required /><mat-error>{{ err('personal.lastName') }}</mat-error></mat-form-field>
        <mat-form-field><mat-label>Date of birth</mat-label><input matInput [matDatepicker]="dob" formControlName="dateOfBirth" required [max]="today" /><mat-datepicker-toggle matIconSuffix [for]="dob" /><mat-datepicker #dob /><mat-error>{{ err('personal.dateOfBirth') }}</mat-error></mat-form-field>
        <mat-form-field><mat-label>Gender</mat-label><mat-select formControlName="gender" required><mat-option value="FEMALE">Female</mat-option><mat-option value="MALE">Male</mat-option><mat-option value="OTHER">Other</mat-option></mat-select></mat-form-field>
        <mat-form-field><mat-label>Blood group</mat-label><mat-select formControlName="bloodGroup"><mat-option value="">Unknown</mat-option>@for (b of bloodGroups; track b) { <mat-option [value]="b">{{ b }}</mat-option> }</mat-select></mat-form-field>
        <mat-form-field><mat-label>Identity number (optional)</mat-label><input matInput formControlName="identityNumber" /></mat-form-field>
      </div>
      <h3 class="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
      <div formGroupName="contact" class="grid gap-x-4 sm:grid-cols-2">
        <mat-form-field><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" required /><mat-error>{{ err('contact.email') }}</mat-error></mat-form-field>
        <mat-form-field><mat-label>Mobile phone</mat-label><input matInput formControlName="phone" placeholder="+919876543210" required /><mat-error>{{ err('contact.phone') }}</mat-error></mat-form-field>
      </div>
      @if (!compact()) {
        <h3 class="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Address</h3>
        <div formGroupName="address" class="grid gap-x-4 sm:grid-cols-3">
          <mat-form-field class="sm:col-span-3"><mat-label>Street</mat-label><input matInput formControlName="street" /></mat-form-field>
          <mat-form-field><mat-label>City</mat-label><input matInput formControlName="city" /></mat-form-field>
          <mat-form-field><mat-label>Postal code</mat-label><input matInput formControlName="postalCode" /></mat-form-field>
        </div>
        <h3 class="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Emergency contact & medical</h3>
        <div formGroupName="emergency" class="grid gap-x-4 sm:grid-cols-2">
          <mat-form-field><mat-label>Contact name</mat-label><input matInput formControlName="name" /></mat-form-field>
          <mat-form-field><mat-label>Contact phone</mat-label><input matInput formControlName="phone" /><mat-error>{{ err('emergency.phone') }}</mat-error></mat-form-field>
        </div>
        <mat-form-field class="w-full"><mat-label>Known allergies</mat-label><textarea matInput rows="2" formControlName="knownAllergies"></textarea></mat-form-field>
      }
      <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
        <button type="button" mat-button (click)="compact.set(!compact())">{{ compact() ? 'Show all fields' : 'Show fewer fields' }}</button>
        <div class="flex gap-2">
          <button type="button" mat-button (click)="reset()" [disabled]="!form.dirty">Reset</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="busy()">{{ busy() ? 'Saving…' : submitLabel() }}</button>
        </div>
      </div>
    </form>`,
})
export class PatientFormComponent implements OnChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // ---- traditional Input/Output + EventEmitter
  @Input() patient: Patient | null = null;
  @Output() readonly save = new EventEmitter<PatientInput>();
  @Output() readonly dirtyChange = new EventEmitter<boolean>();
  /** Server-side validation errors (field → message) pushed by the parent. */
  @Input() set serverErrors(v: Readonly<Record<string, string>> | null) { this.applyServerErrors(v); }

  // ---- signal inputs / model
  readonly submitLabel = input('Save');
  readonly busy = input(false);
  readonly compact = model(false);

  // ---- signal-based view queries
  private readonly firstNameInput = viewChild<ElementRef<HTMLInputElement>>('firstName');

  protected readonly today = new Date();
  protected readonly bloodGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  readonly form: FormGroup<PatientFormModel> = this.fb.group({
    personal: this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(60)]], lastName: ['', [Validators.required, Validators.maxLength(60)]],
      dateOfBirth: new FormControl<Date | null>(null, { validators: [Validators.required, pastDateValidator] }),
      gender: this.fb.control<Gender>('FEMALE', Validators.required), bloodGroup: this.fb.control<BloodGroup | ''>(''), identityNumber: ['', Validators.maxLength(40)],
    }),
    contact: this.fb.group({ email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]], phone: ['', [Validators.required, phoneValidator]] }),
    address: this.fb.group({ street: ['', Validators.maxLength(160)], city: ['', Validators.maxLength(60)], postalCode: ['', Validators.maxLength(20)] }),
    emergency: this.fb.group({ name: ['', Validators.maxLength(100)], phone: ['', phoneValidator] }),
    knownAllergies: ['', Validators.maxLength(500)],
  });
  private readonly dirty = signal(false);
  readonly isDirty = computed(() => this.dirty());

  constructor() {
    // CONDITIONAL validation: emergency phone becomes required once an emergency contact name is typed (valueChanges + updateValueAndValidity)
    const emergency = this.form.controls.emergency;
    emergency.controls.name.valueChanges.pipe(startWith(emergency.controls.name.value), takeUntilDestroyed(this.destroyRef)).subscribe((name) => {
      const phone = emergency.controls.phone;
      phone.setValidators(name.trim() ? [Validators.required, phoneValidator] : [phoneValidator]);
      phone.updateValueAndValidity({ emitEvent: false });
    });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.dirty.set(this.form.dirty); this.dirtyChange.emit(this.form.dirty); });
    // effect: focus the first field once the view query resolved (viewChild signal)
    effect(() => this.firstNameInput()?.nativeElement.focus({ preventScroll: true }));
  }

  /** ngOnChanges: classic reaction to @Input changes – patches the form when the edited patient changes (patchValue). */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['patient'] && this.patient) this.patch(this.patient);
  }

  private patch(p: Patient): void {
    this.form.reset({
      personal: { firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth + 'T00:00:00') : null, gender: p.gender, bloodGroup: p.bloodGroup ?? '', identityNumber: p.identityNumber ?? '' },
      contact: { email: p.email, phone: p.phone },
      address: { street: p.address ?? '', city: '', postalCode: '' },
      emergency: { name: p.emergencyContactName ?? '', phone: p.emergencyContactPhone ?? '' },
      knownAllergies: p.knownAllergies ?? '',
    });
  }
  reset(): void { if (this.patient) this.patch(this.patient); else this.form.reset(); }

  protected submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue(); // getRawValue includes disabled controls
    const a = v.address;
    this.save.emit({
      firstName: v.personal.firstName.trim(), lastName: v.personal.lastName.trim(), dateOfBirth: toISODate(v.personal.dateOfBirth as Date), gender: v.personal.gender,
      email: v.contact.email.trim(), phone: v.contact.phone.trim(), identityNumber: emptyToNull(v.personal.identityNumber), bloodGroup: v.personal.bloodGroup === '' ? null : v.personal.bloodGroup,
      address: emptyToNull([a.street, a.city, a.postalCode].filter((x) => x.trim()).join(', ')), emergencyContactName: emptyToNull(v.emergency.name), emergencyContactPhone: emptyToNull(v.emergency.phone), knownAllergies: emptyToNull(v.knownAllergies),
    });
  }

  protected err(path: string): string {
    const c = this.form.get(path);
    if (!c?.errors) return '';
    const e = c.errors;
    return e['required'] ? 'Required' : e['email'] ? 'Enter a valid e-mail address' : (e['phone'] as string) ?? (e['pastDate'] as string) ?? (e['server'] as string) ?? (e['maxlength'] ? 'Too long' : 'Invalid');
  }
  private applyServerErrors(v: Readonly<Record<string, string>> | null): void {
    if (!v) return;
    const map: Record<string, string> = { firstName: 'personal.firstName', lastName: 'personal.lastName', dateOfBirth: 'personal.dateOfBirth', email: 'contact.email', phone: 'contact.phone', emergencyContactPhone: 'emergency.phone', identityNumber: 'personal.identityNumber' };
    for (const [field, msg] of Object.entries(v)) {
      const c = this.form.get(map[field] ?? field);
      if (c) { c.setErrors({ server: msg }); c.markAsTouched(); }
    }
  }
  hasUnsavedChanges(): boolean { return this.form.dirty; }
}
