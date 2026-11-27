import { useMemo, useState, type ReactNode } from 'react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState, type VisibilityState, type RowSelectionState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download, Search } from 'lucide-react';
import { Menu, MenuItem, Checkbox, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Skeleton } from '@/components/ui/skeleton';
import { Value } from '@/components/common/values';
import { humanize } from '@/components/forms/SchemaFields';
import { refKindForField, useRefList, type RefKind } from '@/components/op/refs';
import { useEmployeeLookup } from '@/components/op/employees';
import { useUiStore } from '@/store/zustand/uiStore';
// export libraries (SheetJS, jsPDF) are heavy - loaded only when the user exports
const loadExporters = () => import('@/utils/exporters');
import { usePermissions } from '@/hooks/usePermissions';

export interface Col<T = any> { key: string; header?: ReactNode; cell?: (row: T) => ReactNode; sortable?: boolean; defaultHidden?: boolean; align?: 'right' | 'center'; exportValue?: (row: T) => unknown; width?: number }
export interface ServerPaging { page: number; size: number; total: number; totalPages: number; onPage: (p: number) => void; onSize: (s: number) => void }
export interface ServerSort { sort?: string; onSort: (s?: string) => void }

export interface DataTableProps<T = any> {
  id: string; rows: T[]; columns?: Col<T>[]; loading?: boolean; error?: unknown; onRetry?: () => void;
  paging?: ServerPaging; sorting?: ServerSort;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  rowActions?: (row: T) => ReactNode; onRowClick?: (row: T) => void; selectable?: boolean; bulkActions?: (rows: T[]) => ReactNode;
  toolbar?: ReactNode; exportName?: string; exportable?: boolean; emptyTitle?: string; emptyHint?: string; emptyAction?: ReactNode; dense?: boolean; rowKey?: (r: T, i: number) => string;
  showIds?: boolean;
}

const NOISE = new Set(['version', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'tenantId', 'correlationId']);
const isPrim = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

