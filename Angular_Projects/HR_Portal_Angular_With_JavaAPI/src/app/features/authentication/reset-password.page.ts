import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from '../../api/services';
import { ToastService } from '../../core/services/toast.service';
import { AuthLayoutComponent } from './auth-layout.component';
import { sameAs, strongPassword } from './password.validators';

@Component({
  selector: 'app-reset-password-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ReactiveFormsModule, RouterLink, TranslateModule, AuthLayoutComponent],
  template: `<app-auth-layout [title]="'auth.resetTitle' | translate" [subtitle]="'auth.passwordRules' | translate">
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="d-grid gap-3">
      <div><label class="field-label">{{ 'auth.resetToken' | translate }}</label><input class="form-control" formControlName="token" />@if (bad('token')) { <div class="field-error">{{ 'common.validation.required' | translate }}</div> }</div>
      <div><label class="field-label">{{ 'auth.newPassword' | translate }}</label><input type="password" class="form-control" autocomplete="new-password" formControlName="newPassword" />@if (bad('newPassword')) { <div class="field-error">{{ 'auth.passwordRules' | translate }}</div> }</div>
      <div><label class="field-label">{{ 'auth.confirmPassword' | translate }}</label><input type="password" class="form-control" autocomplete="new-password" formControlName="confirm" />@if (form.errors?.['mismatch'] && form.controls.confirm.touched) { <div class="field-error">{{ 'auth.passwordMismatch' | translate }}</div> }</div>
      <button type="submit" class="btn-hr primary justify-content-center py-2" [disabled]="busy()">@if (busy()) { <i class="pi pi-spin pi-spinner"></i> }{{ 'common.submit' | translate }}</button></form>
    <div class="mt-3 text-center" style="font-size:13px"><a routerLink="/login">{{ 'auth.backToLogin' | translate }}</a></div></app-auth-layout>`,
})
export class ResetPasswordPage {
  private fb = inject(FormBuilder); private api = inject(AuthApi); private toast = inject(ToastService); private router = inject(Router);
  token = input<string>();
  form = this.fb.nonNullable.group({ token: ['', Validators.required], newPassword: ['', [Validators.required, strongPassword]], confirm: ['', Validators.required] }, { validators: sameAs('newPassword', 'confirm') });
  busy = signal(false);
  ngOnInit() { if (this.token()) this.form.patchValue({ token: this.token()! }); }
  bad(n: 'token' | 'newPassword') { const c = this.form.controls[n]; return c.invalid && (c.touched || c.dirty); }
  async submit() {
    this.form.markAllAsTouched(); if (this.form.invalid) return;
    this.busy.set(true);
    try { const v = this.form.getRawValue(); await firstValueFrom(this.api.resetPassword({ token: v.token, newPassword: v.newPassword })); this.toast.success('auth.resetDone'); this.router.navigate(['/login'], { replaceUrl: true }); }
    catch (e: any) { this.toast.error(e.message); } finally { this.busy.set(false); }
  }
}
export default ResetPasswordPage;
