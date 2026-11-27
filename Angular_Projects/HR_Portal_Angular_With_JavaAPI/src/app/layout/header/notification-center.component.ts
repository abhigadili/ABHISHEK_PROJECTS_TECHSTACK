import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { injectOpMutation } from '../../api/mutations/op-mutation';
import { PermissionService } from '../../core/services/permission.service';
import { SafeHtmlComponent } from '../../shared/components/safe-html.component';
import { EmptyStateComponent } from '../../shared/components/ui.components';
import { FmtDateTimePipe } from '../../shared/pipes/format.pipes';

@Component({
  selector: 'app-notification-center', standalone: true, imports: [MatMenuModule, TranslateModule, RouterLink, SafeHtmlComponent, EmptyStateComponent, FmtDateTimePipe], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (on()) {
    <button type="button" class="btn-hr ghost icon position-relative" [matMenuTriggerFor]="menu" (menuOpened)="opened.set(true)" [attr.aria-label]="'common.notifications' | translate"><i class="pi pi-bell" style="font-size:16px"></i>
      @if (n() > 0) { <span class="position-absolute rounded-pill px-1 text-white" style="top:0;right:0;min-width:16px;font-size:10px;line-height:16px;font-weight:700;background:var(--hr-danger)">{{ n() > 99 ? '99+' : n() }}</span> }</button>
    <mat-menu #menu="matMenu" class="notif-menu" xPosition="before">
      <div class="d-flex align-items-center justify-content-between px-3 py-2" style="border-bottom:1px solid var(--hr-border);width:360px;max-width:92vw" (click)="$event.stopPropagation()"><strong style="font-size:14px">{{ 'common.notifications' | translate }}</strong>
        <button type="button" class="btn-hr ghost sm" (click)="readAll.mutate({})"><i class="pi pi-check-circle"></i>{{ 'common.markAllRead' | translate }}</button></div>
      <div style="max-height:380px;overflow:auto;width:360px;max-width:92vw" (click)="$event.stopPropagation()">
        @for (x of items(); track x.id) {
          <button type="button" class="d-block w-100 border-0 bg-transparent px-3 py-2 text-start item" style="border-bottom:1px solid var(--hr-border)" (click)="!x.readAt && read.mutate({ path: { id: x.id } })">
            <div class="d-flex align-items-center gap-2" style="font-size:13px">@if (!x.readAt) { <span class="rounded-circle" style="width:8px;height:8px;background:var(--hr-primary)"></span> }<span [class.fw-semibold]="!x.readAt">{{ x.subject ?? x.type }}</span></div>
            <div class="text-muted" style="font-size:12px;max-height:34px;overflow:hidden"><app-safe-html [html]="x.body" /></div>
            <div class="text-muted" style="font-size:11px">{{ x.createdAt | fmtDateTime }}</div></button>
        } @empty { <app-empty-state hint=" " /> }</div>
      <div class="p-2 text-center"><a routerLink="/notifications" style="font-size:12px">{{ 'nav.notifications' | translate }} →</a></div>
    </mat-menu> }`,
  styles: [`.item:hover { background: var(--hr-surface-2); }`],
})
export class NotificationCenterComponent {
  private perm = inject(PermissionService);
  on = computed(() => this.perm.canCall('notification.unread')); opened = signal(false);
  private count = injectOp<{ unread: number }>('notification.unread', undefined, () => ({ refetchInterval: 30_000, staleTime: 15_000, enabled: this.on() }));
  private inbox = injectOp<{ content: any[] }>('notification.inbox', () => ({ query: { size: 8 } }), () => ({ enabled: this.opened() && this.on() }));
  n = computed(() => this.count.data()?.unread ?? 0); items = computed(() => this.inbox.data()?.content ?? []);
  read = injectOpMutation('notification.read', { successMessage: false });
  readAll = injectOpMutation('notification.readAll', { successMessage: 'common.done' });
}
