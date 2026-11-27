import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Directive, TemplateRef, computed, contentChildren, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { LanguageService } from '../../core/services/language.service';
import { uiStore } from '../../state/zustand-style/ui.store';
import { humanize } from '../pipes/format.pipes';
import { exportCsv, exportPdf, exportXlsx } from '../utilities/exporters';
import { EmptyStateComponent, ErrorStateComponent } from '../components/ui.components';
import { ValueComponent } from '../components/value.components';

export interface Col<T = any> { key: string; label?: string; sortable?: boolean; hidden?: boolean; align?: 'left' | 'right' | 'center'; fmt?: (v: any, row: T) => string; width?: string }
export interface PagingInfo { page: number; size: number; total: number; totalPages: number }

/** Custom cell: `<ng-template appCell="status" let-row let-value="value">...</ng-template>` */
@Directive({ selector: 'ng-template[appCell]', standalone: true })
export class CellDirective { constructor(public tpl: TemplateRef<any>) {} appCell = input.required<string>(); }

const HIDE_AUTO = /^(id|version|createdBy|updatedBy|createdAt|updatedAt|tenantId|deleted|organizationId)$/;
const ISO_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/; const ISO_D = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Advanced data table (PrimeNG p-table shell): server-side or client-side paging / sorting / search, column picker (persisted),
 * row selection + bulk actions, CSV / Excel / PDF export, custom cell templates and row actions.
 */
