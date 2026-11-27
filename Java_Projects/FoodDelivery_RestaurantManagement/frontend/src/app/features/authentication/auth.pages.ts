import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { UI } from '../../shared/material';

const CARD = `display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#fff7ed,#ffedd5)`;

const strong = (c: AbstractControl): ValidationErrors | null => {
  const v: string = c.value ?? '';
  return v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v) ? null : { weak: true };
};
const match = (a: string, b: string) => (g: AbstractControl): ValidationErrors | null => g.get(a)?.value === g.get(b)?.value ? null : { mismatch: true };

@Component({
  selector: 'app-login', imports: [UI],
  template: `<div [style]="card"><mat-card style="width:400px;max-width:94vw;padding:16px">
    <h1>🍽 Sign in</h1><div class="muted" style="margin-bottom:12px">Food delivery & restaurant management</div>
    <form [formGroup]="f" (ngSubmit)="go()">
      <mat-form-field><mat-label>Username or e-mail</mat-label><input matInput formControlName="u" autocomplete="username"></mat-form-field>
      <mat-form-field><mat-label>Password</mat-label><input matInput type="password" formControlName="p" autocomplete="current-password"></mat-form-field>
      <button mat-flat-button color="primary" class="full" [disabled]="f.invalid || busy()">@if (busy()) { Signing in... } @else { Sign in }</button>
    </form>
    <div class="row" style="margin-top:12px"><a routerLink="/forgot-password">Forgot password?</a><a class="right" routerLink="/register">Create account</a></div>
  </mat-card></div>`
})
export class LoginComponent {
  card = CARD;
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router);
  busy = signal(false);
  f = this.fb.nonNullable.group({ u: ['', Validators.required], p: ['', Validators.required] });
  go() {
    this.busy.set(true);
    this.auth.login(this.f.value.u!, this.f.value.p!).subscribe({ next: () => this.router.navigateByUrl(this.auth.homeFor()), error: () => this.busy.set(false) });
  }
}

@Component({
  selector: 'app-register', imports: [UI],
  template: `<div [style]="card"><mat-card style="width:520px;max-width:94vw;padding:16px">
    <h1>Create your account</h1>
    <form [formGroup]="f" (ngSubmit)="go()">
      <mat-button-toggle-group formControlName="role" style="margin-bottom:12px;width:100%">
        <mat-button-toggle value="CUSTOMER">Customer</mat-button-toggle><mat-button-toggle value="RESTAURANT_OWNER">Restaurant owner</mat-button-toggle><mat-button-toggle value="DELIVERY_PARTNER">Delivery partner</mat-button-toggle>
      </mat-button-toggle-group>
      <div class="form-grid">
        <mat-form-field><mat-label>Username</mat-label><input matInput formControlName="username"><mat-error>3-50 letters, digits . _ -</mat-error></mat-form-field>
        <mat-form-field><mat-label>Full name</mat-label><input matInput formControlName="fullName"></mat-form-field>
        <mat-form-field><mat-label>E-mail</mat-label><input matInput formControlName="email" type="email"><mat-error>Valid e-mail required</mat-error></mat-form-field>
        <mat-form-field><mat-label>Phone</mat-label><input matInput formControlName="phone"></mat-form-field>
        <mat-form-field><mat-label>Password</mat-label><input matInput type="password" formControlName="password"><mat-hint>8+ chars, upper, lower, digit, symbol</mat-hint><mat-error>Password is too weak</mat-error></mat-form-field>
        <mat-form-field><mat-label>Confirm password</mat-label><input matInput type="password" formControlName="confirmPassword"></mat-form-field>
      </div>
      @if (f.hasError('mismatch') && f.controls.confirmPassword.touched) { <div class="bad muted">Passwords do not match</div> }
      <button mat-flat-button color="primary" class="full" [disabled]="f.invalid || busy()" style="margin-top:12px">Register</button>
    </form>
    <div style="margin-top:12px"><a routerLink="/login">Already have an account? Sign in</a></div>
  </mat-card></div>`
})
export class RegisterComponent {
  card = CARD;
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router); private snack = inject(MatSnackBar);
  busy = signal(false);
  f = this.fb.nonNullable.group({
    role: ['CUSTOMER', Validators.required], username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
    fullName: ['', Validators.required], email: ['', [Validators.required, Validators.email]], phone: ['', Validators.pattern(/^[0-9+\- ]{7,20}$/)],
    password: ['', [Validators.required, strong]], confirmPassword: ['', Validators.required]
  }, { validators: match('password', 'confirmPassword') });
  go() {
    this.busy.set(true);
    this.auth.register(this.f.getRawValue()).subscribe({
      next: () => { this.snack.open('Account created: please sign in', undefined, { duration: 4000 }); this.router.navigateByUrl('/login'); },
      error: () => this.busy.set(false)
    });
  }
}

@Component({
  selector: 'app-forgot', imports: [UI],
  template: `<div [style]="card"><mat-card style="width:420px;max-width:94vw;padding:16px">
    <h1>Reset password</h1>
    @if (step() === 1) {
      <p class="muted">Enter your e-mail and we will send a one-time reset code.</p>
      <mat-form-field><mat-label>E-mail</mat-label><input matInput [formControl]="email" type="email"></mat-form-field>
      <button mat-flat-button color="primary" class="full" [disabled]="email.invalid" (click)="send()">Send code</button>
    } @else {
      <p class="muted">{{ msg() }}</p>
      @if (devToken()) { <div class="card" style="background:#fff7ed;margin-bottom:8px"><div class="muted">Sandbox mode (no real e-mail provider): your code is</div><div class="mono" style="word-break:break-all">{{ devToken() }}</div></div> }
      <form [formGroup]="f" (ngSubmit)="reset()">
        <mat-form-field><mat-label>Reset code</mat-label><input matInput formControlName="token"></mat-form-field>
        <mat-form-field><mat-label>New password</mat-label><input matInput type="password" formControlName="pw"><mat-error>8+ chars with upper, lower, digit and symbol</mat-error></mat-form-field>
        <button mat-flat-button color="primary" class="full" [disabled]="f.invalid">Set new password</button>
      </form>
    }
    <div style="margin-top:12px"><a routerLink="/login">Back to sign in</a></div>
  </mat-card></div>`
})
export class ForgotPasswordComponent {
  card = CARD;
  private fb = inject(FormBuilder); private auth = inject(AuthService); private router = inject(Router); private snack = inject(MatSnackBar);
  step = signal(1); msg = signal(''); devToken = signal<string | undefined>(undefined);
  email = this.fb.nonNullable.control('', [Validators.required, Validators.email]);
  f = this.fb.nonNullable.group({ token: ['', Validators.required], pw: ['', [Validators.required, strong]] });
  send() { this.auth.forgot(this.email.value).subscribe(r => { this.msg.set(r.message); this.devToken.set(r.devResetToken); this.step.set(2); if (r.devResetToken) this.f.patchValue({ token: r.devResetToken }); }); }
  reset() { this.auth.reset(this.f.value.token!, this.f.value.pw!).subscribe(() => { this.snack.open('Password updated: sign in with your new password', undefined, { duration: 4000 }); this.router.navigateByUrl('/login'); }); }
}
