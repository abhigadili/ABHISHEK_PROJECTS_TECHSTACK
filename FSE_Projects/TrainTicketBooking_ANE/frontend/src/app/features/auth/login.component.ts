import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EMPTY, catchError, exhaustMap, finalize, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { toApiError } from '../../core/interceptors/error.interceptor';
import { FieldErrorComponent, PasswordFieldComponent } from '../../shared/components/ui.components';
import { AutofocusDirective } from '../../shared/directives/directives';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, FieldErrorComponent, PasswordFieldComponent, AutofocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Sign in</h1>
    <p class="muted">Welcome back. Enter your account details.</p>
    @if (expired()) { <p class="err" role="alert">Your session expired. Please sign in again.</p> }
    <form [formGroup]="form" (ngSubmit)="submit$.next()" novalidate>
      <mat-form-field class="full"><mat-label>E-mail</mat-label>
        <input matInput type="email" formControlName="email" autocomplete="username" appAutofocus />
        <mat-error><app-field-error [control]="form.controls.email" label="E-mail" /></mat-error></mat-form-field>
      <app-password-field [control]="form.controls.password" />
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      <button mat-flat-button class="full" type="submit" [disabled]="busy()">@if (busy()) { <mat-spinner diameter="20" /> } @else { Sign in }</button>
    </form>
    <p class="row spread"><a routerLink="/auth/forgot-password">Forgot password?</a><span>New here? <a routerLink="/auth/register">Create an account</a></span></p>`,
  styles: [`form{display:flex;flex-direction:column;gap:6px}button[type=submit]{height:48px}`],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** Bound from the query string (withComponentInputBinding). */
  readonly returnUrl = input<string | undefined>();
  readonly expired = input<string | undefined>();
  readonly busy = signal(false); readonly error = signal('');
  readonly form = this.fb.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  /** exhaustMap ignores extra submits while a login is running (no duplicate submissions). */
  readonly submit$ = new Subject<void>();
  constructor() {
    this.submit$.pipe(
      exhaustMap(() => {
        this.form.markAllAsTouched(); if (this.form.invalid) return EMPTY;
        this.busy.set(true); this.error.set('');
        const { email, password } = this.form.getRawValue();
        return this.auth.login(email, password).pipe(
          finalize(() => this.busy.set(false)),
          catchError((e) => { this.error.set(toApiError(e).message); return EMPTY; }), // keep the outer stream alive
        );
      }),
      takeUntilDestroyed(),
    ).subscribe((s) => this.go(s.user.roles.some((r) => r !== 'PASSENGER')));
  }
  private go(backOffice: boolean) {
    const target = this.returnUrl();
    void this.router.navigateByUrl(target && target.startsWith('/') ? target : backOffice ? '/admin' : '/app/dashboard');
  }
}