@Component({
  selector: 'app-data-table', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TableModule, FormsModule, MatMenuModule, TranslateModule, NgTemplateOutlet, EmptyStateComponent, ErrorStateComponent, ValueComponent],
  template: `
  <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
    @if (searchable()) { <div class="position-relative" style="min-width:220px;flex:1;max-width:340px"><i class="pi pi-search position-absolute text-muted" style="left:10px;top:10px;font-size:12px"></i>
      <input class="form-control ps-4" type="search" [ngModel]="searchText()" (ngModelChange)="onSearch($event)" [placeholder]="'common.search' | translate" aria-label="Search" /></div> }
    <ng-content select="[filters]" />
    <div class="ms-auto d-flex flex-wrap align-items-center gap-2">
      <ng-content select="[toolbar]" />
      @if (selected().length && bulkActions()) { <span class="text-muted" style="font-size:12px">{{ selected().length }} {{ 'common.selected' | translate }}</span><ng-container [ngTemplateOutlet]="bulkActions()!" [ngTemplateOutletContext]="{ $implicit: selected() }" /> }
      <button type="button" class="btn-hr outline sm" [matMenuTriggerFor]="colMenu" aria-label="Columns"><i class="pi pi-table"></i>{{ 'common.columns' | translate }}</button>
      <mat-menu #colMenu="matMenu">@for (c of allCols(); track c.key) { <button mat-menu-item (click)="toggleCol(c.key); $event.stopPropagation()"><i class="pi" [class.pi-check-square]="!hiddenKeys().includes(c.key)" [class.pi-stop]="hiddenKeys().includes(c.key)"></i> {{ labelOf(c) }}</button> }</mat-menu>
      <button type="button" class="btn-hr outline sm" [matMenuTriggerFor]="expMenu" [disabled]="!rows().length"><i class="pi pi-download"></i>{{ 'common.export' | translate }}</button>
      <mat-menu #expMenu="matMenu"><button mat-menu-item (click)="doExport('csv')">CSV</button><button mat-menu-item (click)="doExport('xlsx')">Excel</button><button mat-menu-item (click)="doExport('pdf')">PDF</button></mat-menu>
    </div>
  </div>
  <div class="hr-card overflow-hidden">
    @if (error()) { <app-error-state [error]="error()" (retry)="retry.emit()" /> }
    @else if (loading() && !rows().length) { <div class="p-3">@for (i of [1,2,3,4,5]; track i) { <div class="skeleton mb-2" style="height:22px"></div> }</div> }
    @else if (!rows().length) { <app-empty-state [hint]="emptyHint()" /> }
    @else {
      <p-table [value]="view()" [(selection)]="selectedRows" (selectionChange)="onSel($event)" dataKey="id" [scrollable]="true" scrollHeight="68vh" [tableStyle]="{'min-width':'40rem'}" size="small" [rowHover]="true">
        <ng-template #header><tr>
          @if (selectable()) { <th style="width:42px"><p-tableHeaderCheckbox /></th> }
          @for (c of cols(); track c.key) { <th [style.text-align]="c.align || 'left'" [style.width]="c.width" [attr.aria-sort]="sortDir(c.key)" [style.cursor]="isSortable(c) ? 'pointer' : 'default'" (click)="toggleSort(c)">
            {{ labelOf(c) }}@if (sortDir(c.key); as d) { <i class="pi ms-1" [class.pi-sort-amount-up-alt]="d === 'ascending'" [class.pi-sort-amount-down]="d === 'descending'" style="font-size:11px"></i> }</th> }
          @if (rowActions()) { <th class="text-end" style="width:1%"></th> }
        </tr></ng-template>
        <ng-template #body let-row>
          <tr (click)="rowClick.emit(row)" [style.cursor]="rowClickable() ? 'pointer' : 'default'">
            @if (selectable()) { <td (click)="$event.stopPropagation()"><p-tableCheckbox [value]="row" /></td> }
            @for (c of cols(); track c.key) { <td [style.text-align]="c.align || 'left'">
              @if (cellTpl(c.key); as t) { <ng-container [ngTemplateOutlet]="t" [ngTemplateOutletContext]="{ $implicit: row, value: row[c.key] }" /> }
              @else if (c.fmt) { {{ c.fmt(row[c.key], row) }} }
              @else { <app-value [k]="c.key" [v]="row[c.key]" /> }</td> }
            @if (rowActions()) { <td class="text-end text-nowrap" (click)="$event.stopPropagation()"><ng-container [ngTemplateOutlet]="rowActions()!" [ngTemplateOutletContext]="{ $implicit: row }" /></td> }
          </tr>
        </ng-template>
      </p-table>
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2 border-top" style="border-top:1px solid var(--hr-border)">
        <span class="text-muted" style="font-size:12px">{{ rangeText() }}</span>
        <div class="d-flex align-items-center gap-2">
          <label class="text-muted m-0" style="font-size:12px">{{ 'common.rowsPerPage' | translate }}
            <select class="form-select d-inline-block ms-1" style="width:auto;padding:2px 24px 2px 8px" [ngModel]="pageSize()" (ngModelChange)="onSize($event)" aria-label="Rows per page">@for (s of [10, 20, 50, 100]; track s) { <option [ngValue]="s">{{ s }}</option> }</select></label>
          <button type="button" class="btn-hr outline sm icon" [disabled]="pageNo() <= 0" (click)="goto(pageNo() - 1)" aria-label="Previous"><i class="pi pi-chevron-left"></i></button>
          <span style="font-size:12px">{{ pageNo() + 1 }} {{ 'common.of' | translate }} {{ totalPages() }}</span>
          <button type="button" class="btn-hr outline sm icon" [disabled]="pageNo() + 1 >= totalPages()" (click)="goto(pageNo() + 1)" aria-label="Next"><i class="pi pi-chevron-right"></i></button>
        </div>
      </div>
    }
  </div>`,
})
export class DataTableComponent<T extends Record<string, any> = any> {
  private lang = inject(LanguageService);
  id = input.required<string>(); rows = input<T[]>([]); columns = input<Col<T>[] | undefined>();
  loading = input(false); error = input<unknown>(); emptyHint = input(''); exportName = input('export');
  /** server paging info (omit for client-side paging) */ paging = input<PagingInfo | undefined>();
  /** server sorting enabled (otherwise client-side sorting) */ serverSort = input(false); sort = input<string | undefined>();
  searchable = input(false); selectable = input(false); rowClickable = input(false);
  rowActions = input<TemplateRef<any> | undefined>(); bulkActions = input<TemplateRef<any> | undefined>();
  pageChange = output<number>(); sizeChange = output<number>(); sortChange = output<string | undefined>(); searchChange = output<string>(); retry = output<void>(); selectionChange = output<T[]>(); rowClick = output<T>();
  private cells = contentChildren(CellDirective); extraCells = input<readonly CellDirective[]>([]);

  searchText = signal(''); selected = signal<T[]>([]); selectedRows: T[] = [];
  private clientPage = signal(0); private clientSize = signal(uiStore.get().pageSize); private clientSort = signal<string | undefined>(undefined);

