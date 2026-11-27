import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import type { HasUnsavedChanges } from '../../core/guards/guards';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent, PasswordFieldComponent } from '../../shared/components/ui.components';
import { applyServerErrors, differFrom, matchFields, passwordComplexity } from '../../shared/validators/validators';

@Component({
  selector: 'app-change-password', imports: [ReactiveFormsModule, RouterLink, MatButtonModule, PageHeaderComponent, PasswordFieldComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Change password" subtitle="Other devices are signed out after a change" />
    <form class="card narrow" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <app-password-field [control]="form.controls.currentPassword" label="Current password" />
      <app-password-field [control]="form.controls.newPassword" label="New password" autocomplete="new-password" />
      <app-password-field [control]="form.controls.confirmPassword" label="Confirm new password" autocomplete="new-password" />
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      <div class="row"><button mat-flat-button type="submit" [disabled]="busy()">Update password</button><a mat-button routerLink="/app/profile">Cancel</a></div>
    </form>`,
  styles: [`.narrow{max-width:460px;display:flex;flex-direction:column;gap:6px}`],
})
export class ChangePasswordComponent implements HasUnsavedChanges {
  private readonly auth = inject(AuthService); private readonly router = inject(Router); private readonly toast = inject(ToastService); private readonly fb = inject(NonNullableFormBuilder);
  readonly busy = signal(false); readonly error = signal(''); private done = false;
  readonly form = this.fb.group({ currentPassword: ['', Validators.required], newPassword: ['', [Validators.required, passwordComplexity]], confirmPassword: ['', Validators.required] }, { validators: [matchFields('newPassword', 'confirmPassword'), differFrom('currentPassword', 'newPassword')] });
  hasUnsavedChanges() { return !this.done && this.form.dirty; }
  submit() {
    this.form.markAllAsTouched(); if (this.form.invalid || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.auth.changePassword(this.form.getRawValue()).pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.done = true; this.toast.success('Password changed.'); void this.router.navigate(['/app/profile']); },
      error: (e) => { const err = toApiError(e); applyServerErrors(this.form, err.fields); this.error.set(err.message); },
    });
  }
}
