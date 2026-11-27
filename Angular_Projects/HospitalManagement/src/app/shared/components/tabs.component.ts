import { ChangeDetectionStrategy, Component, contentChildren, input, model, effect, computed } from '@angular/core';

/** One tab page: projected content only renders while it is active. */
@Component({
  selector: 'app-tab-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (active()) { <ng-content /> }`,
})
export class TabPanelComponent {
  readonly label = input.required<string>();
  readonly badge = input<string | number | null>(null);
  /** Set by the parent group (written through the group, read here). */
  active = model(false);
}

/**
 * Reusable tab group built with `contentChildren(TabPanelComponent)` (signal-based content queries) and a `model()` for
 * the selected index → two-way binding `[(selected)]` from the parent.
 */
@Component({
  selector: 'app-tab-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="tablist" class="mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
      @for (p of panels(); track $index) {
        <button type="button" role="tab" [attr.aria-selected]="$index === selected()" (click)="selected.set($index)"
          class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors"
          [class]="$index === selected() ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'">
          {{ p.label() }} @if (p.badge() !== null) { <span class="ml-1 rounded-full bg-slate-100 px-1.5 text-xs dark:bg-slate-700">{{ p.badge() }}</span> }
        </button>
      }
    </div>
    <ng-content />
  `,
})
export class TabGroupComponent {
  readonly panels = contentChildren(TabPanelComponent);
  readonly selected = model(0);
  protected readonly count = computed(() => this.panels().length);
  constructor() {
    effect(() => {
      const sel = this.selected();
      this.panels().forEach((p, i) => p.active.set(i === sel));
    }, { allowSignalWrites: true });
  }
}
