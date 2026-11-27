import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { Slot } from '../../core/models';
import { groupSlots } from '../utilities/helpers';

/** Slot grid (Tailwind) grouped by part of the day. `model()` = two-way selected start time; `computed` grouping. */
@Component({
  selector: 'app-slot-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (g of groups(); track g.period) {
      <div class="mb-4">
        <div class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{{ g.period }}</div>
        <div class="flex flex-wrap gap-2" role="listbox" [attr.aria-label]="g.period + ' slots'">
          @for (s of g.slots; track s.startTime) {
            <button type="button" role="option" [attr.aria-selected]="selected() === s.startTime" [disabled]="!s.available || readOnly()" (click)="selected.set(s.startTime)"
              class="min-w-[4.5rem] rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
              [class]="s.available ? (selected() === s.startTime ? 'border-brand-600 bg-brand-600 text-white' : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-brand-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200') : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-700 dark:bg-slate-800'">{{ s.startTime }}</button>
          }
        </div>
      </div>
    } @empty { <p class="text-sm text-slate-500">No slots on this date (non-working day, leave or fully elapsed).</p> }
    <div class="flex gap-4 text-xs text-slate-500"><span>■ available</span><span class="line-through">■ occupied</span></div>`,
})
export class SlotPickerComponent {
  readonly slots = input<readonly Slot[]>([]);
  readonly readOnly = input(false);
  readonly selected = model<string | null>(null);
  protected readonly groups = computed(() => groupSlots(this.slots()));
}
