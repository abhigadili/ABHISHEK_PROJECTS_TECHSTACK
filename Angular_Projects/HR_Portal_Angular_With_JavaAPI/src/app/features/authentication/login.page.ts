import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { AuthActions, selectError, selectLoggingIn } from '../../state/ngrx/auth.state';
import { connectionStore } from '../../state/zustand-style/connection.store';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'app-login-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ReactiveFormsModule, RouterLink, TranslateModule, AuthLayoutComponent],
  template: `<app-auth-layout [title]="'auth.signInTitle' | translate" [subtitle]="'auth.signInSub' | translate">
    @if (!online()) { <div role="alert" class="mb-3 rounded-2 p-2" style="font-size:12px;border:1px solid rgb(var(--hr-warning-rgb)/.4);background:rgb(var(--hr-warning-rgb)/.1)">{{ 'common.backendDown' | translate }} — {{ 'common.backendDownHint' | translate }}</div> }
    @if (error()) { <div role="alert" class="mb-3 rounded-2 p-2" style="font-size:12px;color:var(--hr-danger);border:1px solid rgb(var(--hr-danger-rgb)/.4);background:rgb(var(--hr-danger-rgb)/.1)">{{ error() }}</div> }
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="d-grid gap-3">
      <div><label class="field-label" for="username">{{ 'auth.username' | translate }}</label><input id="username" class="form-control" autocomplete="username" formControlName="username" />
        @if (bad('username')) { <div class="field-error">{{ 'common.validation.required' | translate }}</div> }</div>
      <div><label class="field-label" for="password">{{ 'auth.password' | translate }}</label>
        <div class="position-relative"><input id="password" class="form-control" [type]="show() ? 'text' : 'password'" autocomplete="current-password" formControlName="password" />
          <button type="button" class="position-absolute border-0 bg-transparent text-muted" style="right:8px;top:7px" (click)="show.set(!show())" aria-label="toggle password"><i class="pi" [class.pi-eye]="!show()" [class.pi-eye-slash]="show()"></i></button></div>
        @if (bad('password')) { <div class="field-error">{{ 'common.validation.required' | translate }}</div> }</div>
      <button type="submit" class="btn-hr primary justify-content-center py-2" [disabled]="busy()">@if (busy()) { <i class="pi pi-spin pi-spinner"></i> }{{ 'auth.signIn' | translate }}</button>
      <div class="d-flex justify-content-between" style="font-size:13px"><a routerLink="/forgot-password">{{ 'auth.forgot' | translate }}</a><a routerLink="/register">{{ 'auth.register' | translate }}</a></div>
    </form></app-auth-layout>`,
})
export class LoginPage {
  private store = inject(Store); private fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({ username: ['', [Validators.required, Validators.maxLength(150)]], password: ['', [Validators.required, Validators.maxLength(200)]] });
  show = signal(false); busy = this.store.selectSignal(selectLoggingIn); error = this.store.selectSignal(selectError); online = connectionStore.select((s) => s.online);
  bad(n: 'username' | 'password') { const c = this.form.controls[n]; return c.invalid && (c.touched || c.dirty); }
  submit() { this.form.markAllAsTouched(); if (this.form.invalid) return; const v = this.form.getRawValue(); this.store.dispatch(AuthActions.loginRequested({ username: v.username.trim(), password: v.password })); }
}
export default LoginPage;
