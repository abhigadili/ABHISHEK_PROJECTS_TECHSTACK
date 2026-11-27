import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of, startWith, switchMap, Subject } from 'rxjs';
import { NotificationService } from '../core/services/notification.service';
import { ServerDateTimePipe } from '../shared/pipes/pipes';

/** Dropdown panel with the latest notifications; reloaded whenever it is (re)opened. */
@Component({
  selector: 'app-notification-menu',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, ServerDateTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel-head">
      <strong>Notifications</strong>
      <button mat-button type="button" (click)="markAll()" [disabled]="store.unreadCount() === 0">Mark all read</button>
    </div>
    @for (n of items(); track n.id) {
      <button type="button" class="item" [class.unread]="!n.isRead" (click)="open(n.id)">
        <span class="title">{{ n.title }}</span>
        <span class="msg">{{ n.message }}</span>
        <small>{{ n.createdAt | serverDateTime }}</small>
      </button>
    } @empty {
      <p class="empty">You're all caught up.</p>
    }
    <a mat-button routerLink="/notifications" class="all">View all</a>
  `,
  styles: `
    :host { display: block; width: min(360px, 90vw); }
    .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px 0 16px; }
    .item { display: flex; flex-direction: column; text-align: left; width: 100%; background: none; border: 0; border-bottom: 1px solid var(--ems-border); padding: 10px 16px; cursor: pointer; font: inherit; }
    .item.unread { background: #eef3fe; }
    .title { font-weight: 500; }
    .msg { color: var(--ems-muted); font-size: 13px; }
    small { color: var(--ems-muted); }
    .empty { padding: 16px; color: var(--ems-muted); text-align: center; }
    .all { width: 100%; }
  `,
})
export class NotificationMenuComponent {
  protected readonly store = inject(NotificationService);
  private readonly reload$ = new Subject<void>();

  protected readonly items = toSignal(
    this.reload$.pipe(
      startWith(undefined),
      switchMap(() => this.store.recent(6).pipe(catchError(() => of([])))),
    ),
    { initialValue: [] },
  );

  protected open(id: number): void {
    this.store.markRead(id).subscribe(() => this.reload$.next());
  }

  protected markAll(): void {
    this.store.markAllRead().subscribe(() => this.reload$.next());
  }
}
