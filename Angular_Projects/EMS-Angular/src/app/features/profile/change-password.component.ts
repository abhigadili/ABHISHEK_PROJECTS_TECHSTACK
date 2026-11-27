import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AppError } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PasswordStrengthComponent } from '../../shared/components/password-strength.component';
import { NoticeBannerComponent, PageHeaderComponent } from '../../shared/components/ui-basics';
import { errorMessage, matchFields, passwordComplexity } from '../../shared/validators/validators';

/** The backend revokes every session when the password changes, so success ends with a fresh login. */
@Component({
  selector: 'app-change-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, PageHeaderComponent, NoticeBannerComponent, PasswordStrengthComponent],
  template: `
    <div class="page narrow">
      <app-page-header title="Change password" />
      <app-notice-banner>You will be signed out on every device after changing your password.</app-notice-banner>
      @if (error(); as e) { <div class="server-error" role="alert" data-testid="cp-error">{{ e.message }}</div> }
      <form class="panel" [formGroup]="form" (ngSubmit)="submit()" novalidate data-testid="change-password-form">
        <mat-form-field appearance="outline" class="full-width"><mat-label>Current password</mat-label><input matInput type="password" formControlName="currentPassword" autocomplete="current-password" data-testid="cp-current" /><mat-error>{{ err('currentPassword', 'Current password') }}</mat-error></mat-form-field>
        <mat-form-field appearance="outline" class="full-width"><mat-label>New password</mat-label><input matInput type="password" formControlName="newPassword" autocomplete="new-password" data-testid="cp-new" /><mat-error>{{ err('newPassword', 'New password') }}</mat-error></mat-form-field>
        <app-password-strength [password]="form.controls.newPassword.value" />
        <mat-form-field appearance="outline" class="full-width"><mat-label>Confirm new password</mat-label><input matInput type="password" formControlName="confirm" autocomplete="new-password" data-testid="cp-confirm" /><mat-error>{{ err('confirm', 'Confirmation') }}</mat-error></mat-form-field>
        <div class="actions"><button mat-flat-button color="primary" type="submit" [disabled]="saving()" data-testid="cp-submit">Change password</button></div>
      </form>
    </div>
  `,
  styles: `.narrow { max-width: 560px; } .actions { display: flex; justify-content: flex-end; } .server-error { background: #fce8e6; color: #c5221f; padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; }`,
})
export class ChangePasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly saving = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordComplexity()]],
      confirm: ['', Validators.required],
    },
    { validators: matchFields('newPassword', 'confirm') },
  );
  protected readonly err = (n: 'currentPassword' | 'newPassword' | 'confirm', l: string) => errorMessage(this.form.controls[n], l);

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.toast.success('Password changed. Please sign in again.');
        this.auth.logout();
      },
      error: (e: AppError) => {
        this.saving.set(false);
        this.error.set(e);
      },
    });
  }
}
