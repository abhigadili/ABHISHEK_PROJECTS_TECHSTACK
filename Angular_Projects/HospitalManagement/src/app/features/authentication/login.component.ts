import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/models/api-error';
import { FocusDirective } from '../../shared/directives/directives';

/**
 * Login (Tailwind). Typed Reactive Form built with NonNullableFormBuilder; `returnUrl` arrives through component input binding
 * (`withComponentInputBinding`: the query parameter ?returnUrl= is bound to the signal input) → redirect after login.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-2xl font-bold">Sign in</h1>
    <p class="mb-5 mt-1 text-sm text-slate-500">Use your hospital account to continue.</p>
    @if (auth.logoutReason() === 'expired') { <p class="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Your session expired – please sign in again.</p> }
    @if (error()) { <p role="alert" class="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-4" aria-label="Sign in form">
      <div>
        <label for="username" class="mb-1 block text-sm font-medium">Username</label>
        <input id="username" appFocus formControlName="username" autocomplete="username" class="h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 dark:border-slate-600" [attr.aria-invalid]="invalid('username')" />
        @if (invalid('username')) { <p class="mt-1 text-xs text-red-600">Username is required</p> }
      </div>
      <div>
        <label for="password" class="mb-1 block text-sm font-medium">Password</label>
        <div class="relative">
          <input id="password" [type]="show() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" class="h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 pr-16 dark:border-slate-600" [attr.aria-invalid]="invalid('password')" />
          <button type="button" class="absolute right-2 top-2 text-xs text-slate-500" (click)="show.set(!show())">{{ show() ? 'Hide' : 'Show' }}</button>
        </div>
        @if (invalid('password')) { <p class="mt-1 text-xs text-red-600">Password is required</p> }
      </div>
      <button type="submit" class="h-10 w-full rounded-md bg-brand-600 font-semibold text-white hover:bg-brand-700 disabled:opacity-60" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
    </form>
    <p class="mt-5 text-center text-sm text-slate-500">New patient? <a routerLink="/auth/register" class="font-semibold text-brand-600 hover:underline">Register here</a></p>
    <p class="mt-3 text-center text-xs text-slate-400">Forgot-password, MFA and OAuth 2.0 sign-in are not offered: the backend has no such endpoints.</p>
  `,
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly returnUrl = input<string | undefined>(); // bound from ?returnUrl=…
  protected readonly show = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({ username: ['', Validators.required], password: ['', Validators.required] });
  protected invalid(c: 'username' | 'password') { const x = this.form.controls[c]; return x.invalid && (x.touched || x.dirty); }

  protected submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.busy.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: () => void this.router.navigateByUrl(this.returnUrl() && !this.returnUrl()!.startsWith('/auth') ? this.returnUrl()! : '/dashboard'),
      error: (e: unknown) => {
        const err = ApiError.from(e);
        this.error.set(err.status === 401 ? 'Invalid username or password. After 8 failed attempts an account is locked for 5 minutes.' : err.status === 429 ? 'Too many sign-in attempts. Please wait a minute and try again.' : err.message);
      },
    });
  }
}
