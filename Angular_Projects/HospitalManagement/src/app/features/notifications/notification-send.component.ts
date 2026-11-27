import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotificationApiService } from '../../core/api/notification-api.service';
import { ApiError } from '../../core/models/api-error';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { PageHeaderComponent } from '../../shared/components';
import { PhoneValidatorDirective } from '../../shared/validators/template-validators';
import { emptyToNull } from '../../shared/utilities/helpers';

/** Admin "send notification" form – TEMPLATE-DRIVEN (ngModel + template reference variables, built-in validators). */
@Component({
  selector: 'app-notification-send',
  standalone: true,
  imports: [FormsModule, RouterLink, PageHeaderComponent, PhoneValidatorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-xl"><app-page-header title="Send notification" subtitle="Queued by the Notification Service (EMAIL)" />
      @if (error()) { <p role="alert" class="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{{ error() }}</p> }
      <form #f="ngForm" (ngSubmit)="send(f)" novalidate class="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900" aria-label="Send notification">
        <label class="block text-sm">Recipient e-mail<input class="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" name="recipientEmail" type="email" [(ngModel)]="model.recipientEmail" required email #em="ngModel" />
          @if (em.invalid && (em.touched || f.submitted)) { <span class="text-xs text-red-600">Enter a valid e-mail address</span> }</label>
        <label class="block text-sm">Phone (optional)<input class="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" name="recipientPhone" [(ngModel)]="model.recipientPhone" appPhone #ph="ngModel" />
          @if (ph.errors?.['phone'] && (ph.touched || f.submitted)) { <span class="text-xs text-red-600">{{ ph.errors?.['phone'] }}</span> }</label>
        <label class="block text-sm">Subject<input class="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" name="subject" [(ngModel)]="model.subject" required maxlength="200" #sj="ngModel" />
          @if (sj.invalid && (sj.touched || f.submitted)) { <span class="text-xs text-red-600">Subject is required</span> }</label>
        <label class="block text-sm">Message<textarea rows="4" class="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-slate-600" name="message" [(ngModel)]="model.message" required minlength="5" #ms="ngModel"></textarea>
          @if (ms.invalid && (ms.touched || f.submitted)) { <span class="text-xs text-red-600">Message is required (min 5 characters)</span> }</label>
        <div class="flex justify-end gap-2"><a routerLink="/notifications" class="rounded-md px-3 py-2 text-sm no-underline">Cancel</a><button type="submit" class="rounded-md bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-60" [disabled]="busy()">{{ busy() ? 'Sending…' : 'Send' }}</button></div>
      </form></div>`,
})
export class NotificationSendComponent {
  private readonly api = inject(NotificationApiService);
  private readonly notify = inject(NotificationService);
  private readonly center = inject(NotificationCenterService);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected model = { recipientEmail: '', recipientPhone: '', subject: '', message: '' };
  protected send(f: NgForm) {
    if (f.invalid) return;
    this.busy.set(true); this.error.set(null);
    this.api.send({ recipientEmail: this.model.recipientEmail.trim(), recipientPhone: emptyToNull(this.model.recipientPhone), subject: this.model.subject.trim(), message: this.model.message.trim() }).subscribe({
      next: () => { this.busy.set(false); this.notify.success('Notification queued'); f.resetForm(); this.center.refresh(); },
      error: (e: unknown) => { this.busy.set(false); this.error.set(ApiError.from(e).message); },
    });
  }
}
