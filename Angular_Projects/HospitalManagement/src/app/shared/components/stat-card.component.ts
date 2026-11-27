import { NgClass, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

/** Dashboard stat card (Tailwind). Signal inputs; `computed` tone classes; optional router link; "n/a" for figures the role may not read. */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, RouterLink, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #card>
      <div class="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-700 dark:bg-slate-800" [ngClass]="link() ? 'hover:border-brand-500 hover:shadow-md' : ''">
        <div class="rounded-lg p-3" [ngClass]="toneClass()"><mat-icon>{{ icon() }}</mat-icon></div>
        <div class="min-w-0">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ label() }}</div>
          @if (loading()) { <div class="mt-1.5 h-7 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700"></div> }
          @else if (unavailable()) { <div class="text-lg font-semibold text-slate-400">n/a</div> }
          @else { <div class="text-2xl font-bold leading-tight">{{ value() }}</div> }
          @if (hint()) { <div class="truncate text-xs text-slate-500 dark:text-slate-400">{{ hint() }}</div> }
        </div>
      </div>
    </ng-template>
    @if (link(); as l) { <a [routerLink]="l" class="block no-underline text-inherit"><ng-container *ngTemplateOutlet="card" /></a> } @else { <ng-container *ngTemplateOutlet="card" /> }
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input<string | number | null | undefined>('');
  readonly icon = input('analytics');
  readonly hint = input('');
  readonly link = input<string | null>(null);
  readonly loading = input(false);
  readonly unavailable = input(false);
  readonly tone = input<'brand' | 'green' | 'amber' | 'red' | 'violet'>('brand');
  protected readonly toneClass = computed(() => ({
    brand: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300', green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300', red: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300', violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  })[this.tone()]);
}