  allCols = computed<Col<T>[]>(() => {
    const given = this.columns(); if (given) return given;
    const first = this.rows()[0]; if (!first) return [];
    return Object.keys(first).filter((k) => !HIDE_AUTO.test(k) && !(first[k] && typeof first[k] === 'object')).map((k) => ({ key: k }));
  });
  hiddenKeys = computed(() => { const h = uiStore.state().hiddenColumns[this.id()]; return h ?? this.allCols().filter((c, i) => c.hidden || (!this.columns() && i >= 10)).map((c) => c.key); });
  cols = computed(() => this.allCols().filter((c) => !this.hiddenKeys().includes(c.key)));
  pageNo = computed(() => this.paging()?.page ?? this.clientPage());
  pageSize = computed(() => this.paging()?.size ?? this.clientSize());
  totalRows = computed(() => this.paging()?.total ?? this.rows().length);
  totalPages = computed(() => Math.max(1, this.paging()?.totalPages ?? Math.ceil(this.rows().length / this.clientSize())));
  activeSort = computed(() => (this.serverSort() ? this.sort() : this.clientSort()));
  sorted = computed(() => {
    if (this.serverSort()) return this.rows();
    const s = this.clientSort(); if (!s) return this.rows();
    const [k, dir] = s.split(','); const m = dir === 'desc' ? -1 : 1;
    return [...this.rows()].sort((a: any, b: any) => (a[k] == null ? 1 : b[k] == null ? -1 : (typeof a[k] === 'number' ? a[k] - b[k] : String(a[k]).localeCompare(String(b[k]), this.lang.locale(), { numeric: true }))) * m);
  });
  view = computed(() => (this.paging() ? this.sorted() : this.sorted().slice(this.clientPage() * this.clientSize(), (this.clientPage() + 1) * this.clientSize())));
  rangeText = computed(() => { const t = this.totalRows(); if (!t) return ''; const from = this.pageNo() * this.pageSize() + 1; return `${from}–${Math.min(t, from + this.view().length - 1)} / ${t}`; });
  constructor() { effect(() => { this.rows(); untracked(() => { this.selectedRows = []; this.selected.set([]); if (!this.paging()) this.clientPage.update((p) => Math.min(p, Math.max(0, Math.ceil(this.rows().length / this.clientSize()) - 1))); }); }); }

  cellTpl(key: string) { return this.cells().find((c) => c.appCell() === key)?.tpl ?? this.extraCells().find((c) => c.appCell() === key)?.tpl; }
  labelOf(c: Col<T>) { return c.label ?? this.lang_label(c.key); }
  private lang_label(k: string) { this.lang.lang(); return humanize(k); }
  isSortable(c: Col<T>) { return this.serverSort() ? c.sortable === true : c.sortable !== false; }
  sortDir(k: string): 'ascending' | 'descending' | null { const s = this.activeSort(); if (!s) return null; const [f, d] = s.split(','); return f === k ? (d === 'desc' ? 'descending' : 'ascending') : null; }
  toggleSort(c: Col<T>) {
    if (!this.isSortable(c)) return;
    const cur = this.activeSort(); const [f, d] = (cur ?? '').split(',');
    const next = f === c.key ? (d === 'desc' ? undefined : `${c.key},desc`) : `${c.key},asc`;
    if (this.serverSort()) this.sortChange.emit(next); else { this.clientSort.set(next); this.clientPage.set(0); }
  }
  onSearch(v: string) { this.searchText.set(v); this.searchChange.emit(v); }
  goto(p: number) { if (this.paging()) this.pageChange.emit(p); else this.clientPage.set(p); }
  onSize(s: number) { uiStore.set({ pageSize: s }); if (this.paging()) this.sizeChange.emit(s); else { this.clientSize.set(s); this.clientPage.set(0); } }
  onSel(v: T[]) { this.selected.set(v); this.selectionChange.emit(v); }
  toggleCol(k: string) { const h = this.hiddenKeys(); uiStore.set((s) => ({ hiddenColumns: { ...s.hiddenColumns, [this.id()]: h.includes(k) ? h.filter((x) => x !== k) : [...h, k] } })); }

  private text(k: string, v: any): string {
    if (v == null || v === '') return '';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (typeof v === 'string') return ISO_DT.test(v) ? this.lang.dateTime(v) : ISO_D.test(v) ? this.lang.date(v) : v;
    if (Array.isArray(v)) return v.every((x) => typeof x !== 'object') ? v.join(', ') : `${v.length} item(s)`;
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  async doExport(fmt: 'csv' | 'xlsx' | 'pdf') {
    const cols = this.cols(); const headers = cols.map((c) => this.labelOf(c));
    const rows = this.sorted().map((r) => cols.map((c) => (c.fmt ? c.fmt(r[c.key], r) : this.text(c.key, r[c.key]))));
    if (fmt === 'csv') exportCsv(this.exportName(), headers, rows); else if (fmt === 'xlsx') await exportXlsx(this.exportName(), headers, rows); else await exportPdf(this.exportName(), headers, rows);
  }
}
