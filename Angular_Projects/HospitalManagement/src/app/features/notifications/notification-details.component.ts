import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { NotificationApiService } from '../../core/api/notification-api.service';
import type { LoadState } from '../../core/models/api-error';
import type { AppNotification } from '../../core/models';
import { NotificationCenterService, categoryOf } from '../../core/services/notification-center.service';
import { DataStateComponent, PageHeaderComponent } from '../../shared/components';
import { toLoadState } from '../../shared/utilities/load-state';

/** Notification details; opening marks it read (local). Deep-links to the related module by event type. */
@Component({
  selector: 'app-notification-details',
  standalone: true,
  imports: [DatePipe, RouterLink, PageHeaderComponent, DataStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl"><app-page-header title="Notification" [subtitle]="'#' + id()"><a actions routerLink="/notifications" class="rounded-md border border-slate-300 px-3 py-2 text-sm no-underline dark:border-slate-600">Back</a></app-page-header>
      <app-data-state [state]="state()">
        <ng-template #loaded let-n>
          <article class="space-y-3 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"><h2 class="text-lg font-semibold">{{ n.subject }}</h2>
            <p class="whitespace-pre-line text-sm">{{ n.message }}</p>
            <dl class="grid gap-2 border-t pt-3 text-xs text-slate-500 sm:grid-cols-2"><div>Event: {{ n.eventType }}</div><div>Channel: {{ n.channel }} · {{ n.status }}</div><div>To: {{ n.recipientEmail }}</div><div>Created: {{ n.createdAt | date: 'medium' }}</div></dl>
            @if (target(n); as t) { <a [routerLink]="t" class="inline-block text-sm font-semibold text-brand-600">Open related {{ category(n).toLowerCase() }} →</a> }</article>
        </ng-template></app-data-state></div>`,
})
export class NotificationDetailsComponent {
  readonly id = input.required<string>();
  private readonly api = inject(NotificationApiService);
  private readonly center = inject(NotificationCenterService);
  protected readonly state = toSignal(toObservable(computed(() => Number(this.id()))).pipe(switchMap((id) => toLoadState(this.api.getById(id)))), { initialValue: { status: 'loading' } as LoadState<AppNotification> });
  constructor() { effect(() => { const s = this.state(); if (s.status === 'loaded') this.center.markRead(s.data.id); }); }
  protected category = (n: AppNotification) => categoryOf(n.eventType);
  protected target(n: AppNotification): string[] | null {
    const c = categoryOf(n.eventType); const ref = n.referenceId;
    return c === 'Appointment' ? (ref ? ['/appointments', ref] : ['/appointments']) : c === 'Lab' ? (ref ? ['/laboratory/requests', ref] : ['/laboratory/requests']) : c === 'Billing' ? (ref ? ['/billing/invoices', ref] : ['/billing']) : c === 'Prescription' ? (ref ? ['/prescriptions', ref] : ['/prescriptions']) : null;
  }
}
