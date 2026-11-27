import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from '../../api/services';
import { tokens } from '../../core/auth/tokens';
import { ToastService } from '../../core/services/toast.service';
import { AuthActions, selectMustChangePassword } from '../../state/ngrx/auth.state';
import { AuthLayoutComponent } from './auth-layout.component';
import { sameAs, strongPassword } from './password.validators';

/** After a password change the backend revokes every token, so the session is ended locally (no logout call, no refresh attempt). */
@Component({
  selector: 'app-change-password-form', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ReactiveFormsModule, TranslateModule],
  template: `<form [formGroup]="form" (ngSubmit)="submit()" novalidate class="d-grid gap-3">
    <div><label class="field-label">{{ 'auth.currentPassword' | translate }}</label><input type="password" class="form-control" autocomplete="current-password" formControlName="currentPassword" />@if (bad('currentPassword')) { <div class="field-error">{{ 'common.validation.required' | translate }}</div> }</div>
    <div><label class="field-label">{{ 'auth.newPassword' | translate }}</label><input type="password" class="form-control" autocomplete="new-password" formControlName="newPassword" />@if (bad('newPassword')) { <div class="field-error">{{ 'auth.passwordRules' | translate }}</div> }<div class="mt-1 text-muted" style="font-size:11px">{{ 'auth.passwordRules' | translate }}</div></div>
    <div><label class="field-label">{{ 'auth.confirmPassword' | translate }}</label><input type="password" class="form-control" autocomplete="new-password" formControlName="confirm" />@if (form.errors?.['mismatch'] && form.controls.confirm.touched) { <div class="field-error">{{ 'auth.passwordMismatch' | translate }}</div> }</div>
    <button type="submit" class="btn-hr primary justify-content-center" [disabled]="busy()">@if (busy()) { <i class="pi pi-spin pi-spinner"></i> }{{ 'common.submit' | translate }}</button></form>`,
})
export class ChangePasswordFormComponent {
  private fb = inject(FormBuilder); private api = inject(AuthApi); private toast = inject(ToastService); private store = inject(Store);
  done = output<void>(); busy = signal(false);
  form = this.fb.nonNullable.group({ currentPassword: ['', Validators.required], newPassword: ['', [Validators.required, strongPassword]], confirm: ['', Validators.required] }, { validators: sameAs('newPassword', 'confirm') });
  bad(n: 'currentPassword' | 'newPassword') { const c = this.form.controls[n]; return c.invalid && (c.touched || c.dirty); }
  async submit() {
    this.form.markAllAsTouched(); if (this.form.invalid) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue(); await firstValueFrom(this.api.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword } as any));
      this.toast.success('auth.changeDone'); tokens.clear(); this.store.dispatch(AuthActions.sessionEnded()); this.done.emit();
    } catch (e: any) { this.toast.error(e.message); } finally { this.busy.set(false); }
  }
}

/** Forced screen shown right after login when the backend says mustChangePassword. */
@Component({
  selector: 'app-change-password-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [TranslateModule, AuthLayoutComponent, ChangePasswordFormComponent],
  template: `<app-auth-layout [title]="'auth.changeTitle' | translate" [subtitle]="(must() ? 'auth.mustChange' : 'auth.passwordRules') | translate"><app-change-password-form /></app-auth-layout>`,
})
export class ChangePasswordPage { must = inject(Store).selectSignal(selectMustChangePassword); }
export default ChangePasswordPage;
