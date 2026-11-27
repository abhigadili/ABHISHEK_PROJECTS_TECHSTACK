import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Inline banner used to state backend limitations honestly. */
@Component({
  selector: 'app-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="flex gap-2 rounded-lg border px-4 py-3 text-sm" [class]="tone() === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200'" role="note">
    <span aria-hidden="true">{{ tone() === 'warning' ? '⚠' : 'ℹ' }}</span><div><div class="font-semibold">{{ heading() }}</div><ng-content /></div></div>`,
})
export class NoticeComponent {
  readonly tone = input<'info' | 'warning'>('info');
  readonly heading = input('');
}
