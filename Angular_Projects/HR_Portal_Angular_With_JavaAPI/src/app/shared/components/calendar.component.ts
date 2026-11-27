import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';
import { uiStore } from '../../state/zustand-style/ui.store';
import { addDays, isoDate, parseDate } from '../utilities/date';

export interface CalEvent { date: string; label: string; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'; title?: string }
const TONE: Record<string, string> = { primary: 'primary', success: 'success', warning: 'warning', danger: 'danger', info: 'info', neutral: 'neutral' };

/** Expand a [from, to] range into one CalEvent per day (used for leave ranges). */
export function expandRange(from: string, to: string, make: (d: string) => Omit<CalEvent, 'date'>): CalEvent[] {
  const out: CalEvent[] = []; let d = parseDate(from); const end = parseDate(to);
  for (let i = 0; i < 62 && d <= end; i++, d = addDays(d, 1)) out.push({ date: isoDate(d), ...make(isoDate(d)) });
  return out;
}

/** Month / week calendar grid. The parent supplies events and is told which visible range to load. */
@Component({
  selector: 'app-calendar', standalone: true, imports: [TranslateModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="hr-card overflow-hidden">
    <div class="d-flex flex-wrap align-items-center gap-2 p-2" style="border-bottom:1px solid var(--hr-border)">
      <button type="button" class="btn-hr outline icon" (click)="step(-1)" [attr.aria-label]="'common.previous' | translate"><i class="pi pi-chevron-left"></i></button>
      <button type="button" class="btn-hr outline icon" (click)="step(1)" [attr.aria-label]="'common.next' | translate"><i class="pi pi-chevron-right"></i></button>
      <button type="button" class="btn-hr outline sm" (click)="cur.set(today)">{{ 'common.today' | translate }}</button>
      <strong class="mx-2">{{ title() }}</strong>
      <div class="ms-auto d-flex gap-2 align-items-center"><ng-content />
        <button type="button" class="btn-hr sm" [class.primary]="mode() === 'month'" [class.outline]="mode() !== 'month'" (click)="mode.set('month')">{{ 'common.month' | translate }}</button>
        <button type="button" class="btn-hr sm" [class.primary]="mode() === 'week'" [class.outline]="mode() !== 'week'" (click)="mode.set('week')">{{ 'common.week' | translate }}</button></div></div>
    <div class="d-grid text-center text-muted" style="grid-template-columns:repeat(7,minmax(0,1fr));font-size:11px;font-weight:600">@for (h of head(); track $index) { <div class="py-1">{{ h }}</div> }</div>
    <div class="d-grid" style="grid-template-columns:repeat(7,minmax(0,1fr))">
      @for (d of days(); track d.iso) { <div role="gridcell" (click)="dayClick.emit(d.iso)" [style.min-height.px]="mode() === 'month' ? 92 : 200" [style.opacity]="d.other ? .5 : 1" style="border-top:1px solid var(--hr-border);border-right:1px solid var(--hr-border);padding:4px;overflow:hidden" [style.cursor]="'default'">
        <div class="mb-1 d-inline-flex align-items-center justify-content-center rounded-circle" [style.background]="d.today ? 'var(--hr-primary)' : ''" [style.color]="d.today ? 'rgb(var(--hr-primary-fg-rgb))' : ''" style="width:22px;height:22px;font-size:11px">{{ d.n }}</div>
        @for (e of d.events.slice(0, max()); track $index) { <div class="hr-badge d-block text-truncate mb-1" style="border-radius:4px;font-size:10.5px;line-height:16px" [class]="tone(e.tone)" [title]="e.title || ''">{{ e.label }}</div> }
        @if (d.events.length > max()) { <div class="text-muted" style="font-size:10px">+{{ d.events.length - max() }}</div> }</div> }</div></div>`,
})
export class CalendarComponent {
  private lang = inject(LanguageService);
  events = input<CalEvent[]>([]); initial = input<Date>(); rangeChange = output<{ from: string; to: string }>(); dayClick = output<string>();
  today = new Date(); cur = signal(new Date()); mode = signal<'month' | 'week'>('month');
  max = computed(() => (this.mode() === 'week' ? 12 : 3));
  start = computed(() => {
    const c = this.cur(); const s = this.mode() === 'month' ? new Date(c.getFullYear(), c.getMonth(), 1) : c; const wk = uiStore.state().weekStartsOn;
    return addDays(new Date(s.getFullYear(), s.getMonth(), s.getDate()), -((s.getDay() - wk + 7) % 7));
  });
  days = computed(() => {
    const by = new Map<string, CalEvent[]>(); this.events().forEach((e) => by.set(e.date, [...(by.get(e.date) ?? []), e]));
    const n = this.mode() === 'month' ? 42 : 7; const c = this.cur(); const t = isoDate(this.today);
    return Array.from({ length: n }, (_, i) => { const d = addDays(this.start(), i); const iso = isoDate(d); return { iso, n: d.getDate(), today: iso === t, other: this.mode() === 'month' && d.getMonth() !== c.getMonth(), events: by.get(iso) ?? [] }; });
  });
  head = computed(() => { this.lang.lang(); return Array.from({ length: 7 }, (_, i) => this.lang.weekday(addDays(this.start(), i))); });
  title = computed(() => { const d = this.days(); return this.mode() === 'month' ? this.lang.monthYear(this.cur()) : `${this.lang.date(parseDate(d[0].iso))} – ${this.lang.date(parseDate(d[6].iso))}`; });
  tone = (t?: string) => TONE[t ?? 'primary'];
  constructor() {
    effect(() => { const i = this.initial(); if (i) untracked(() => this.cur.set(i)); });
    effect(() => { const d = this.days(); const from = d[0].iso, to = d[d.length - 1].iso; untracked(() => this.rangeChange.emit({ from, to })); });
  }
  step(n: number) { const c = this.cur(); this.cur.set(this.mode() === 'month' ? new Date(c.getFullYear(), c.getMonth() + n, 1) : addDays(c, 7 * n)); }
}
