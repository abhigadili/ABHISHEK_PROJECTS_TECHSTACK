import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { injectOpMutation } from '../../api/mutations/op-mutation';
import { PermissionService } from '../../core/services/permission.service';
import { SafeHtmlComponent } from '../../shared/components/safe-html.component';
import { BadgeComponent, CardComponent, EmptyStateComponent, ErrorStateComponent, LoadingBlockComponent, PageHeaderComponent } from '../../shared/components/ui.components';
import { FmtDateTimePipe } from '../../shared/pipes/format.pipes';

const ROUTE: Record<string, string> = { LEAVE: '/leave', LEAVE_APPLICATION: '/leave', TIMESHEET: '/timesheets', PAYSLIP: '/payroll', PAYROLL: '/payroll', TAX: '/tax', DOCUMENT: '/documents', REVIEW: '/performance', PERFORMANCE: '/performance', RESIGNATION: '/exit', EXIT: '/exit', ATTENDANCE: '/attendance', PROJECT: '/projects', EMPLOYEE: '/employees' };

@Component({
  selector: 'app-notifications-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, RouterLink, TranslateModule, PageHeaderComponent, CardComponent, BadgeComponent, SafeHtmlComponent, EmptyStateComponent, ErrorStateComponent, LoadingBlockComponent, FmtDateTimePipe],
  template: `<app-page-header [title]="'hr.notifications.title' | translate" [subtitle]="'hr.notifications.sub' | translate">
    <select class="form-select" style="width:auto" [ngModel]="unreadOnly() ? 'u' : 'a'" (ngModelChange)="unreadOnly.set($event === 'u'); page.set(0)" aria-label="filter"><option value="a">{{ 'common.all' | translate }}</option><option value="u">{{ 'common.unread' | translate }}</option></select>
    <select class="form-select" style="width:auto" [ngModel]="type()" (ngModelChange)="type.set($event)" aria-label="type"><option value="">{{ 'common.all' | translate }} · type</option>@for (x of types(); track x) { <option>{{ x }}</option> }</select>
    <button type="button" class="btn-hr outline" (click)="readAll.mutate({})" [disabled]="readAll.isPending()"><i class="pi pi-check-circle"></i>{{ 'common.markAllRead' | translate }}</button></app-page-header>
  <app-card [flush]="true">
    @if (!allowed()) { <app-empty-state [title]="'common.notAuthorized' | translate" hint="Your account is not linked to an employee record, so it has no personal inbox." /> }
    @else if (q.isLoading()) { <app-loading-block /> } @else if (q.isError()) { <app-error-state [error]="q.error()" (retry)="q.refetch()" /> } @else if (!rows().length) { <app-empty-state /> }
    @else { @for (n of rows(); track n.id) { <div class="d-flex gap-3 p-3" style="border-bottom:1px solid var(--hr-border)" [style.background]="n.readAt ? '' : 'rgb(var(--hr-primary-rgb)/.06)'">
      <div class="mt-1"><span class="d-inline-block rounded-circle" style="width:8px;height:8px" [style.background]="n.readAt ? 'transparent' : 'var(--hr-primary)'"></span></div>
      <div class="flex-grow-1"><div class="d-flex gap-2 align-items-center"><strong style="font-size:14px">{{ n.subject ?? n.type }}</strong><app-badge>{{ n.type }}</app-badge><app-badge tone="info">{{ n.channel }}</app-badge></div>
        <div style="font-size:13px"><app-safe-html [html]="n.body" /></div>
        <div class="text-muted" style="font-size:11px">{{ n.createdAt | fmtDateTime }}@if (route(n)) { · <a [routerLink]="route(n)">{{ 'common.open' | translate }} →</a> }</div></div>
      @if (!n.readAt) { <button type="button" class="btn-hr outline sm" (click)="read.mutate({ path: { id: n.id } })">{{ 'common.read' | translate }}</button> } </div> }
      <div class="d-flex justify-content-between p-2"><button type="button" class="btn-hr ghost sm" [disabled]="page() === 0" (click)="page.set(page() - 1)">{{ 'common.previous' | translate }}</button>
        <span class="text-muted align-self-center" style="font-size:12px">{{ 'common.page' | translate }} {{ page() + 1 }} {{ 'common.of' | translate }} {{ pages() }}</span>
        <button type="button" class="btn-hr ghost sm" [disabled]="page() + 1 >= pages()" (click)="page.set(page() + 1)">{{ 'common.next' | translate }}</button></div> }
  </app-card>`,
})
export class NotificationsPage {
  private perm = inject(PermissionService);
  unreadOnly = signal(false); type = signal(''); page = signal(0); allowed = computed(() => this.perm.canCall('notification.inbox'));
  q = injectOp<any>('notification.inbox', () => ({ query: { unreadOnly: this.unreadOnly() || undefined, page: this.page(), size: 15 } }), () => ({ enabled: this.allowed(), keepPrevious: true }));
  read = injectOpMutation('notification.read', { successMessage: false }); readAll = injectOpMutation('notification.readAll', { successMessage: 'common.done' });
  rows = computed<any[]>(() => (this.q.data()?.content ?? []).filter((n: any) => !this.type() || n.type === this.type()));
  types = computed(() => [...new Set<string>((this.q.data()?.content ?? []).map((n: any) => n.type))]);
  pages = computed(() => Math.max(1, this.q.data()?.totalPages ?? 1));
  route = (n: any) => ROUTE[String(n.referenceType).toUpperCase()];
}
export default NotificationsPage;
