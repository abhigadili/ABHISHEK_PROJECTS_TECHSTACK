import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AppError, PageMeta } from '../../core/models/api.models';
import { AppNotification } from '../../core/models/misc.models';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent, ErrorMessageComponent, PageHeaderComponent } from '../../shared/components/ui-basics';
import { PaginationComponent } from '../../shared/components/pagination.component';
import { ServerDateTimePipe } from '../../shared/pipes/pipes';

interface Result { items: AppNotification[]; meta: PageMeta | null; error: AppError | null }

/** Where a notification should take the user, based on what it refers to. */
function targetOf(n: AppNotification): string[] | null {
  switch (n.refType) {
    case 'employee': return n.refId ? ['/employees', String(n.refId)] : null;
    case 'leave_request': case 'leave': return n.refId ? ['/leaves', String(n.refId)] : ['/leaves'];
    case 'attendance': return n.refId ? ['/attendance', String(n.refId)] : ['/attendance'];
    default: return null;
  }
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, MatButtonModule, MatButtonToggleModule, MatIconModule, PageHeaderComponent, EmptyStateComponent, ErrorMessageComponent, PaginationComponent, ServerDateTimePipe],
  template: `
    <div class="page narrow">
      <app-page-header title="Notifications" [subtitle]="store.unreadCount() + ' unread'">
        <button pageActions mat-stroked-button type="button" (click)="markAll()" [disabled]="store.unreadCount() === 0" data-testid="mark-all-read"><mat-icon>done_all</mat-icon> Mark all as read</button>
      </app-page-header>
      <div class="panel">
        <div class="toolbar-row">
          <mat-button-toggle-group [value]="unreadOnly()" (change)="unreadOnly.set($event.value); page.set(1)" aria-label="Filter">
            <mat-button-toggle [value]="false">All</mat-button-toggle>
            <mat-button-toggle [value]="true" data-testid="unread-only">Unread</mat-button-toggle>
          </mat-button-toggle-group>
        </div>
        <app-error-message [error]="result().error" (retry)="reload()" />
        <ul class="list" data-testid="notification-list">
          @for (n of result().items; track n.id) {
            <li [ngClass]="{ unread: !n.isRead }">
              <button type="button" class="item" (click)="open(n)">
                <mat-icon>{{ n.isRead ? 'notifications_none' : 'notifications_active' }}</mat-icon>
                <span class="body"><strong>{{ n.title }}</strong><span>{{ n.message }}</span><small>{{ n.createdAt | serverDateTime }}</small></span>
              </button>
            </li>
          }
        </ul>
        @if (!result().items.length && !result().error) {
          <app-empty-state icon="notifications_off" title="No notifications" [message]="unreadOnly() ? 'No unread notifications.' : 'Nothing here yet.'" />
        }
        @if (result().meta; as m) { <app-pagination [meta]="m" (pageChange)="page.set($event.page); limit.set($event.limit)" /> }
      </div>
    </div>
  `,
  styles: `
    .narrow { max-width: 860px; }
    .list { list-style: none; margin: 0; padding: 0; }
    li { border-bottom: 1px solid var(--ems-border); }
    li.unread { background: #eef3fe; }
    .item { display: flex; gap: 14px; align-items: flex-start; width: 100%; text-align: left; background: none; border: 0; padding: 14px 8px; cursor: pointer; font: inherit; color: inherit; }
    .body { display: flex; flex-direction: column; gap: 2px; }
    small { color: var(--ems-muted); }
  `,
})
export class NotificationsComponent {
  protected readonly store = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly unreadOnly = signal(false);
  protected readonly page = signal(1);
  protected readonly limit = signal(10);
  protected readonly tick = signal(0);

  protected readonly result = toSignal(
    toObservable(computed(() => ({ unread: this.unreadOnly(), page: this.page(), limit: this.limit(), t: this.tick() }))).pipe(
      switchMap((q) =>
        this.store.list(q).pipe(
          map((p): Result => ({ items: p.items, meta: p.meta, error: null })),
          catchError((error: AppError) => of<Result>({ items: [], meta: null, error })),
          startWith<Result | null>(null),
        ),
      ),
      map((r) => r ?? { items: [], meta: null, error: null }),
    ),
    { initialValue: { items: [], meta: null, error: null } as Result },
  );

  protected reload(): void {
    this.tick.update((v) => v + 1);
  }

  protected open(n: AppNotification): void {
    const go = () => {
      const target = targetOf(n);
      if (target) void this.router.navigate(target);
      else this.tick.update((v) => v + 1);
    };
    if (n.isRead) go();
    else this.store.markRead(n.id).subscribe(go);
  }

  protected markAll(): void {
    this.store.markAllRead().subscribe(() => this.tick.update((n) => n + 1));
  }
}
