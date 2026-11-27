import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AppError } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { errorMessage } from '../../shared/validators/validators';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  styleUrl: './auth-layout.scss',
  template: `
    <mat-card class="auth-card" appearance="outlined">
      <mat-card-content>
        <div class="brand">Forgot password</div>
        <p class="hint">Enter your work email. If the account exists, reset instructions are issued.</p>
        @if (error(); as e) {
          <div class="error-banner" role="alert">{{ e.message }}</div>
        }
        @if (sent()) {
          <div class="success-banner" role="status" data-testid="forgot-sent">If the account exists, password reset instructions have been issued.</div>
          @if (devToken(); as t) {
            <p class="hint">Development backend: reset token returned by the API.</p>
            <button mat-stroked-button class="full" type="button" (click)="useToken(t)">Continue to reset</button>
          }
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field appearance="outline" class="full">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="username" data-testid="forgot-email" />
              <mat-error>{{ err() }}</mat-error>
            </mat-form-field>
            <button mat-flat-button color="primary" class="full" type="submit" [disabled]="busy()" data-testid="forgot-submit">Send reset instructions</button>
          </form>
        }
        <div class="links"><a routerLink="/login">Back to sign in</a></div>
      </mat-card-content>
    </mat-card>
  `,
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly devToken = signal<string | null>(null);
  protected readonly err = () => errorMessage(this.form.controls.email, 'Email');

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: (res) => {
        this.devToken.set(res?.resetToken ?? null);
        this.sent.set(true);
        this.busy.set(false);
      },
      error: (e: AppError) => {
        this.error.set(e);
        this.busy.set(false);
      },
    });
  }

  protected useToken(token: string): void {
    void this.router.navigate(['/reset-password'], { queryParams: { token } });
  }
}
