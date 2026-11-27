import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { APP } from '../../core/config/app.config';
import { LanguageSwitcherComponent, ThemeSwitcherComponent } from '../../layout/header/switchers.component';

@Component({
  selector: 'app-auth-layout', standalone: true, imports: [TranslateModule, LanguageSwitcherComponent, ThemeSwitcherComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="d-flex min-vh-100 flex-column flex-lg-row">
    <div class="d-none d-lg-flex col-lg-5 flex-column justify-content-between p-5 text-white" style="background:linear-gradient(145deg,#312e81,#4f46e5 60%,#0ea5a4)">
      <div class="d-flex align-items-center gap-2 fs-5 fw-semibold"><i class="pi pi-users" style="font-size:24px"></i>{{ app }}</div>
      <div><h2 class="mb-3" style="font-size:34px">{{ 'hr.dashboard.sub' | translate }}</h2><p class="opacity-75 mb-0" style="max-width:420px">Employees · Leave · Attendance · Payroll · Tax · Performance · Projects · Timesheets · Exit</p></div>
      <small class="opacity-50">Secured by JWT · role-based access control</small></div>
    <div class="flex-grow-1 d-flex flex-column"><div class="d-flex justify-content-end gap-2 p-3"><app-language-switcher /><app-theme-switcher /></div>
      <div class="flex-grow-1 d-flex align-items-center justify-content-center p-3"><div class="hr-card w-100 p-4 p-md-5" style="max-width:440px">
        <h1 class="fs-4 mb-1">{{ title() }}</h1>@if (subtitle()) { <p class="text-muted mb-4" style="font-size:13px">{{ subtitle() }}</p> }<ng-content /></div></div></div></div>`,
})
export class AuthLayoutComponent { title = input.required<string>(); subtitle = input(''); app = APP.name; }
