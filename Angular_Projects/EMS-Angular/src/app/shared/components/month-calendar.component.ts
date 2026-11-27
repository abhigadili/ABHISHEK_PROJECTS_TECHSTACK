import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, computed, contentChild, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { toIsoDate } from '../utils/dates';

export interface CalendarDayContext {
  $implicit: string; // ISO date
  date: string;
  day: number;
  weekend: boolean;
  today: boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Month grid. The *content of each day* is supplied by the parent through a projected template
 * (`<ng-template let-day>`) and rendered with ngTemplateOutlet — one grid serves attendance, leave and holidays.
 */
@Component({
  selector: 'app-month-calendar',
  standalone: true,
  imports: [NgTemplateOutlet, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cal-head">
      <button mat-icon-button type="button" aria-label="Previous month" (click)="shift(-1)"><mat-icon>chevron_left</mat-icon></button>
      <h3 data-testid="calendar-title">{{ title() }}</h3>
      <button mat-icon-button type="button" aria-label="Next month" (click)="shift(1)"><mat-icon>chevron_right</mat-icon></button>
    </div>
    <div class="grid" role="grid">
      @for (d of weekdays; track d) {
        <div class="dow" role="columnheader">{{ d }}</div>
      }
      @for (cell of cells(); track $index) {
        @if (cell) {
          <div class="cell" [class.weekend]="cell.weekend" [class.today]="cell.today" role="gridcell">
            <span class="num">{{ cell.day }}</span>
            @if (dayTemplate(); as tpl) {
              <ng-container *ngTemplateOutlet="tpl; context: cell" />
            }
          </div>
        } @else {
          <div class="cell blank"></div>
        }
      }
    </div>
  `,
  styles: `
    .cal-head { display: flex; align-items: center; justify-content: center; gap: 8px; }
    h3 { margin: 0; min-width: 160px; text-align: center; font-weight: 500; }
    .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; margin-top: 8px; }
    .dow { text-align: center; font-size: 12px; color: var(--ems-muted); padding: 4px 0; }
    .cell { min-height: 82px; border: 1px solid var(--ems-border); border-radius: 6px; padding: 4px 6px; font-size: 12px; overflow: hidden; }
    .cell.weekend { background: var(--ems-surface-alt); }
    .cell.today { border-color: var(--ems-primary); box-shadow: inset 0 0 0 1px var(--ems-primary); }
    .cell.blank { border: none; background: transparent; }
    .num { font-weight: 500; display: block; margin-bottom: 2px; }
    @media (max-width: 600px) { .cell { min-height: 56px; padding: 2px; font-size: 10px; } }
  `,
})
export class MonthCalendarComponent {
  readonly year = input.required<number>();
  readonly month = input.required<number>(); // 1-12
  readonly monthChange = output<{ year: number; month: number }>();
  readonly dayTemplate = contentChild<TemplateRef<CalendarDayContext>>(TemplateRef);

  protected readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  protected readonly title = computed(() => `${MONTHS[this.month() - 1]} ${this.year()}`);

  protected readonly cells = computed<(CalendarDayContext | null)[]>(() => {
    const y = this.year();
    const m = this.month();
    const lead = new Date(y, m - 1, 1).getDay();
    const count = new Date(y, m, 0).getDate();
    const today = toIsoDate(new Date());
    const out: (CalendarDayContext | null)[] = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= count; day++) {
      const date = toIsoDate(new Date(y, m - 1, day));
      const dow = new Date(y, m - 1, day).getDay();
      out.push({ $implicit: date, date, day, weekend: dow === 0 || dow === 6, today: date === today });
    }
    return out;
  });

  protected shift(delta: number): void {
    const d = new Date(this.year(), this.month() - 1 + delta, 1);
    this.monthChange.emit({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
}
