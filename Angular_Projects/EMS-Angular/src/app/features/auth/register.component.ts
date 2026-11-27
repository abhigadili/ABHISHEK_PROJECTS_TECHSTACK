import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { EMPTY, Subject, catchError, exhaustMap, map, of, tap } from 'rxjs';
import { AppError } from '../../core/models/api.models';
import { Gender } from '../../core/models/auth.models';
import { isAppError } from '../../core/errors/app-error';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { FileUploadComponent } from '../../shared/components/file-upload.component';
import { PasswordStrengthComponent } from '../../shared/components/password-strength.component';
import { AutofocusDirective } from '../../shared/directives/directives';
import {
  errorMessage, matchFields, passwordComplexity, pastDate, phoneNumber, uniqueValue, usernameFormat,
} from '../../shared/validators/validators';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

/** Fields that exist in the backend contract (confirmPassword is intentionally absent — it is validated here only). */
const API_FIELDS = ['firstName', 'lastName', 'username', 'email', 'mobile', 'password', 'dateOfBirth', 'gender', 'address', 'departmentId', 'designationId'] as const;

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, PasswordStrengthComponent, FileUploadComponent, AutofocusDirective,
  ],
  styleUrl: './auth-layout.scss',
  styles: `
    .auth-card.wide { max-width: 720px; }
    .grid { display: grid; gap: 0 16px; grid-template-columns: 1fr 1fr; }
    .span-2 { grid-column: 1 / -1; }
    .picture { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .picture img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
    .picture small { color: var(--ems-muted); }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
  `,
  template: `
    <mat-card class="auth-card wide" appearance="outlined">
      <mat-card-content>
        <div class="brand"><mat-icon>apartment</mat-icon> <span>Create your account</span></div>
        <p class="hint">Register to get access to the Employee Management System.</p>

        @if (error(); as e) {
          <div class="error-banner" role="alert" data-testid="register-error">{{ e.message }}</div>
        }
        @if (optionsFailed()) {
          <div class="error-banner" role="status">Departments and designations could not be loaded; you can still register and HR will assign them.</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit$.next()" novalidate aria-label="Registration form">
          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>First name</mat-label>
              <input matInput formControlName="firstName" autocomplete="given-name" appAutofocus data-testid="reg-firstName" />
              <mat-error>{{ err('firstName', 'First name') }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Last name</mat-label>
              <input matInput formControlName="lastName" autocomplete="family-name" data-testid="reg-lastName" />
              <mat-error>{{ err('lastName', 'Last name') }}</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Username</mat-label>
              <input matInput formControlName="username" autocomplete="username" autocapitalize="none" data-testid="reg-username" />
              @if (form.controls.username.pending) {
                <mat-spinner matSuffix diameter="16" />
              }
              <mat-hint>3–30 characters; checked for availability</mat-hint>
              <mat-error>{{ err('username', 'Username') }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Email address</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" data-testid="reg-email" />
              <mat-error>{{ err('email', 'Email') }}</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Mobile number</mat-label>
              <input matInput type="tel" formControlName="mobile" autocomplete="tel" placeholder="+1 555 0100" data-testid="reg-mobile" />
              <mat-error>{{ err('mobile', 'Mobile number') }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Date of birth</mat-label>
              <input matInput type="date" formControlName="dateOfBirth" autocomplete="bday" data-testid="reg-dob" />
              <mat-error>{{ err('dateOfBirth', 'Date of birth') }}</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Gender</mat-label>
              <mat-select formControlName="gender" data-testid="reg-gender">
                @for (g of genders; track g.value) {
                  <mat-option [value]="g.value">{{ g.label }}</mat-option>
                }
              </mat-select>
              <mat-error>{{ err('gender', 'Gender') }}</mat-error>
            </mat-form-field>
            <span></span>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="new-password" data-testid="reg-password" />
              <button mat-icon-button matSuffix type="button" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" (click)="showPassword.set(!showPassword())">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error>{{ err('password', 'Password') }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Confirm password</mat-label>
              <input matInput [type]="showPassword() ? 'text' : 'password'" formControlName="confirmPassword" autocomplete="new-password" data-testid="reg-confirm" />
              <mat-error>{{ err('confirmPassword', 'Confirm password') }}</mat-error>
            </mat-form-field>
            <div class="span-2"><app-password-strength [password]="form.controls.password.value" /></div>

            <mat-form-field appearance="outline" class="span-2">
              <mat-label>Address</mat-label>
              <textarea matInput rows="2" formControlName="address" autocomplete="street-address" data-testid="reg-address"></textarea>
              <mat-error>{{ err('address', 'Address') }}</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Department (optional)</mat-label>
              <mat-select formControlName="departmentId" data-testid="reg-department">
                <mat-option value="">Not sure yet</mat-option>
                @for (d of options().departments; track d.id) {
                  <mat-option [value]="'' + d.id">{{ d.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Designation (optional)</mat-label>
              <mat-select formControlName="designationId" data-testid="reg-designation">
                <mat-option value="">Not sure yet</mat-option>
                @for (d of options().designations; track d.id) {
                  <mat-option [value]="'' + d.id">{{ d.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <div class="picture">
            @if (preview(); as src) {
              <img [src]="src" alt="Selected profile picture preview" data-testid="reg-preview" />
            }
            <app-file-upload [label]="picture() ? 'Change picture' : 'Choose picture (optional)'" icon="photo_camera" [disabled]="submitting()" (fileSelected)="onPicture($event)" />
            @if (picture()) {
              <button mat-button type="button" (click)="removePicture()">Remove</button>
            }
            <small>JPEG, PNG or WebP, up to 2 MB.</small>
          </div>

          <button mat-flat-button color="primary" class="full" type="submit" [disabled]="submitting()" data-testid="reg-submit">
            @if (submitting()) {
              <mat-spinner diameter="20" />
            } @else {
              Create account
            }
          </button>
        </form>
        <div class="links"><a routerLink="/login" data-testid="reg-login-link">Already registered? Sign in</a></div>
      </mat-card-content>
    </mat-card>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly genders = GENDERS;
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly picture = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);

  /** Department/designation choices from the public options endpoint; a failure degrades gracefully to empty lists. */
  protected readonly optionsFailed = signal(false);
  protected readonly options = toSignal(
    this.auth.registrationOptions().pipe(
      catchError(() => {
        this.optionsFailed.set(true);
        return of({ departments: [], designations: [] });
      }),
    ),
    { initialValue: { departments: [], designations: [] } },
  );

  protected readonly form = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(60)]],
      lastName: ['', [Validators.required, Validators.maxLength(60)]],
      username: [
        '',
        {
          validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30), usernameFormat()],
          // async + debounced: runs only when every sync rule passes; a lookup failure never blocks the form (server re-checks)
          asyncValidators: [uniqueValue((u) => this.auth.usernameAvailable(u.toLowerCase()).pipe(map((available) => !available)), 'usernameTaken')],
        },
      ],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(190)]],
      mobile: ['', [Validators.required, phoneNumber()]],
      password: ['', [Validators.required, passwordComplexity()]],
      confirmPassword: ['', [Validators.required]],
      dateOfBirth: ['', [Validators.required, pastDate()]],
      gender: ['' as Gender | '', [Validators.required]],
      address: ['', [Validators.maxLength(255)]],
      departmentId: [''],
      designationId: [''],
    },
    { validators: matchFields('password', 'confirmPassword') },
  );

  protected readonly err = (name: keyof typeof this.form.controls, label: string) => errorMessage(this.form.controls[name], label);

  /** exhaustMap: while a registration request is in flight, further submits are IGNORED → no duplicate accounts. */
  protected readonly submit$ = new Subject<void>();

  constructor() {
    this.submit$
      .pipe(
        tap(() => {
          this.form.markAllAsTouched();
          this.error.set(null);
        }),
        exhaustMap(() => {
          if (this.form.invalid || this.form.pending) return EMPTY;
          this.submitting.set(true);
          return this.auth.register(this.buildBody()).pipe(
            tap((res) => {
              this.toast.success('Registration successful. You can now sign in.');
              void this.router.navigate(['/login'], { queryParams: { registered: res.username } });
            }),
            catchError((e: unknown) => {
              this.showServerError(isAppError(e) ? e : null, e);
              return EMPTY;
            }),
            tap({ complete: () => this.submitting.set(false), error: () => this.submitting.set(false) }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.submitting.set(false));

    inject(DestroyRef).onDestroy(() => this.revokePreview());
  }

  protected onPicture(file: File): void {
    this.revokePreview();
    this.picture.set(file);
    this.preview.set(URL.createObjectURL(file));
  }

  protected removePicture(): void {
    this.revokePreview();
    this.picture.set(null);
    this.preview.set(null);
  }

  private revokePreview(): void {
    const p = this.preview();
    if (p) URL.revokeObjectURL(p);
  }

  /** multipart body: only contract fields, empty optionals omitted, no confirmPassword. */
  private buildBody(): FormData {
    const v = this.form.getRawValue();
    const fd = new FormData();
    for (const k of API_FIELDS) {
      const val = String(v[k] ?? '').trim();
      if (val !== '') fd.append(k, val);
    }
    const pic = this.picture();
    if (pic) fd.append('file', pic, pic.name);
    return fd;
  }

  /** Backend validation / duplicate errors are shown next to the field they belong to; anything else becomes a banner. */
  private showServerError(e: AppError | null, raw: unknown): void {
    if (!e) {
      this.error.set({ status: 0, code: 'UNKNOWN', message: raw instanceof Error ? raw.message : 'Unexpected error', details: [] });
      return;
    }
    let mapped = false;
    for (const d of e.details) {
      const ctrl = this.form.controls[d.field as keyof typeof this.form.controls];
      if (ctrl && (API_FIELDS as readonly string[]).includes(d.field)) {
        ctrl.setErrors({ server: d.message });
        ctrl.markAsTouched();
        mapped = true;
        if (d.field === 'username') ctrl.markAsDirty();
      }
    }
    if (!mapped) this.error.set(e);
    else document.querySelector<HTMLElement>('.mat-mdc-form-field-error')?.scrollIntoView?.({ block: 'center' });
  }
}
