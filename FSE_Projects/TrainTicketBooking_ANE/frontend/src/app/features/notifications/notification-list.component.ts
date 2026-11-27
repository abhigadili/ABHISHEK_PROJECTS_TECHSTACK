import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { NotificationActions, selectAllNotifications, selectNotificationsError, selectNotificationsLoading, selectNotificationsMeta, selectUnread } from '../../store/notifications/notifications.store';
import type { NotificationItem } from '../../core/models/models';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../../shared/components/ui.components';

/** NgRx-backed list: dispatches actions, renders selectors (async pipe). */
@Component({
  selector: 'app-notification-list',
  imports: [AsyncPipe, DatePipe, FormsModule, MatButtonModule, MatExpansionModule, MatIconModule, MatPaginatorModule, MatSlideToggleModule, PageHeaderComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header title="Notifications" [subtitle]="((unread$ | async) ?? 0) + ' unread'">
      <mat-slide-toggle [ngModel]="unreadOnly()" (ngModelChange)="setUnreadOnly($event)">Unread only</mat-slide-toggle>
      <button mat-stroked-button (click)="markAll()" [disabled]="!(unread$ | async)"><mat-icon>done_all</mat-icon>Mark all read</button>
    </app-page-header>
    @if (error$ | async; as e) { <app-error-state [message]="e" (retry)="load()" /> }
    @else {
      <mat-accordion displayMode="flat">
        @for (n of items$ | async; track n.id) {
          <mat-expansion-panel (opened)="open(n)">
            <mat-expansion-panel-header>
              <mat-panel-title [class.unread]="!n.readAt"><mat-icon aria-hidden="true">{{ icon(n.type) }}</mat-icon>&nbsp;{{ n.title }}</mat-panel-title>
              <mat-panel-description>{{ n.createdAt | date: 'dd MMM yyyy, HH:mm' }}</mat-panel-description>
            </mat-expansion-panel-header>
            <p>{{ n.message }}</p>
            @if (target(n); as t) { <button mat-stroked-button (click)="go(t)">Open</button> }
          </mat-expansion-panel>
        } @empty { @if (!(loading$ | async)) { <app-empty-state icon="notifications_none" title="No notifications" message="You're all caught up." /> } }
      </mat-accordion>
      @if (meta$ | async; as m) { <mat-paginator [length]="m.total" [pageSize]="m.size" [pageIndex]="m.page" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" aria-label="Notification pages" /> }
    }`,
  styles: [`.unread{font-weight:700}.unread::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--c-primary);display:inline-block;margin-right:8px;align-self:center}`],
})
export class NotificationListComponent implements OnInit {
  private readonly store = inject(Store); private readonly router = inject(Router);
  readonly items$ = this.store.select(selectAllNotifications); readonly unread$ = this.store.select(selectUnread); readonly loading$ = this.store.select(selectNotificationsLoading);
  readonly meta$ = this.store.select(selectNotificationsMeta); readonly error$ = this.store.select(selectNotificationsError);
  readonly unreadOnly = signal(false); private page = 0; private size = 20;
  ngOnInit() { this.load(); }
  load() { this.store.dispatch(NotificationActions.load({ page: this.page, size: this.size, unreadOnly: this.unreadOnly() })); }
  setUnreadOnly(v: boolean) { this.unreadOnly.set(v); this.page = 0; this.load(); }
  onPage(e: PageEvent) { this.page = e.pageIndex; this.size = e.pageSize; this.load(); }
  markAll() { this.store.dispatch(NotificationActions.markAllRead()); }
  open(n: NotificationItem) { if (!n.readAt) this.store.dispatch(NotificationActions.markRead({ id: n.id })); }
  icon(t: string) { return t.includes('PAYMENT') ? 'payments' : t.includes('REFUND') ? 'currency_rupee' : t.includes('CANCEL') ? 'cancel' : t.includes('BOOKING') ? 'confirmation_number' : t.includes('SCHEDULE') ? 'schedule' : 'notifications'; }
  /** Backend links look like /bookings/12 or /search; map them to this app's routes. */
  target(n: NotificationItem) { const l = n.link; if (!l) return null; return l.startsWith('/bookings') ? `/app${l.replace(/\/payment$/, '/payment')}` : l === '/search' ? '/' : null; }
  go(t: string) { void this.router.navigateByUrl(t); }
}
