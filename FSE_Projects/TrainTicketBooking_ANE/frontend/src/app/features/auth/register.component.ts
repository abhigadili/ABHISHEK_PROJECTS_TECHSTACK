import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import type { HasUnsavedChanges } from '../../core/guards/guards';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { FieldErrorComponent, PasswordFieldComponent } from '../../shared/components/ui.components';
import { DigitsOnlyDirective } from '../../shared/directives/directives';
import { applyServerErrors, indianMobile, matchFields, passwordComplexity } from '../../shared/validators/validators';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, FieldErrorComponent, PasswordFieldComponent, DigitsOnlyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Create your account</h1>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-form-field><mat-label>Full name</mat-label><input matInput formControlName="name" autocomplete="name" /><mat-error><app-field-error [control]="form.controls.name" label="Name" /></mat-error></mat-form-field>
      <mat-form-field><mat-label>E-mail</mat-label><input matInput type="email" formControlName="email" autocomplete="email" /><mat-error><app-field-error [control]="form.controls.email" label="E-mail" /></mat-error></mat-form-field>
      <mat-form-field><mat-label>Mobile number</mat-label><span matTextPrefix>+91&nbsp;</span><input matInput formControlName="mobile" inputmode="numeric" maxlength="10" appDigitsOnly autocomplete="tel-national" /><mat-hint>10 digits, starting 6-9</mat-hint><mat-error><app-field-error [control]="form.controls.mobile" label="Mobile" /></mat-error></mat-form-field>
      <app-password-field [control]="form.controls.password" autocomplete="new-password" />
      <p class="hint muted" [class.ok]="form.controls.password.valid">At least 8 characters with an uppercase letter, a lowercase letter and a digit.</p>
      <app-password-field [control]="form.controls.confirmPassword" label="Confirm password" autocomplete="new-password" />
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      <button mat-flat-button type="submit" [disabled]="busy()">Create account</button>
    </form>
    <p>Already registered? <a routerLink="/auth/login">Sign in</a></p>`,
  styles: [`form{display:flex;flex-direction:column;gap:4px}button[type=submit]{height:48px;margin-top:8px}.hint{margin:-6px 0 8px;font-size:.8rem}.ok{color:#1e6b34}`],
})
export class RegisterComponent implements HasUnsavedChanges {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly busy = signal(false); readonly error = signal('');
  private done = false;
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    mobile: ['', [Validators.required, indianMobile]],
    password: ['', [Validators.required, passwordComplexity, Validators.maxLength(72)]],
    confirmPassword: ['', Validators.required],
  }, { validators: matchFields('password', 'confirmPassword') });
  hasUnsavedChanges() { return !this.done && this.form.dirty; }
  submit() {
    this.form.markAllAsTouched(); if (this.form.invalid || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.auth.register(this.form.getRawValue()).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.done = true; this.toast.success('Account created. Please sign in.'); void this.router.navigate(['/auth/login']); },
      error: (e) => { const err = toApiError(e); applyServerErrors(this.form, err.fields); this.error.set(err.message); },
    });
  }
}