/** Reusable enterprise table: sticky header, server/client sort, server/client pagination, column picker (persisted), selection, exports. */
export function DataTable<T extends Record<string, any>>(p: DataTableProps<T>) {
  const { t } = useTranslation();
  const { canCall } = usePermissions();
  const prefs = useUiStore((s) => s.tablePrefs[p.id]);
  const setPrefs = useUiStore((s) => s.setTablePrefs);
  const [clientPage, setClientPage] = useState(0);
  const [clientSize, setClientSize] = useState(prefs?.pageSize ?? 20);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [colMenu, setColMenu] = useState<HTMLElement | null>(null);
  const [expMenu, setExpMenu] = useState<HTMLElement | null>(null);
  void canCall;

  // ----- columns (explicit, or inferred from the data)
  const inferred = useMemo<Col<T>[]>(() => {
    if (p.columns) return p.columns;
    const keys: string[] = [];
    p.rows.slice(0, 25).forEach((r) => Object.keys(r).forEach((k) => { if (!keys.includes(k) && isPrim(r[k]) && !NOISE.has(k)) keys.push(k); }));
    return keys.map((k) => ({ key: k, defaultHidden: k === 'id' || (!p.showIds && /Id$/.test(k) && !refKindForField(k)) }));
  }, [p.columns, p.rows, p.showIds]);

  // ----- id -> name resolution for reference columns (one cached request per kind / one bulk employee lookup)
  const kinds = useMemo(() => new Set(inferred.filter((c) => !c.cell).map((c) => refKindForField(c.key)).filter(Boolean) as RefKind[]), [inferred]);
  const dep = useRefList('department', kinds.has('department')); const des = useRefList('designation', kinds.has('designation')); const loc = useRefList('location', kinds.has('location'));
  const grade = useRefList('jobGrade', kinds.has('jobGrade')); const proj = useRefList('project', kinds.has('project')); const cust = useRefList('customer', kinds.has('customer'));
  const lt = useRefList('leaveType', kinds.has('leaveType')); const cyc = useRefList('cycle', kinds.has('cycle'));
  const empIds = useMemo(() => (kinds.has('employee') ? p.rows.flatMap((r) => inferred.filter((c) => refKindForField(c.key) === 'employee').map((c) => r[c.key])) : []), [kinds, p.rows, inferred]);
  const emp = useEmployeeLookup(empIds);
  const names = useMemo(() => {
    const map = (q: any, label: (r: any) => string) => new Map<string, string>((Array.isArray(q.data) ? q.data : q.data?.content ?? []).map((r: any) => [r.id, label(r)]));
    return {
      department: map(dep, (r) => r.name), designation: map(des, (r) => r.title), location: map(loc, (r) => r.name), jobGrade: map(grade, (r) => r.code), project: map(proj, (r) => r.name),
      customer: map(cust, (r) => r.name), leaveType: map(lt, (r) => r.name), cycle: map(cyc, (r) => r.name),
    } as Record<string, Map<string, string>>;
  }, [dep.data, des.data, loc.data, grade.data, proj.data, cust.data, lt.data, cyc.data]);
  const resolve = (k: string, v: any): string | undefined => {
    const kind = refKindForField(k); if (!kind || typeof v !== 'string') return undefined;
    if (kind === 'employee') return emp.get(v)?.fullName; return names[kind]?.get(v);
  };

  const defaultHidden = useMemo(() => inferred.filter((c) => c.defaultHidden).map((c) => c.key), [inferred]);
  const hidden = prefs?.hidden ?? defaultHidden;
  const visibility: VisibilityState = Object.fromEntries(inferred.map((c) => [c.key, !hidden.includes(c.key)]));

  const columns = useMemo<ColumnDef<T>[]>(() => inferred.map((c) => ({
    id: c.key, accessorFn: (r) => c.key.split('.').reduce((a: any, k) => a?.[k], r),
    header: () => c.header ?? t(`fields.${c.key}`, { defaultValue: humanize(c.key) }),
    enableSorting: p.sorting ? !!c.sortable : c.sortable !== false,
    cell: ({ row, getValue }) => c.cell ? c.cell(row.original) : (() => { const v = getValue(); const rv = resolve(c.key, v); return rv !== undefined ? <span title={String(v)}>{rv}</span> : <Value k={c.key} v={v} refs={false} />; })(),
    meta: { align: c.align, width: c.width, c },
  })), [inferred, t, emp, names]); // eslint-disable-line react-hooks/exhaustive-deps

  const serverSort = p.sorting?.sort?.split(',');
  const table = useReactTable({
    data: p.rows, columns, getCoreRowModel: getCoreRowModel(), getSortedRowModel: p.sorting ? undefined : getSortedRowModel(),
    state: { sorting: p.sorting ? (serverSort ? [{ id: serverSort[0], desc: serverSort[1] === 'desc' }] : []) : sorting, columnVisibility: visibility, rowSelection: selection },
    manualSorting: !!p.sorting, enableRowSelection: !!p.selectable, onRowSelectionChange: setSelection,
    onSortingChange: (u) => {
      const next = typeof u === 'function' ? u(p.sorting ? (serverSort ? [{ id: serverSort[0], desc: serverSort[1] === 'desc' }] : []) : sorting) : u;
      if (p.sorting) p.sorting.onSort(next[0] ? `${next[0].id},${next[0].desc ? 'desc' : 'asc'}` : undefined); else setSorting(next);
    },
    getRowId: (r, i) => (p.rowKey ? p.rowKey(r, i) : (r as any).id ?? String(i)),
  });

  const sortedRows = table.getRowModel().rows;
  const size = p.paging?.size ?? clientSize;
  const page = p.paging?.page ?? clientPage;
  const total = p.paging?.total ?? sortedRows.length;
  const pages = p.paging?.totalPages ?? Math.max(1, Math.ceil(sortedRows.length / size));
  const shown = p.paging ? sortedRows : sortedRows.slice(page * size, page * size + size);
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const visibleCols = table.getVisibleLeafColumns().filter((c) => c.id !== '__sel');
  const expCols = visibleCols.map((c) => ({ key: c.id, header: String(t(`fields.${c.id}`, { defaultValue: humanize(c.id) })) }));
  const expRows = (p.selectable && selectedRows.length ? selectedRows : p.rows).map((r) => {
    const o: Record<string, unknown> = {};
    inferred.forEach((c) => { const raw = c.key.split('.').reduce((a: any, k) => a?.[k], r); o[c.key] = c.exportValue ? c.exportValue(r) : resolve(c.key, raw) ?? raw; });
    return o;
  });
  const setSize = (s: number) => { setPrefs(p.id, { pageSize: s }); if (p.paging) p.paging.onSize(s); else { setClientSize(s); setClientPage(0); } };
  const goto = (n: number) => (p.paging ? p.paging.onPage(n) : setClientPage(n));

  return (
    <div className="hr-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        {p.search && (
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input className="pl-8" value={p.search.value} onChange={(e) => p.search!.onChange(e.target.value)} placeholder={p.search.placeholder ?? t('common.search_placeholder')} aria-label={t('common.search')} />
          </div>
        )}
        {p.toolbar}
        <div className="ml-auto flex items-center gap-2">
          {p.selectable && selectedRows.length > 0 && <><span className="text-xs text-muted">{selectedRows.length} {t('common.selected')}</span>{p.bulkActions?.(selectedRows)}</>}
          <Tooltip title={t('common.columns')}><Button variant="outline" size="icon" onClick={(e) => setColMenu(e.currentTarget)} aria-label={t('common.columns')}><Columns3 size={16} /></Button></Tooltip>
          {p.exportable !== false && <Tooltip title={t('common.export')}><Button variant="outline" size="icon" onClick={(e) => setExpMenu(e.currentTarget)} aria-label={t('common.export')}><Download size={16} /></Button></Tooltip>}
        </div>
        <Menu anchorEl={colMenu} open={!!colMenu} onClose={() => setColMenu(null)}>
          {inferred.map((c) => (
            <MenuItem key={c.key} dense onClick={() => setPrefs(p.id, { hidden: hidden.includes(c.key) ? hidden.filter((x) => x !== c.key) : [...hidden, c.key] })}>
              <Checkbox size="small" checked={!hidden.includes(c.key)} sx={{ p: 0.5, mr: 1 }} />{c.header ?? t(`fields.${c.key}`, { defaultValue: humanize(c.key) })}
            </MenuItem>
          ))}
        </Menu>
        <Menu anchorEl={expMenu} open={!!expMenu} onClose={() => setExpMenu(null)}>
          <MenuItem dense onClick={() => { loadExporters().then((m) => m.exportCsv(expRows, expCols, p.exportName ?? p.id)); setExpMenu(null); }}>{t('common.exportCsv')}</MenuItem>
          <MenuItem dense onClick={() => { loadExporters().then((m) => m.exportExcel(expRows, expCols, p.exportName ?? p.id)); setExpMenu(null); }}>{t('common.exportExcel')}</MenuItem>
          <MenuItem dense onClick={() => { loadExporters().then((m) => m.exportPdf(expRows, expCols, p.exportName ?? p.id)); setExpMenu(null); }}>{t('common.exportPdf')}</MenuItem>
        </Menu>
      </div>

      {p.error ? <ErrorState error={p.error} onRetry={p.onRetry} /> : (
        <div className="table-wrap">
          <table className="hr-table">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {p.selectable && <th style={{ width: 36 }}><Checkbox size="small" sx={{ p: 0 }} checked={table.getIsAllRowsSelected()} indeterminate={table.getIsSomeRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} /></th>}
                  {hg.headers.map((h) => {
                    const sorted = h.column.getIsSorted();
                    return (
                      <th key={h.id} style={{ textAlign: (h.column.columnDef.meta as any)?.align, width: (h.column.columnDef.meta as any)?.width }} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}>
                        <button type="button" disabled={!h.column.getCanSort()} onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-semibold text-inherit">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? <ArrowUp size={12} /> : sorted === 'desc' ? <ArrowDown size={12} /> : null}
                        </button>
                      </th>
                    );
                  })}
                  {p.rowActions && <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
                </tr>
              ))}
            </thead>
            <tbody>
              {p.loading && Array.from({ length: 6 }).map((_, i) => <tr key={i}>{Array.from({ length: Math.max(visibleCols.length + (p.selectable ? 1 : 0), 3) }).map((__, j) => <td key={j}><Skeleton className="h-4" /></td>)}</tr>)}
              {!p.loading && shown.map((r) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className={r.getIsSelected() ? 'selected' : ''}
                  onClick={p.onRowClick ? () => p.onRowClick!(r.original) : undefined} style={p.onRowClick ? { cursor: 'pointer' } : undefined}>
                  {p.selectable && <td onClick={(e) => e.stopPropagation()}><Checkbox size="small" sx={{ p: 0 }} checked={r.getIsSelected()} onChange={r.getToggleSelectedHandler()} /></td>}
                  {r.getVisibleCells().map((c) => <td key={c.id} style={{ textAlign: (c.column.columnDef.meta as any)?.align }}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
                  {p.rowActions && <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}><div className="inline-flex gap-1">{p.rowActions(r.original)}</div></td>}
                </motion.tr>
              ))}
            </tbody>
          </table>
          {!p.loading && shown.length === 0 && <EmptyState title={p.emptyTitle} hint={p.emptyHint} action={p.emptyAction} />}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span>{t('common.rowsPerPage')}</span>
          <NativeSelect className="h-7 w-[70px] py-0 text-xs" value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label={t('common.rowsPerPage')}>
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </NativeSelect>
          <span>{total === 0 ? '0' : `${page * size + 1}–${Math.min(total, page * size + shown.length)}`} {t('common.of')} {total}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page <= 0} onClick={() => goto(page - 1)} aria-label={t('common.previous')}><ChevronLeft size={16} /></Button>
          <span>{t('common.page')} {page + 1} {t('common.of')} {Math.max(pages, 1)}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page + 1 >= pages} onClick={() => goto(page + 1)} aria-label={t('common.next')}><ChevronRight size={16} /></Button>
        </div>
      </div>
    </div>
  );
}
