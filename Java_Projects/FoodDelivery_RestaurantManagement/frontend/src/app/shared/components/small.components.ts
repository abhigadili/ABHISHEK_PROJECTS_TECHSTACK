import { Component, Input, inject, Output, EventEmitter } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UI } from '../material';

const COLORS: Record<string, string> = {
  // order
  CREATED: 'gray', PAYMENT_PENDING: 'amber', PAYMENT_FAILED: 'red', CONFIRMED: 'blue', RESTAURANT_ACCEPTED: 'blue', PREPARING: 'purple', READY_FOR_PICKUP: 'purple',
  PICKED_UP: 'purple', OUT_FOR_DELIVERY: 'purple', DELIVERED: 'green', CANCELLED: 'red', REJECTED: 'red', REFUND_PENDING: 'amber', REFUNDED: 'gray',
  // payment / refund / generic
  SUCCESS: 'green', FAILED: 'red', PENDING: 'amber', INITIATED: 'amber', COMPLETED: 'green', ACTIVE: 'green', APPROVED: 'green', SUSPENDED: 'red', DEACTIVATED: 'gray',
  // delivery
  UNASSIGNED: 'amber', ASSIGNED: 'blue', ACCEPTED: 'blue', AVAILABLE: 'green', BUSY: 'amber', OFFLINE: 'gray',
  // kafka audit
  PROCESSED: 'green', DUPLICATE_IGNORED: 'gray', DEAD_LETTERED: 'red', REJECTED_INVALID: 'red', PUBLISHED: 'blue', UP: 'green', DOWN: 'red', VISIBLE: 'green', HIDDEN: 'red',
  SENT: 'green', ERROR: 'red', WARN: 'amber', INFO: 'blue', DEBUG: 'gray', HAS_DEAD_LETTERS: 'red', NO_ACTIVE_GROUP: 'amber', EMPTY: 'gray', STABLE: 'green', EMPTY_GROUP: 'gray'
};

@Component({ selector: 'app-status', imports: [UI], template: `<span class="chip" [class]="color">{{ label }}</span>` })
export class StatusChipComponent {
  @Input({ required: true }) set value(v: string | null | undefined) { this.v = v ?? ''; }
  private v = '';
  get color() { return COLORS[this.v] ?? 'gray'; }
  get label() { return this.v.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()); }
}

@Component({
  selector: 'app-page-header', imports: [UI],
  template: `<div class="row" style="margin-bottom:12px"><div><h1>{{ title }}</h1>@if (subtitle) {<div class="muted">{{ subtitle }}</div>}</div><span class="right row"><ng-content /></span></div>`
})
export class PageHeaderComponent { @Input({ required: true }) title = ''; @Input() subtitle = ''; }

@Component({ selector: 'app-empty', imports: [UI], template: `<div class="card muted" style="text-align:center;padding:32px"><mat-icon>{{ icon }}</mat-icon><div>{{ text }}</div><ng-content /></div>` })
export class EmptyComponent { @Input() text = 'Nothing here yet'; @Input() icon = 'inbox'; }

@Component({
  selector: 'app-json', imports: [UI],
  template: `<div style="position:relative"><button mat-icon-button style="position:absolute;right:4px;top:4px;color:#e5e7eb" (click)="copy()" matTooltip="Copy"><mat-icon>content_copy</mat-icon></button><pre class="json">{{ pretty }}</pre></div>`
})
export class JsonViewComponent {
  private snack = inject(MatSnackBar);
  pretty = '';
  @Input() set value(v: unknown) {
    if (typeof v === 'string') { try { this.pretty = JSON.stringify(JSON.parse(v), null, 2); } catch { this.pretty = v; } }
    else this.pretty = JSON.stringify(v, null, 2);
  }
  copy() { navigator.clipboard?.writeText(this.pretty); this.snack.open('Copied to clipboard', undefined, { duration: 1500 }); }
}

@Component({
  selector: 'app-stars', imports: [UI],
  template: `<span style="white-space:nowrap">@for (s of [1,2,3,4,5]; track s) {<mat-icon [style.color]="s <= rounded ? '#f59e0b' : '#d1d5db'" [style.cursor]="editable ? 'pointer' : 'default'" style="font-size:20px;height:20px;width:20px" (click)="pick(s)">star</mat-icon>}</span>`
})
export class StarsComponent {
  @Input() value = 0; @Input() editable = false; @Output() valueChange = new EventEmitter<number>();
  get rounded() { return Math.round(this.value); }
  pick(s: number) { if (this.editable) { this.value = s; this.valueChange.emit(s); } }
}
