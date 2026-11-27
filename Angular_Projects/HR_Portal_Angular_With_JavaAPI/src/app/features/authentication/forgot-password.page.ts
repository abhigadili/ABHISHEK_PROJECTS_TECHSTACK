import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from '../../api/services';
import { ToastService } from '../../core/services/toast.service';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'app-forgot-password-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [ReactiveFormsModule, RouterLink, TranslateModule, AuthLayoutComponent],
  template: `<app-auth-layout [title]="'auth.forgotTitle' | translate" [subtitle]="'auth.forgotSub' | translate">
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="d-grid gap-3">
      <div><label class="field-label" for="email">{{ 'auth.email' | translate }}</label><input id="email" type="email" class="form-control" formControlName="email" />
        @if (form.controls.email.invalid && form.controls.email.touched) { <div class="field-error">{{ (form.controls.email.errors?.['email'] ? 'common.validation.email' : 'common.validation.required') | translate }}</div> }</div>
      <button type="submit" class="btn-hr primary justify-content-center py-2" [disabled]="busy()">@if (busy()) { <i class="pi pi-spin pi-spinner"></i> }{{ 'auth.sendReset' | translate }}</button></form>
    @if (sent()) { <div class="mt-3 rounded-2 p-3" style="font-size:12px;border:1px solid rgb(var(--hr-info-rgb)/.4);background:rgb(var(--hr-info-rgb)/.1)">{{ 'auth.resetSent' | translate }}
      @if (devToken()) { <div class="mt-2"><div>{{ 'auth.devToken' | translate }}</div><code style="word-break:break-all">{{ devToken() }}</code><div class="mt-2"><button type="button" class="btn-hr primary sm" (click)="goReset()">{{ 'auth.resetTitle' | translate }}</button></div></div> }</div> }
    <div class="mt-3 text-center" style="font-size:13px"><a routerLink="/login">{{ 'auth.backToLogin' | translate }}</a></div></app-auth-layout>`,
})
export class ForgotPasswordPage {
  private fb = inject(FormBuilder); private api = inject(AuthApi); private toast = inject(ToastService); private router = inject(Router);
  form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });
  busy = signal(false); sent = signal(false); devToken = signal<string | null>(null);
  async submit() {
    this.form.markAllAsTouched(); if (this.form.invalid) return;
    this.busy.set(true);
    try { const r: any = await firstValueFrom(this.api.forgotPassword({ email: this.form.getRawValue().email })); this.sent.set(true); this.devToken.set(r?.resetToken ?? null); this.toast.info('auth.resetSent'); }
    catch (e: any) { this.toast.error(e.message); } finally { this.busy.set(false); }
  }
  goReset() { this.router.navigate(['/reset-password'], { queryParams: { token: this.devToken() } }); }
}
export default ForgotPasswordPage;
