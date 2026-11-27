import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { PageMeta } from '../../core/models/api.models';
import { DataTableComponent, TableColumn } from './data-table.component';
import { SearchBoxComponent } from './search-box.component';

/**
 * Searchable, paginated table over an in-memory array (reports return complete result sets, not pages).
 * Composition: SearchBox + DataTable; filtering/paging are computed() signals over the input rows.
 */
@Component({
  selector: 'app-client-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, SearchBoxComponent],
  template: `
    <div class="toolbar-row"><app-search-box label="Search in results" (searchChange)="query.set($event); page.set(1)" /></div>
    <app-data-table [testId]="testId()" [columns]="columns()" [rows]="pageRows()" [meta]="meta()" [emptyTitle]="emptyTitle()" emptyIcon="table_chart" (pageChange)="page.set($event.page); limit.set($event.limit)" />
  `,
})
export class ClientTableComponent {
  readonly columns = input.required<TableColumn[]>();
  readonly rows = input.required<Record<string, unknown>[]>();
  readonly testId = input('client-table');
  readonly emptyTitle = input('No data for the selected filters');

  protected readonly query = signal('');
  protected readonly page = signal(1);
  protected readonly limit = signal(10);

  private readonly filtered = computed(() => {
    const q = this.query().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter((r) => Object.values(r).some((v) => v !== null && String(v).toLowerCase().includes(q)));
  });

  protected readonly pageRows = computed(() => {
    const start = (this.page() - 1) * this.limit();
    return this.filtered().slice(start, start + this.limit());
  });

  protected readonly meta = computed<PageMeta>(() => ({
    page: this.page(), limit: this.limit(), total: this.filtered().length, totalPages: Math.ceil(this.filtered().length / this.limit()) || 0,
  }));
}

