import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthLayoutComponent } from './auth-layout.component';

/** The backend has no public self-registration (POST /auth/register is HR / SUPER_ADMIN only), nor e-mail verification - so this is an informational page. */
@Component({
  selector: 'app-register-info-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, imports: [RouterLink, TranslateModule, AuthLayoutComponent],
  template: `<app-auth-layout [title]="'auth.registerDisabled' | translate"><div class="d-flex gap-2 rounded-2 p-3" style="font-size:13px;background:var(--hr-primary-soft)"><i class="pi pi-info-circle" style="color:var(--hr-primary);font-size:18px"></i>
    <div>{{ 'auth.registerInfo' | translate }}<div class="mt-2 text-muted">{{ 'auth.verifyInfo' | translate }}</div></div></div>
    <div class="mt-3 text-center" style="font-size:13px"><a routerLink="/login">{{ 'auth.backToLogin' | translate }}</a></div></app-auth-layout>`,
})
export class RegisterInfoPage {}
export default RegisterInfoPage;
