import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Pagination for zero-based server pages (Tailwind/Bootstrap pages). */
@Component({
  selector: 'app-pager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <span class="text-slate-500">{{ total() }} {{ label() }} · page {{ page() + 1 }} of {{ pages() }}</span>
      <div class="flex gap-1">
        <button type="button" class="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-600" [disabled]="page() <= 0" (click)="pageChange.emit(page() - 1)">‹ Prev</button>
        <button type="button" class="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-600" [disabled]="page() + 1 >= pages()" (click)="pageChange.emit(page() + 1)">Next ›</button>
      </div>
    </nav>`,
})
export class PagerComponent {
  readonly page = input(0);
  readonly size = input(10);
  readonly total = input(0);
  readonly label = input('results');
  readonly pageChange = output<number>();
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
}
