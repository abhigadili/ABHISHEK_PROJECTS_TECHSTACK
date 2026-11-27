import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { LanguageService } from '../../core/services/language.service';
import { PermissionService } from '../../core/services/permission.service';
import { uiStore } from '../../state/zustand-style/ui.store';
import { BadgeComponent, CardComponent, LoadingBlockComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { DetailComponent } from '../../shared/components/value.components';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { initials } from '../../shared/utilities/date';
import { ChangePasswordFormComponent } from '../authentication/change-password.form';

@Component({
  selector: 'app-profile-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, RouterLink, TranslateModule, CardComponent, BadgeComponent, DetailComponent, TabsComponent, TabDirective, OpViewComponent, OpButtonComponent, LoadingBlockComponent, ChangePasswordFormComponent],
  template: `@if (!u()) { <app-loading-block /> } @else {
  <div class="hr-card mb-3"><div class="hr-card-body d-flex align-items-center gap-3"><span class="d-inline-flex align-items-center justify-content-center rounded-circle" style="width:56px;height:56px;font-size:20px;font-weight:600;background:var(--hr-primary);color:rgb(var(--hr-primary-fg-rgb))">{{ ini() }}</span>
    <div><h1 class="page-title">{{ u().username }}</h1><div class="text-muted" style="font-size:13px">{{ u().email }} · {{ 'auth.lastLogin' | translate }}: {{ lang.dateTime(u().lastLoginAt) }}</div><div class="mt-1 d-flex gap-1 flex-wrap">@for (r of u().roles; track r) { <app-badge tone="primary">{{ r }}</app-badge> }</div></div></div></div>
  <app-tabs [initial]="tab()">
    <ng-template appTab="account" [label]="'auth.accountStatus' | translate"><app-card><app-detail [data]="u()" [hide]="['id', 'roles', 'permissions']" /><div class="mt-3"><div class="field-label">{{ 'auth.permissions' | translate }} ({{ u().permissions?.length ?? 0 }})</div><div class="d-flex gap-1 flex-wrap">@for (p of u().permissions; track p) { <app-badge>{{ p }}</app-badge> }</div></div></app-card></ng-template>
    <ng-template appTab="security" [label]="'auth.security' | translate"><div class="row g-3"><div class="col-lg-6"><app-card><h3 class="fs-6 mb-3">{{ 'auth.changeTitle' | translate }}</h3><app-change-password-form /></app-card></div>
      <div class="col-lg-6"><app-card><h3 class="fs-6">{{ 'auth.sessions' | translate }}</h3><p class="text-muted" style="font-size:13px">Access tokens last 30 minutes and refresh silently. Changing your password signs you out everywhere. {{ 'auth.verifyInfo' | translate }}</p></app-card></div></div></ng-template>
    <ng-template appTab="employee" [label]="'nav.employees' | translate" [hidden]="!perm.user()?.employeeId"><app-op-view op="employee.me" title="My employee profile"><span actions class="d-flex gap-2 align-items-center"><app-op-button op="employee.updateMyContact" [label]="'common.edit' | translate" [initial]="emp.data()?.contact" variant="primary" /><a [routerLink]="['/employees', perm.user()?.employeeId]" class="btn-hr outline sm">360° →</a></span></app-op-view></ng-template>
    <ng-template appTab="prefs" [label]="'common.settings' | translate"><app-card><div style="max-width:420px">
      <!-- template-driven preferences form -->
      <form #pf="ngForm"><label class="field-label">Currency</label><select class="form-select" name="currency" [ngModel]="lang.currency()" (ngModelChange)="lang.currency.set($event)">@for (c of currencies; track c) { <option>{{ c }}</option> }</select>
        <label class="field-label mt-3">Week starts on</label><select class="form-select" name="week" [ngModel]="week()" (ngModelChange)="setWeek($event)"><option [ngValue]="1">Monday</option><option [ngValue]="0">Sunday</option></select></form></div></app-card></ng-template>
  </app-tabs> }`,
})
export class ProfilePage {
  perm = inject(PermissionService); lang = inject(LanguageService); currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
  me = injectOp<any>('auth.me'); emp = injectOp<any>('employee.me', undefined, () => ({ enabled: !!this.perm.user()?.employeeId }));
  u = computed<any>(() => this.me.data() ?? this.perm.user()); ini = computed(() => initials(this.u()?.username));
  week = uiStore.select((s) => s.weekStartsOn); setWeek(v: 0 | 1) { uiStore.set({ weekStartsOn: Number(v) as 0 | 1 }); }
  tab = input<string>();
}
export default ProfilePage;
