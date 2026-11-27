import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, viewChildren } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, AsyncValidatorFn, FormArray, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInput, MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, concatMap, filter, finalize, from, map, of, startWith, take, tap, toArray } from 'rxjs';
import { AppError, ValidationDetail } from '../../core/models/api.models';
import { ALL_ROLES, Role } from '../../core/models/auth.models';
import { EMPLOYMENT_TYPES, Employee, EmployeeExtras, EmployeeWriteRequest } from '../../core/models/employee.models';
import { HasUnsavedChanges } from '../../core/guards/guards';
import { EmployeeExtrasService, LOCAL_ONLY_NOTICE } from '../../core/services/employee-extras.service';
import { EmployeeService } from '../../core/services/employee.service';
import { PermissionService } from '../../core/services/permission.service';
import { ReferenceDataService } from '../../core/services/reference-data.service';
import { ToastService } from '../../core/services/toast.service';
import { EmployeeSelectComponent } from '../../shared/components/employee-select.component';
import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { PasswordStrengthComponent } from '../../shared/components/password-strength.component';
import { NoticeBannerComponent, PageHeaderComponent } from '../../shared/components/ui-basics';
import { AutofocusDirective } from '../../shared/directives/directives';
import { EmploymentTypePipe } from '../../shared/pipes/pipes';
import { errorMessage, matchFields, passwordComplexity, pastDate, phoneNumber, uniqueValue, validateIf } from '../../shared/validators/validators';
import { EmployeeDetailsState } from './employee-details.state';
import { EducationGroup, ExperienceGroup, SkillControl, addressGroup, educationGroup, emergencyGroup, experienceGroup, skillControl } from './employee-form.factory';

/** Backend field name → form control path, so server-side validation errors land on the right input. */
const SERVER_FIELD_MAP: Record<string, string> = {
  addressLine: 'address.line', city: 'address.city', state: 'address.state', country: 'address.country', postalCode: 'address.postalCode',
  emergencyContactName: 'emergency.name', emergencyContactPhone: 'emergency.phone', emergencyContactRelation: 'emergency.relation',
  'account.password': 'account.password', 'account.role': 'account.role',
};

const nz = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null);

/**
 * Create / edit employee. Highlights:
 *  - NonNullableFormBuilder → fully typed form; nested groups (address, emergency, account)
 *  - FormArray × 3 (education, experience, skills) with per-row validation and independent error display
 *  - sync validators (phone, past date), async validator (work e-mail uniqueness via the backend), cross-field and conditional validators
 *  - valueChanges/statusChanges, enable/disable, patchValue, reset, getRawValue
 *  - CanDeactivate protection (implements HasUnsavedChanges), backend field errors mapped back onto controls
 */
