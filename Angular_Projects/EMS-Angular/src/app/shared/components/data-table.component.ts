import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  Directive,
  QueryList,
  TemplateRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { PageMeta, SortDirection } from '../../core/models/api.models';
import { APP_CONFIG } from '../../core/tokens/tokens';
import { EmptyStateComponent } from './ui-basics';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  /** Optional `sortKey` sent to the backend when it differs from the column key. */
  sortKey?: string;
  align?: 'start' | 'end' | 'center';
}

export interface CellContext<T> {
  $implicit: T;
  row: T;
  index: number;
}

/**
 * Marks an <ng-template> as the custom cell for a column:
 *   <ng-template appCell="status" let-row>…</ng-template>
 * The table finds these with @ContentChildren and renders them through ngTemplateOutlet.
 */
@Directive({ selector: 'ng-template[appCell]', standalone: true })
export class CellDirective {
  readonly appCell = input.required<string>();
  readonly template = inject(TemplateRef<CellContext<unknown>>);
}

/**
 * Generic table with optional server-side sorting + pagination (events go up, state comes down), custom cells via
 * content projection, an empty state, and row-click support. Used by every list screen.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [MatTableModule, MatSortModule, MatPaginatorModule, NgTemplateOutlet, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()" matSort [matSortActive]="sortActive()" [matSortDirection]="sortDirection()" (matSortChange)="onSort($event)" [attr.data-testid]="testId()">
        @for (col of columns(); track col.key) {
          <ng-container [matColumnDef]="col.key">
            <th mat-header-cell *matHeaderCellDef [mat-sort-header]="col.sortKey ?? col.key" [disabled]="!col.sortable" [style.text-align]="col.align ?? 'start'">{{ col.label }}</th>
            <td mat-cell *matCellDef="let row; let i = index" [style.text-align]="col.align ?? 'start'">
              @if (cellTemplates().get(col.key); as tpl) {
                <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row, row: row, index: i }" />
              } @else {
                {{ valueOf(row, col.key) }}
              }
            </td>
          </ng-container>
        }
        <tr mat-header-row *matHeaderRowDef="columnKeys()"></tr>
        <tr mat-row *matRowDef="let row; columns: columnKeys()" [class.clickable]="clickable()" (click)="rowClick.emit(row)" (keydown.enter)="rowClick.emit(row)" [attr.tabindex]="clickable() ? 0 : null"></tr>
      </table>
      @if (rows().length === 0) {
        <app-empty-state [icon]="emptyIcon()" [title]="emptyTitle()" [message]="emptyMessage()" />
      }
    </div>
    @if (meta(); as m) {
      <mat-paginator [length]="m.total" [pageIndex]="m.page - 1" [pageSize]="m.limit" [pageSizeOptions]="pageSizeOptions" (page)="onPage($event)" showFirstLastButtons />
    }
  `,
  styles: `
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    tr.clickable { cursor: pointer; }
    tr.clickable:hover { background: rgba(0, 0, 0, 0.04); }
  `,
})
export class DataTableComponent<T extends object> implements AfterContentInit {
  readonly pageSizeOptions = inject(APP_CONFIG).pageSizeOptions as number[];

  readonly columns = input.required<TableColumn[]>();
  readonly rows = input.required<T[]>();
  readonly meta = input<PageMeta | null>(null);
  readonly sortActive = input('');
  readonly sortDirection = input<SortDirection | ''>('');
  readonly clickable = input(false);
  readonly testId = input('data-table');
  readonly emptyIcon = input('inbox');
  readonly emptyTitle = input('No records found');
  readonly emptyMessage = input('Try adjusting your search or filters.');

  readonly sortChange = output<{ active: string; direction: SortDirection | '' }>();
  readonly pageChange = output<{ page: number; limit: number }>();
  readonly rowClick = output<T>();

  @ContentChildren(CellDirective) private cells!: QueryList<CellDirective>;
  protected readonly cellTemplates = signal(new Map<string, TemplateRef<CellContext<T>>>());
  protected readonly columnKeys = computed(() => this.columns().map((c) => c.key));

  ngAfterContentInit(): void {
    const build = () => this.cellTemplates.set(new Map(this.cells.map((c) => [c.appCell(), c.template as TemplateRef<CellContext<T>>])));
    build();
    this.cells.changes.subscribe(build);
  }

  protected valueOf(row: T, key: string): unknown {
    const v = (row as Record<string, unknown>)[key];
    return v === null || v === undefined || v === '' ? '—' : v;
  }

  protected onSort(e: Sort): void {
    this.sortChange.emit({ active: e.active, direction: e.direction });
  }

  protected onPage(e: PageEvent): void {
    this.pageChange.emit({ page: e.pageIndex + 1, limit: e.pageSize });
  }
}
