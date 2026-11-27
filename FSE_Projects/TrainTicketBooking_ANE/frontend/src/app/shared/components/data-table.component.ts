import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, computed, contentChild, input, output } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import type { PageMeta } from '../../core/models/models';
import { EmptyStateComponent, ErrorStateComponent, StatusChipComponent } from './ui.components';

export interface Column<T> { key: string; label: string; value?: (row: T) => unknown; kind?: 'text' | 'chip' | 'date' | 'datetime' | 'money'; sortable?: boolean; align?: 'end' }

/** Reusable server-side table: sort / page events go to the parent, which calls the backend. Row actions are projected with `<ng-template #actions let-row>`. */
@Component({
  selector: 'app-data-table',
  imports: [MatTableModule, MatSortModule, MatPaginatorModule, MatProgressBarModule, DatePipe, CurrencyPipe, NgTemplateOutlet, StatusChipComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tbl-wrap">
      @if (loading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading table" /> }
      @if (error()) { <app-error-state [message]="error()!" (retry)="retry.emit()" /> }
      @else {
      <div class="scroll">
        <table mat-table [dataSource]="rows()" matSort (matSortChange)="sortChange.emit($event)" [matSortActive]="sortActive()" [matSortDirection]="sortDir()">
          @for (c of columns(); track c.key) {
            <ng-container [matColumnDef]="c.key">
              <th mat-header-cell *matHeaderCellDef [mat-sort-header]="c.key" [disabled]="!c.sortable" [class.end]="c.align === 'end'">{{ c.label }}</th>
              <td mat-cell *matCellDef="let row" [class.end]="c.align === 'end'">
                @switch (c.kind ?? 'text') {
                  @case ('chip') { <app-status-chip [status]="str(c.value ? c.value(row) : row[c.key])" /> }
                  @case ('date') { {{ str(c.value ? c.value(row) : row[c.key]) | date: 'dd MMM yyyy' }} }
                  @case ('datetime') { {{ str(c.value ? c.value(row) : row[c.key]) | date: 'dd MMM yyyy, HH:mm' }} }
                  @case ('money') { {{ num(c.value ? c.value(row) : row[c.key]) | currency: 'INR' : 'symbol' : '1.2-2' }} }
                  @default { {{ c.value ? c.value(row) : row[c.key] }} }
                }
              </td>
            </ng-container>
          }
          @if (actions()) {
            <ng-container matColumnDef="__actions">
              <th mat-header-cell *matHeaderCellDef class="end"><span class="sr-only">Actions</span></th>
              <td mat-cell *matCellDef="let row" class="end"><ng-container *ngTemplateOutlet="actions()!; context: { $implicit: row }" /></td>
            </ng-container>
          }
          <tr mat-header-row *matHeaderRowDef="displayed(); sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: displayed()" [class.clickable]="clickable()" (click)="rowClick.emit(row)"></tr>
        </table>
      </div>
      @if (!loading() && !rows().length) { <app-empty-state [title]="emptyTitle()" [message]="emptyMessage()" /> }
      }
      @if (meta(); as m) {
        <mat-paginator [length]="m.total" [pageSize]="m.size" [pageIndex]="m.page" [pageSizeOptions]="[5, 10, 25, 50]" showFirstLastButtons (page)="pageChange.emit($event)" aria-label="Table pagination" />
      }
    </div>`,
  styles: [`.tbl-wrap{background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;overflow:hidden}.scroll{overflow-x:auto}.end{text-align:right}.clickable{cursor:pointer}.clickable:hover{background:var(--c-surface-2)}table{width:100%}`],
})
export class DataTableComponent<T extends object = Record<string, unknown>> {
  readonly columns = input.required<Column<T>[]>();
  readonly rows = input.required<T[]>();
  readonly meta = input<PageMeta | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly clickable = input(false);
  readonly sortActive = input('');
  readonly sortDir = input<'asc' | 'desc' | ''>('');
  readonly emptyTitle = input('No records found');
  readonly emptyMessage = input('Try changing the search or filters.');
  readonly pageChange = output<PageEvent>();
  readonly sortChange = output<Sort>();
  readonly rowClick = output<T>();
  readonly retry = output<void>();
  readonly actions = contentChild<TemplateRef<unknown>>('actions');
  readonly displayed = computed(() => [...this.columns().map((c) => c.key), ...(this.actions() ? ['__actions'] : [])]);
  str(v: unknown) { return v == null ? '' : String(v); }
  num(v: unknown) { return v == null ? null : Number(v); }
}
