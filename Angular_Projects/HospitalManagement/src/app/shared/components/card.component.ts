import { ChangeDetectionStrategy, Component, contentChild, Directive, input } from '@angular/core';

/** Marker directive for the card footer: lets the card detect (contentChild) whether a footer was projected. */
@Directive({ selector: '[appCardFooter]', standalone: true })
export class CardFooterDirective {}

/** Reusable card with content projection: default slot, `[card-title]`, `[card-footer]`; footer area renders only when projected (contentChild). */
@Component({
  selector: 'app-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800" [class]="padded() ? 'p-5' : ''">
      <header class="mb-3 flex items-center justify-between gap-2 empty:hidden"><ng-content select="[card-title]" /></header>
      <ng-content />
      @if (footer()) { <footer class="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700"><ng-content select="[appCardFooter]" /></footer> }
    </section>`,
})
export class CardComponent {
  readonly padded = input(true);
  protected readonly footer = contentChild(CardFooterDirective);
}
