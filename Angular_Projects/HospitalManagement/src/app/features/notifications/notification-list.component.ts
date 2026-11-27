import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import type { AppNotification } from '../../core/models';
import { NotificationCategory, NotificationCenterService, categoryOf } from '../../core/services/notification-center.service';
import { EmptyStateComponent, PageHeaderComponent, SkeletonComponent } from '../../shared/components';
import { RelativeTimePipe } from '../../shared/pipes/pipes';

const CATS: (NotificationCategory | 'All')[] = ['All', 'Appointment', 'Lab', 'Billing', 'Prescription', 'Other'];

/** Notification list (Tailwind). Route data `unread: true` renders the "unread" view (same component, input-bound route data). Read state is local (no backend flag). */
@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [DatePipe, RouterLink, PageHeaderComponent, EmptyStateComponent, SkeletonComponent, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="unread() ? 'Unread notifications' : 'Notifications'" [subtitle]="center.scope() === 'all' ? 'All notifications (admin)' : 'Your notifications'">
      <span actions class="flex gap-2">
        <a [routerLink]="unread() ? '/notifications' : '/notifications/unread'" class="rounded-md border border-slate-300 px-3 py-2 text-sm no-underline dark:border-slate-600">{{ unread() ? 'Show all' : 'Unread only (' + center.unreadCount() + ')' }}</a>
        <button type="button" class="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600" (click)="center.markAllRead(feed() ?? [])">Mark all read</button>
        <button type="button" class="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600" (click)="center.refresh()">Refresh</button>
        @if (auth.can('notifications:admin')) { <a routerLink="send" class="rounded-md bg-brand-600 px-3 py-2 text-sm text-white no-underline">Send</a> }</span>
    </app-page-header>
    <div class="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Category">@for (c of cats; track c) { <button type="button" role="tab" [attr.aria-selected]="cat() === c" class="rounded-full border px-3 py-1 text-xs" [class]="cat() === c ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'" (click)="cat.set(c)">{{ c }}</button> }</div>
    @if (feed() === undefined) { <app-skeleton [rows]="4" /> }
    @else if (rows().length === 0) { <app-empty-state [title]="unread() ? 'All caught up' : 'No notifications'" description="Notifications are created by appointments, prescriptions, lab and billing events." icon="notifications_none" /> }
    @else {
      <ul class="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
        @for (n of rows(); track n.id) { <li><a [routerLink]="[n.id]" class="flex gap-3 p-4 no-underline hover:bg-slate-50 dark:hover:bg-slate-800">
          <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" [class]="read().has(n.id) ? 'bg-transparent' : 'bg-brand-600'" [attr.aria-label]="read().has(n.id) ? 'read' : 'unread'"></span>
          <span class="min-w-0 flex-1"><span class="flex justify-between gap-2"><span [class]="read().has(n.id) ? '' : 'font-semibold'">{{ n.subject }}</span><span class="shrink-0 text-xs text-slate-500" [title]="n.createdAt | date: 'medium'">{{ n.createdAt | relativeTime }}</span></span>
            <span class="block truncate text-sm text-slate-500">{{ n.message }}</span><span class="text-xs text-slate-400">{{ category(n) }} · {{ n.channel }} · {{ n.status }}@if (center.scope() === 'all') { · {{ n.recipientEmail }} }</span></span></a></li> }
      </ul> }`,
})
export class NotificationListComponent {
  readonly unread = input(false);
  protected readonly center = inject(NotificationCenterService);
  protected readonly auth = inject(AuthService);
  protected readonly cats = CATS;
  protected readonly cat = signal<NotificationCategory | 'All'>('All');
  protected readonly feed = toSignal(this.center.feed$);
  protected readonly read = toSignal(this.center.readIds$, { initialValue: new Set<number>() as ReadonlySet<number> });
  protected readonly rows = computed(() => (this.feed() ?? []).filter((n) => (this.cat() === 'All' || categoryOf(n.eventType) === this.cat()) && (!this.unread() || !this.read().has(n.id))));
  protected category(n: AppNotification) { return categoryOf(n.eventType); }
}
