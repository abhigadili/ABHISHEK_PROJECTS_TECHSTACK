import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AppError } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PasswordStrengthComponent } from '../../shared/components/password-strength.component';
import { errorMessage, matchFields, passwordComplexity } from '../../shared/validators/validators';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, PasswordStrengthComponent],
  styleUrl: './auth-layout.scss',
  template: `
    <mat-card class="auth-card" appearance="outlined">
      <mat-card-content>
        <div class="brand">Reset password</div>
        <p class="hint">Choose a new password for your account.</p>
        @if (error(); as e) {
          <div class="error-banner" role="alert">{{ e.message }}</div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Reset token</mat-label>
            <input matInput formControlName="token" data-testid="reset-token" />
            <mat-error>{{ err('token', 'Token') }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>New password</mat-label>
            <input matInput type="password" formControlName="newPassword" autocomplete="new-password" data-testid="reset-password" />
            <mat-error>{{ err('newPassword', 'Password') }}</mat-error>
          </mat-form-field>
          <app-password-strength [password]="form.controls.newPassword.value" />
          <mat-form-field appearance="outline" class="full">
            <mat-label>Confirm password</mat-label>
            <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
            <mat-error>{{ err('confirm', 'Confirmation') }}</mat-error>
          </mat-form-field>
          <button mat-flat-button color="primary" class="full" type="submit" [disabled]="busy()" data-testid="reset-submit">Reset password</button>
        </form>
        <div class="links"><a routerLink="/login">Back to sign in</a></div>
      </mat-card-content>
    </mat-card>
  `,
})
export class ResetPasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = this.fb.group(
    {
      token: [this.route.snapshot.queryParamMap.get('token') ?? '', [Validators.required, Validators.minLength(20)]],
      newPassword: ['', [Validators.required, passwordComplexity()]],
      confirm: ['', [Validators.required]],
    },
    { validators: matchFields('newPassword', 'confirm') },
  );
  protected readonly busy = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly err = (n: 'token' | 'newPassword' | 'confirm', l: string) => errorMessage(this.form.controls[n], l);

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const { token, newPassword } = this.form.getRawValue();
    this.auth.resetPassword(token, newPassword).subscribe({
      next: () => {
        this.toast.success('Password reset. Please sign in.');
        void this.router.navigate(['/login']);
      },
      error: (e: AppError) => {
        this.error.set(e);
        this.busy.set(false);
      },
    });
  }
}
