import { ChangeDetectionStrategy, Component, TemplateRef, computed, contentChildren, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { OPERATION_MAP } from '../../api/client/api-client.service';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { ErrorStateComponent } from '../components/ui.components';
import { NgTemplateOutlet } from '@angular/common';
import { CellDirective, DataTableComponent, type Col } from './data-table.component';

/** Table bound to one GET operation. Handles PageResponse (server paging / sorting / search) and plain arrays (client side). */
@Component({
  selector: 'app-op-table', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent, ErrorStateComponent, TranslateModule, NgTemplateOutlet],
  template: `
  @if (!allowed()) { <div class="hr-card"><app-error-state [error]="notAuth" [retryable]="false" /></div> }
  @else if (fallback() && q.isError() && status() >= 500) { <ng-container [ngTemplateOutlet]="fallback()!" /> }
  @else {
    <app-data-table [id]="tableId() || op()" [rows]="rows()" [columns]="cols()" [loading]="q.isLoading()" [error]="q.isError() ? q.error() : undefined" (retry)="q.refetch()"
      [exportName]="exportName() || op()" [paging]="pagingInfo()" [serverSort]="paged()" [sort]="sort()" [searchable]="!!searchParam()" [selectable]="selectable()"
      [rowClickable]="rowClickable()" (rowClick)="rowClick.emit($event)" [rowActions]="rowActions()" [bulkActions]="bulkActions()" [emptyHint]="emptyHint()" [extraCells]="cells()"
      (pageChange)="page.set($event)" (sizeChange)="size.set($event); page.set(0)" (sortChange)="sort.set($event); page.set(0)" (searchChange)="search.set($event); page.set(0)" (selectionChange)="selectionChange($event)">
      <span filters class="contents"><ng-content select="[filters]" /></span>
      <span toolbar class="contents"><ng-content select="[toolbar]" /></span>
    </app-data-table>
  }`,
})
export class OpTableComponent<T extends Record<string, any> = any> {
  private perm = inject(PermissionService);
  op = input.required<string>(); path = input<Record<string, string | number>>(); query = input<Record<string, unknown>>();
  tableId = input(''); exportName = input(''); searchParam = input(''); sortable = input<string[] | undefined>();
  columns = input<Col<T>[] | undefined>(); pick = input<((d: any) => any[]) | undefined>(); enabled = input(true); defaultSort = input<string | undefined>();
  refetchInterval = input<number | false>(false); fallback = input<TemplateRef<any> | undefined>(); selectable = input(false); emptyHint = input('');
  rowActions = input<TemplateRef<any> | undefined>(); bulkActions = input<TemplateRef<any> | undefined>(); selected = signal<T[]>([]);
  cells = contentChildren(CellDirective); rowClickable = input(false); rowClick = output<T>();
  readonly notAuth = new Error('You are not authorised to view this.');

  paged = computed(() => OPERATION_MAP[this.op()].query.some((x) => x.name === 'page'));
  page = signal(0); size = signal(20); sort = signal<string | undefined>(undefined); search = signal('');
  private dsearch = toSignal(toObservable(this.search).pipe(debounceTime(350)), { initialValue: '' });
  allowed = computed(() => this.perm.canCall(this.op()));
  q = injectOp<any>(() => this.op(), () => ({
    path: this.path(),
    query: { ...(this.query() ?? {}), ...(this.paged() ? { page: this.page(), size: this.size(), sort: this.sort() ?? this.defaultSort() } : {}), ...(this.searchParam() && this.dsearch() ? { [this.searchParam()]: this.dsearch() } : {}) },
  }), () => ({ enabled: this.enabled() && this.allowed(), keepPrevious: true, refetchInterval: this.refetchInterval() }));
  status = computed(() => (this.q.error() as any)?.status ?? 0);
  rows = computed<T[]>(() => { const d = this.q.data(); const p = this.pick(); return p ? p(d) : Array.isArray(d) ? d : d?.content ?? []; });
  cols = computed(() => { const c = this.columns(); const s = this.sortable(); return c?.map((x) => (s && this.paged() ? { ...x, sortable: s.includes(x.key) } : x)); });
  pagingInfo = computed(() => { const d = this.q.data(); return this.paged() && d && !Array.isArray(d) ? { page: d.page ?? this.page(), size: d.size ?? this.size(), total: d.totalElements ?? this.rows().length, totalPages: d.totalPages ?? 1 } : undefined; });
  selectionChange(v: T[]) { this.selected.set(v); }
}
