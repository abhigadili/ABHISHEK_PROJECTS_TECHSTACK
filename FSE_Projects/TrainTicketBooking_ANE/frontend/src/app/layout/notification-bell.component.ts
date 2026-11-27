import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '@ngrx/store';
import { NotificationActions, selectLatestUnread, selectUnread } from '../store/notifications/notifications.store';

@Component({
  selector: 'app-notification-bell',
  imports: [AsyncPipe, DatePipe, RouterLink, MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" [attr.aria-label]="'Notifications, ' + ((unread$ | async) ?? 0) + ' unread'">
      <mat-icon [matBadge]="(unread$ | async) || null" matBadgeColor="warn" matBadgeSize="small" aria-hidden="false">notifications</mat-icon>
    </button>
    <mat-menu #menu="matMenu" class="bell-menu">
      @for (n of latest$ | async; track n.id) {
        <button mat-menu-item (click)="open(n.id)" [routerLink]="n.link?.startsWith('/bookings') ? '/app' + n.link : '/app/notifications'">
          <span class="b"><strong>{{ n.title }}</strong><small class="muted">{{ n.createdAt | date: 'dd MMM, HH:mm' }}</small></span>
        </button>
      } @empty { <div class="empty muted">You're all caught up.</div> }
      <button mat-menu-item routerLink="/app/notifications"><mat-icon>list</mat-icon>All notifications</button>
    </mat-menu>`,
  styles: [`.b{display:flex;flex-direction:column;line-height:1.3;white-space:normal;max-width:300px;padding:6px 0}.empty{padding:12px 16px}`],
})
export class NotificationBellComponent {
  private readonly store = inject(Store);
  readonly unread$ = this.store.select(selectUnread);
  readonly latest$ = this.store.select(selectLatestUnread);
  open(id: number) { this.store.dispatch(NotificationActions.markRead({ id })); }
}
