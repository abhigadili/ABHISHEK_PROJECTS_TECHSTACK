import { ChangeDetectionStrategy, Component, TemplateRef, contentChild, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { type LoadState, errorMessage } from '../../core/models/api-error';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-600">
      <mat-icon class="!h-10 !w-10 !text-4xl text-slate-400">{{ icon() }}</mat-icon>
      <h3 class="text-base font-semibold">{{ title() }}</h3>
      @if (description()) { <p class="max-w-md text-sm text-slate-500 dark:text-slate-400">{{ description() }}</p> }
      <div class="mt-2"><ng-content /></div>
    </div>`,
})
export class EmptyStateComponent {
  readonly title = input('Nothing here yet');
  readonly description = input('');
  readonly icon = input('inbox');
}

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="alert" class="flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <mat-icon class="!h-9 !w-9 !text-3xl">error_outline</mat-icon>
      <h3 class="text-base font-semibold">{{ title() }}</h3>
      <p class="max-w-lg text-sm opacity-90">{{ message() }}</p>
      <button type="button" class="mt-2 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40" (click)="retry.emit()">Try again</button>
    </div>`,
})
export class ErrorStateComponent {
  readonly error = input<unknown>(null);
  readonly title = input('Something went wrong');
  readonly retry = output<void>();
  protected message() { return errorMessage(this.error()); }
}

@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="space-y-3" aria-busy="true" aria-label="Loading">@for (i of rowsArray(); track i) { <div class="h-14 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700"></div> }</div>`,
})
export class SkeletonComponent {
  readonly rows = input(4);
  protected rowsArray() { return Array.from({ length: this.rows() }, (_, i) => i); }
}

/**
 * Generic data-state wrapper (generic component + ng-template + @switch + ngTemplateOutlet):
 *   <app-data-state [state]="state()" (retry)="reload()">
 *     <ng-template #loaded let-data> … {{ data.length }} … </ng-template>
 *   </app-data-state>
 * Handles loading → skeleton, error → ErrorState, loaded-but-empty → EmptyState, loaded → the projected template.
 */
@Component({
  selector: 'app-data-state',
  standalone: true,
  imports: [NgTemplateOutlet, EmptyStateComponent, ErrorStateComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state().status) {
      @case ('idle') { }
      @case ('loading') { <app-skeleton [rows]="rows()" /> }
      @case ('error') { <app-error-state [error]="errorOf()" (retry)="retry.emit()" /> }
      @default {
        @if (isEmpty()) { <app-empty-state [title]="emptyTitle()" [description]="emptyDescription()" /> }
        @else { <ng-container *ngTemplateOutlet="loadedTpl() ?? null; context: { $implicit: dataOf() }" /> }
      }
    }`,
})
export class DataStateComponent<T> {
  readonly state = input.required<LoadState<T>>();
  readonly emptyTitle = input('No results');
  readonly emptyDescription = input('');
  readonly rows = input(4);
  readonly retry = output<void>();
  protected readonly loadedTpl = contentChild<TemplateRef<unknown>>('loaded');
  protected dataOf(): T | null { const s = this.state(); return s.status === 'loaded' ? s.data : null; }
  protected errorOf(): unknown { const s = this.state(); return s.status === 'error' ? s.error : null; }
  protected isEmpty(): boolean {
    const d = this.dataOf();
    if (Array.isArray(d)) return d.length === 0;
    if (d && typeof d === 'object' && 'content' in d && Array.isArray((d as { content: unknown[] }).content)) return (d as { content: unknown[] }).content.length === 0;
    return false;
  }
}
