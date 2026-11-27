import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { PasswordFieldComponent } from '../../shared/components/ui.components';
import { matchFields, passwordComplexity } from '../../shared/validators/validators';

@Component({
  selector: 'app-reset-password', imports: [ReactiveFormsModule, RouterLink, MatButtonModule, PasswordFieldComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Choose a new password</h1>
    @if (!token()) { <p class="err" role="alert">This reset link is incomplete. Request a new one.</p><a mat-stroked-button routerLink="/auth/forgot-password">Request a new link</a> }
    @else {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-password-field [control]="form.controls.password" label="New password" autocomplete="new-password" />
        <app-password-field [control]="form.controls.confirmPassword" label="Confirm new password" autocomplete="new-password" />
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
        <button mat-flat-button type="submit" [disabled]="busy()">Update password</button>
      </form>
    }`,
  styles: [`form{display:flex;flex-direction:column;gap:6px}button[type=submit]{height:48px}`],
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService); private readonly router = inject(Router); private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly token = input<string | undefined>();
  readonly busy = signal(false); readonly error = signal('');
  readonly form = this.fb.group({ password: ['', [Validators.required, passwordComplexity]], confirmPassword: ['', Validators.required] }, { validators: matchFields('password', 'confirmPassword') });
  submit() {
    this.form.markAllAsTouched(); if (this.form.invalid || this.busy() || !this.token()) return;
    this.busy.set(true);
    this.auth.resetPassword({ token: this.token()!, ...this.form.getRawValue() }).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.toast.success('Password updated. Sign in with your new password.'); void this.router.navigate(['/auth/login']); },
      error: (e) => this.error.set(toApiError(e).message),
    });
  }
}
