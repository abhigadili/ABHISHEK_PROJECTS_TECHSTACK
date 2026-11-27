import { Component, ContentChild, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { UI } from '../material';
import { MoneyPipe, TimeAgoPipe } from '../pipes/pipes';
import { StatusChipComponent } from './small.components';
import { DatePipe, NgTemplateOutlet } from '@angular/common';

export interface Col { key: string; label: string; type?: 'text' | 'money' | 'date' | 'chip' | 'mono' | 'bool' | 'ago'; }

/** Reusable server-paginated table: columns are config, optional row-actions template, click-through. */
@Component({
  selector: 'app-table',
  imports: [UI, MoneyPipe, TimeAgoPipe, StatusChipComponent, DatePipe, NgTemplateOutlet],
  template: `
    <div class="scroll-x">
      <table class="simple">
        <thead><tr>@for (c of cols; track c.key) {<th>{{ c.label }}</th>}@if (actions) {<th></th>}</tr></thead>
        <tbody>
          @for (r of rows; track $index) {
            <tr [style.cursor]="rowClickable ? 'pointer' : 'default'" (click)="rowClick.emit(r)">
              @for (c of cols; track c.key) {
                <td>
                  @switch (c.type) {
                    @case ('money') { {{ get(r, c.key) | money }} }
                    @case ('date') { {{ get(r, c.key) | date: 'dd MMM y, HH:mm:ss' }} }
                    @case ('ago') { <span [title]="get(r, c.key)">{{ get(r, c.key) | timeAgo }}</span> }
                    @case ('chip') { <app-status [value]="get(r, c.key)" /> }
                    @case ('mono') { <span class="mono">{{ get(r, c.key) }}</span> }
                    @case ('bool') { <mat-icon [class]="get(r, c.key) ? 'ok' : 'muted'">{{ get(r, c.key) ? 'check_circle' : 'remove_circle_outline' }}</mat-icon> }
                    @default { {{ get(r, c.key) }} }
                  }
                </td>
              }
              @if (actions) {<td (click)="$event.stopPropagation()" style="white-space:nowrap"><ng-container *ngTemplateOutlet="actions; context: { $implicit: r }" /></td>}
            </tr>
          } @empty { <tr><td [attr.colspan]="cols.length + (actions ? 1 : 0)" class="muted" style="text-align:center;padding:24px">No records</td></tr> }
        </tbody>
      </table>
    </div>
    @if (total > size) { <mat-paginator [length]="total" [pageSize]="size" [pageIndex]="page" [hidePageSize]="true" (page)="pageChange.emit($event)" /> }
  `
})
export class DataTableComponent {
  @Input({ required: true }) cols: Col[] = [];
  @Input() rows: any[] = [];
  @Input() total = 0; @Input() page = 0; @Input() size = 20;
  @Input() rowClickable = false;
  @Output() pageChange = new EventEmitter<PageEvent>();
  @Output() rowClick = new EventEmitter<any>();
  @ContentChild('actions') actions?: TemplateRef<unknown>;
  get(r: any, path: string): any { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), r); }
}