@Component({
  selector: 'app-employee-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.scss',
  imports: [
    ReactiveFormsModule, RouterLink, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule,
    MatProgressSpinnerModule, PageHeaderComponent, NoticeBannerComponent, EmployeeSelectComponent, FileUploadComponent,
    AutofocusDirective, EmploymentTypePipe, PasswordStrengthComponent,
  ],
})
export class EmployeeFormComponent implements HasUnsavedChanges {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly employees = inject(EmployeeService);
  private readonly extrasStore = inject(EmployeeExtrasService);
  private readonly reference = inject(ReferenceDataService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  /** Only present under the ':id' route; lets an edit publish the fresh entity to the details tabs (route resolvers don't re-run). */
  private readonly detailsState = inject(EmployeeDetailsState, { optional: true });
  protected readonly permissions = inject(PermissionService);

  /** Present when editing (from the route resolver); undefined when creating. */
  protected readonly employee: Employee | undefined = this.route.snapshot.data['employee'];
  protected readonly isEdit = !!this.employee;
  protected readonly localNotice = LOCAL_ONLY_NOTICE;
  protected readonly types = EMPLOYMENT_TYPES;
  protected readonly roles: readonly Role[] = ALL_ROLES;
  protected readonly departments = toSignal(this.reference.departments(), { initialValue: [] });
  protected readonly designations = toSignal(this.reference.designations(), { initialValue: [] });

  private readonly inputs = viewChildren(MatInput);
  protected readonly saving = signal(false);
  /** True from the moment the e-mail uniqueness check starts until it settles (signal-driven: no reliance on statusChanges timing). */
  protected readonly checkingEmail = signal(false);
  private readonly checkingEmail$ = toObservable(this.checkingEmail);
  protected readonly serverError = signal<AppError | null>(null);
  protected readonly pictureFile = signal<File | null>(null);
  private submitted = false;

  protected readonly form = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(60)]],
      middleName: ['', [Validators.maxLength(60)]],
      lastName: ['', [Validators.required, Validators.maxLength(60)]],
      dateOfBirth: ['', [pastDate()]],
      workEmail: ['', { validators: [Validators.required, Validators.email, Validators.maxLength(190)], asyncValidators: [this.trackChecking(uniqueValue((v) => this.employees.emailExists(v, this.employee?.id)))] }],
      personalEmail: ['', [Validators.email]],
      phone: ['', [phoneNumber()]],
      employeeCode: ['', [Validators.pattern(/^[A-Z0-9-]{3,20}$/)]],
      joiningDate: ['', [Validators.required]],
      probationEndDate: [''],
      employmentType: this.fb.control<(typeof EMPLOYMENT_TYPES)[number]>('FULL_TIME', Validators.required),
      departmentId: this.fb.control<number | null>(null),
      designationId: this.fb.control<number | null>(null),
      managerId: this.fb.control<number | null>(null),
      jobTitle: ['', [Validators.maxLength(120)]],
      workLocation: ['', [Validators.maxLength(100)]],
      salary: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(99999999)]),
      salaryCurrency: ['USD', [Validators.pattern(/^[A-Za-z]{3}$/)]],
      address: addressGroup(this.fb),
      emergency: emergencyGroup(this.fb),
      account: this.fb.group(
        {
          create: [false],
          role: this.fb.control<Role>('EMPLOYEE'),
          password: ['', []],
          confirm: ['', []],
        },
        { validators: matchFields('password', 'confirm') },
      ),
      education: this.fb.array<EducationGroup>([]),
      experience: this.fb.array<ExperienceGroup>([]),
      skills: this.fb.array<SkillControl>([]),
    },
    { validators: [(g) => this.probationAfterJoining(g)] },
  );

  protected readonly education = this.form.controls.education;
  protected readonly experience = this.form.controls.experience;
  protected readonly skills = this.form.controls.skills;
  protected readonly accountOn = toSignal(this.form.controls.account.controls.create.valueChanges.pipe(startWith(false)), { initialValue: false });


  protected readonly err = (path: string, label: string): string => errorMessage(this.form.get(path), label);
  protected readonly errOf = (c: AbstractControl, label: string): string => errorMessage(c, label);

  constructor() {
    // Password rules apply only when "create login account" is ticked (conditional validators + enable/disable).
    const acc = this.form.controls.account.controls;
    acc.password.addValidators(validateIf((p) => !!p.get('create')?.value, Validators.required));
    acc.password.addValidators(validateIf((p) => !!p.get('create')?.value, passwordComplexity()));
    acc.confirm.addValidators(validateIf((p) => !!p.get('create')?.value, Validators.required));
    acc.create.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((on) => {
      for (const c of [acc.role, acc.password, acc.confirm]) {
        if (on) c.enable({ emitEvent: false });
        else c.disable({ emitEvent: false });
      }
      acc.password.updateValueAndValidity();
    });
    for (const c of [acc.role, acc.password, acc.confirm]) c.disable({ emitEvent: false });

    // Salary is admin-only data; non-admins never see or send it.
    if (!this.permissions.has('employee.salary.view')) {
      this.form.controls.salary.disable({ emitEvent: false });
      this.form.controls.salaryCurrency.disable({ emitEvent: false });
    }

    if (this.employee) this.patchFrom(this.employee);
    // Editing: the e-mail uniqueness check ignores the employee's own address (handled in emailExists) and the account section is hidden.
  }

  /** Wraps an async validator so `checkingEmail` is true while it is queued/running (cancellation by a newer run resets it first). */
  private trackChecking(validator: AsyncValidatorFn): AsyncValidatorFn {
    return (c) => {
      this.checkingEmail.set(true);
      return (validator(c) as Observable<ValidationErrors | null>).pipe(finalize(() => this.checkingEmail.set(false)));
    };
  }

  private probationAfterJoining(g: AbstractControl) {
    const j = g.get('joiningDate')?.value as string;
    const p = g.get('probationEndDate')?.value as string;
    return j && p && p < j ? { probationBeforeJoining: true } : null;
  }

  private patchFrom(e: Employee): void {
    this.form.patchValue({
      firstName: e.firstName, middleName: e.middleName ?? '', lastName: e.lastName, dateOfBirth: e.dateOfBirth ?? '',
      workEmail: e.workEmail, personalEmail: e.personalEmail ?? '', phone: e.phone ?? '', employeeCode: e.employeeCode,
      joiningDate: e.joiningDate?.slice(0, 10) ?? '', probationEndDate: e.probationEndDate ?? '', employmentType: e.employmentType,
      departmentId: e.department?.id ?? null, designationId: e.designation?.id ?? null, managerId: e.manager?.id ?? null,
      jobTitle: e.jobTitle ?? '', workLocation: e.workLocation ?? '',
      salary: e.compensation?.salary ?? null, salaryCurrency: e.compensation?.salaryCurrency ?? 'USD',
      address: { line: e.address?.line ?? '', city: e.address?.city ?? '', state: e.address?.state ?? '', country: e.address?.country ?? '', postalCode: e.address?.postalCode ?? '' },
      emergency: { name: e.emergencyContact?.name ?? '', phone: e.emergencyContact?.phone ?? '', relation: e.emergencyContact?.relation ?? '' },
    });
    const x = this.extrasStore.get(e.id);
    x.education.forEach((r) => this.education.push(educationGroup(this.fb, r)));
    x.experience.forEach((r) => this.experience.push(experienceGroup(this.fb, r)));
    x.skills.forEach((s) => this.skills.push(skillControl(this.fb, s)));
    this.form.controls.employeeCode.disable({ emitEvent: false }); // the code is assigned once
    this.form.markAsPristine();
  }

  // ----- FormArray operations -----
  protected addEducation(): void {
    this.education.push(educationGroup(this.fb));
    this.form.markAsDirty();
  }
  protected addExperience(): void {
    this.experience.push(experienceGroup(this.fb));
    this.form.markAsDirty();
  }
  protected addSkill(): void {
    this.skills.push(skillControl(this.fb));
    this.form.markAsDirty();
  }
  protected remove(array: FormArray, index: number): void {
    array.removeAt(index);
    this.form.markAsDirty();
  }

  protected rowError(group: AbstractControl, key: string, label: string): string {
    return errorMessage(group.get(key), label);
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.submitted;
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    this.serverError.set(null);
    if (this.checkingEmail()) {
      // the async e-mail check is still running: resubmit automatically as soon as it settles
      this.checkingEmail$.pipe(filter((busy) => !busy), take(1)).subscribe(() => this.submit());
      return;
    }
    if (this.form.invalid) {
      // viewChildren(): find the first rendered input whose control is invalid and move focus there
      this.inputs().find((i) => i.ngControl?.invalid)?.focus();
      return;
    }
    if (this.saving()) return;
    const raw = this.form.getRawValue(); // includes disabled controls (e.g. employeeCode on edit)
    const body: EmployeeWriteRequest = {
      firstName: raw.firstName.trim(), middleName: nz(raw.middleName), lastName: raw.lastName.trim(),
      dateOfBirth: nz(raw.dateOfBirth), workEmail: raw.workEmail.trim(), personalEmail: nz(raw.personalEmail), phone: nz(raw.phone),
      joiningDate: raw.joiningDate, probationEndDate: nz(raw.probationEndDate), employmentType: raw.employmentType,
      departmentId: raw.departmentId, designationId: raw.designationId, managerId: raw.managerId,
      jobTitle: nz(raw.jobTitle),
      // work_location is NOT NULL in the database: sending null makes the backend answer 500, so omit it when blank (DB default applies).
      ...(nz(raw.workLocation) ? { workLocation: nz(raw.workLocation)! } : {}),
      addressLine: nz(raw.address.line), city: nz(raw.address.city), state: nz(raw.address.state), country: nz(raw.address.country), postalCode: nz(raw.address.postalCode),
      emergencyContactName: nz(raw.emergency.name), emergencyContactPhone: nz(raw.emergency.phone), emergencyContactRelation: nz(raw.emergency.relation),
      ...(this.permissions.has('employee.salary.view') ? { salary: raw.salary, salaryCurrency: nz(raw.salaryCurrency)?.toUpperCase() ?? null } : {}),
    };
    if (!this.isEdit) {
      if (nz(raw.employeeCode)) body.employeeCode = raw.employeeCode.trim();
      if (raw.account.create) body.account = { role: raw.account.role, password: raw.account.password };
    }

    const extras: EmployeeExtras = {
      education: raw.education.map((r) => ({ ...r, startYear: r.startYear ?? null, endYear: r.endYear ?? null })),
      experience: raw.experience.map((r) => ({ ...r, endDate: r.currentlyWorking ? null : (r.endDate ?? null) })),
      skills: raw.skills.map((s) => s.trim()).filter(Boolean),
    };

    this.saving.set(true);
    const save$: Observable<Employee> = this.isEdit ? this.employees.update(this.employee!.id, body) : this.employees.create(body);
    save$
      .pipe(
        // concatMap keeps the follow-up steps strictly sequential and only after the employee exists.
        concatMap((saved) => this.afterSave(saved, extras).pipe(map(() => saved))),
      )
      .subscribe({
        next: (saved) => {
          this.submitted = true;
          if (this.isEdit) {
            this.detailsState?.set(saved);
            this.detailsState?.bumpHistory();
          }
          this.toast.success(this.isEdit ? 'Employee updated' : 'Employee created');
          void this.router.navigate(['/employees', saved.id]);
        },
        error: (e: AppError) => {
          this.saving.set(false);
          this.serverError.set(e);
          this.applyServerErrors(e.details);
        },
      });
  }

  /** Post-save steps run one after another with from() + concatMap: profile picture, then the browser-only extras. */
  private afterSave(saved: Employee, extras: EmployeeExtras): Observable<unknown> {
    const steps: (() => Observable<unknown>)[] = [];
    const file = this.pictureFile();
    if (file) steps.push(() => this.employees.uploadPicture(saved.id, file));
    steps.push(() => of(this.extrasStore.save(saved.id, extras)).pipe(tap(() => undefined)));
    return from(steps).pipe(concatMap((s) => s()), toArray());
  }

  private applyServerErrors(details: ValidationDetail[]): void {
    for (const d of details) {
      const control = this.form.get(SERVER_FIELD_MAP[d.field] ?? d.field);
      if (control) {
        control.setErrors({ ...(control.errors ?? {}), server: d.message });
        control.markAsTouched();
      }
    }
  }

  protected reset(): void {
    this.education.clear();
    this.experience.clear();
    this.skills.clear();
    this.form.reset();
    if (this.employee) this.patchFrom(this.employee);
    this.pictureFile.set(null);
  }
}
