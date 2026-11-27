import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, catchError, EMPTY, exhaustMap, tap } from 'rxjs';
import { AppError } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { AutofocusDirective } from '../../shared/directives/directives';
import { errorMessage } from '../../shared/validators/validators';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, AutofocusDirective],
  styleUrl: './auth-layout.scss',
  template: `
    <mat-card class="auth-card" appearance="outlined">
      <mat-card-content>
        <div class="brand"><mat-icon>apartment</mat-icon> <span i18n="@@login.title">Employee Management</span></div>
        <p class="hint" i18n="@@login.subtitle">Sign in with your work account</p>

        @if (registered(); as name) {
          <div class="success-banner" role="status" data-testid="registered-banner">Registration successful. Sign in as <strong>{{ name }}</strong> with the password you chose.</div>
        }
        @if (error(); as e) {
          <div class="error-banner" role="alert" data-testid="login-error">{{ e.message }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit$.next()" novalidate>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Username or email</mat-label>
            <input matInput type="text" formControlName="identifier" autocomplete="username" autocapitalize="none" appAutofocus data-testid="login-email" />
            <mat-error>{{ err('identifier', 'Username or email') }}</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Password</mat-label>
            <input matInput [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" data-testid="login-password" />
            <button mat-icon-button matSuffix type="button" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" (click)="showPassword.set(!showPassword())">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-error>{{ err('password', 'Password') }}</mat-error>
          </mat-form-field>

          <button mat-flat-button color="primary" class="full" type="submit" [disabled]="submitting()" data-testid="login-submit">
            @if (submitting()) {
              <mat-spinner diameter="20" />
            } @else {
              Sign in
            }
          </button>
        </form>
        <div class="links"><a routerLink="/forgot-password">Forgot password?</a><a routerLink="/register" data-testid="register-link">Create an account</a></div>
      </mat-card-content>
    </mat-card>
  `,
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly prefs = inject(PreferencesService);

  protected readonly form = this.fb.group({
    identifier: [this.route.snapshot.queryParamMap.get('registered') ?? '', [Validators.required]],
    password: ['', [Validators.required]],
  });
  /** Set by the registration page after a successful sign-up. */
  protected readonly registered = signal<string | null>(this.route.snapshot.queryParamMap.get('registered'));
  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly err = (name: 'identifier' | 'password', label: string) => errorMessage(this.form.controls[name], label);

  /**
   * exhaustMap: while a login request is in flight, further submit clicks / Enter presses are IGNORED
   * (not queued, not cancelling) — this is what prevents duplicate login submissions.
   */
  protected readonly submit$ = new Subject<void>();

  constructor() {
    this.submit$
      .pipe(
        tap(() => {
          this.form.markAllAsTouched();
          this.error.set(null);
        }),
        exhaustMap(() => {
          if (this.form.invalid) return EMPTY;
          this.submitting.set(true);
          const { identifier, password } = this.form.getRawValue();
          // '@' can never be part of a username, so it unambiguously tells the two apart
          const who = identifier.includes('@') ? { email: identifier.trim() } : { username: identifier.trim().toLowerCase() };
          return this.auth.login({ ...who, password }).pipe(
            tap(() => void this.router.navigateByUrl(this.target())),
            catchError((e: AppError) => {
              this.error.set(e);
              return EMPTY;
            }),
            tap({ complete: () => this.submitting.set(false), error: () => this.submitting.set(false) }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.submitting.set(false));
  }

  /** Honour ?returnUrl (set by authGuard), otherwise the user's preferred landing page. */
  private target(): string {
    const ret = this.route.snapshot.queryParamMap.get('returnUrl');
    if (ret && ret.startsWith('/') && !ret.startsWith('//')) return ret; // same-origin paths only (no open redirect)
    return `/${this.prefs.prefs().landingPage}`;
  }
}
