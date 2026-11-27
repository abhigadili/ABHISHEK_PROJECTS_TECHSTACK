import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Content projection with SLOTS: `<app-page-header title="…"><button actions>…</button></app-page-header>` (ng-content select). */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ title() }}</h1>
        @if (subtitle()) { <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{{ subtitle() }}</p> }
      </div>
      <div class="flex flex-wrap items-center gap-2"><ng-content select="[actions]" /></div>
    </div>
    <ng-content />
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
