import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { SeatCell, SeatMap } from '../../core/models/models';

/** Seat layout. Statuses come from the backend for the exact from->to segment; the user selection is a two-way `model()` signal. */
@Component({
  selector: 'app-seat-map', imports: [MatTabsModule, MatTooltipModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend" aria-hidden="true"><span><i class="s av"></i>Available</span><span><i class="s sel"></i>Selected</span><span><i class="s bk"></i>Booked for this journey</span><span><i class="s bl"></i>Blocked</span></div>
    <mat-tab-group animationDuration="0ms" [(selectedIndex)]="tab" aria-label="Coaches">
      @for (c of map().coaches; track c.id) {
        <mat-tab [label]="c.number + ' (' + free(c.seats) + ' free)'">
          <div class="grid" role="group" [attr.aria-label]="'Seats of coach ' + c.number">
            @for (s of c.seats; track s.id) {
              <button type="button" class="seat" [class.av]="s.status === 'AVAILABLE' && !isSel(s.id)" [class.sel]="isSel(s.id)" [class.bk]="s.status === 'BOOKED'" [class.bl]="s.status === 'BLOCKED'"
                [disabled]="s.status !== 'AVAILABLE' || (disabled() && !isSel(s.id))" [matTooltip]="s.type.replace('_', ' ').toLowerCase() + ' · ' + s.status.toLowerCase()"
                [attr.aria-pressed]="isSel(s.id)" [attr.aria-label]="'Seat ' + s.number + ', ' + s.type.replace('_', ' ').toLowerCase() + ', ' + s.status.toLowerCase()" (click)="toggle(s)">{{ s.number }}</button>
            }
          </div>
        </mat-tab>
      }
    </mat-tab-group>`,
  styles: [`.legend{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;font-size:.85rem}.legend i{display:inline-block;width:14px;height:14px;border-radius:3px;margin-right:6px;vertical-align:-2px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:8px;padding:16px 4px}
    .seat{height:42px;border-radius:8px;border:1px solid var(--c-border);font-weight:600;cursor:pointer;background:var(--c-surface);color:var(--c-text)}
    .av,.s.av{background:#e5f6e8;border-color:#7cc58a}.sel,.s.sel{background:var(--c-primary);color:#fff;border-color:var(--c-primary)}.bk,.s.bk{background:#f1d9d9;border-color:#d79a9a;color:#7a3a3a;cursor:not-allowed}.bl,.s.bl{background:#e3e3e3;color:#888;cursor:not-allowed;text-decoration:line-through}
    .seat:focus-visible{outline:3px solid #ffb300;outline-offset:2px}`],
})
export class SeatMapComponent {
  readonly map = input.required<SeatMap>();
  readonly selected = model<number[]>([]);
  readonly max = input(6);
  readonly tab = signal(0);
  readonly disabled = computed(() => this.selected().length >= this.max());
  isSel(id: number) { return this.selected().includes(id); }
  free(seats: SeatCell[]) { return seats.filter((s) => s.status === 'AVAILABLE').length; }
  toggle(s: SeatCell) {
    if (s.status !== 'AVAILABLE') return;
    this.selected.update((cur) => (cur.includes(s.id) ? cur.filter((x) => x !== s.id) : cur.length < this.max() ? [...cur, s.id] : cur));
  }
}
