import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { parseDate } from '../../shared/utilities/date';

/** Project progress = share of the planned schedule elapsed (the backend stores dates, not a %-complete figure). */
export function scheduleProgress(start?: string, end?: string, status?: string) {
  if (status === 'COMPLETED') return 100;
  if (!start || !end) return 0;
  const s = parseDate(start).getTime(); const e = parseDate(end).getTime(); const total = (e - s) / 86_400_000;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - s) / 86_400_000 / total) * 100)));
}

@Component({
  selector: 'app-progress-bar', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="d-flex align-items-center gap-2" style="min-width:110px" role="progressbar" [attr.aria-valuenow]="value()" aria-valuemin="0" aria-valuemax="100">
    <div class="flex-grow-1 rounded-pill" style="height:6px;background:var(--hr-surface-2)"><div class="rounded-pill" style="height:6px;background:var(--hr-primary);transition:width .3s" [style.width.%]="value()"></div></div><span class="text-muted" style="font-size:11px">{{ value() }}%</span></div>`,
})
export class ProgressBarComponent { value = input.required<number>(); }
