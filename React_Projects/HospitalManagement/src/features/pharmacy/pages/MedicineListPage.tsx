import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Pill, Plus, RefreshCw } from 'lucide-react';
import { useMedicines } from '../hooks/usePharmacy';
import { MedicineRow } from '../components/MedicineRow';
import { MedicineFormDialog, RestockDialog } from '../components/MedicineDialogs';
import { stockLevel } from '../utils/stock';
import { usePharmacyStore, type MedicineSort } from '@/store/zustand/pharmacyStore';
import { queryKeys } from '@/services/queryKeys';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { Pagination } from '@/components/common/Pagination';
import { ProfiledSection } from '@/components/common/ProfiledSection';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useThrottledCallback } from '@/hooks/useThrottle';
import { useCan } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import type { Medicine, StockLevel } from '@/types';
import toast from 'react-hot-toast';

/**
 * Medicine list (shadcn/ui + Zustand). Search text, stock filter, sort, page and pinned medicines live in a Zustand store;
 * search is debounced, "Refresh" is THROTTLED (max one network refresh per 4 s), rows are memoised, sorting/filtering is useMemo.
 */
export default function MedicineListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManage = useCan('pharmacy:manage');
  const query = useMedicines();
  const { search, stock, sort, sortDir, page, pageSize, pinned } = usePharmacyStore();
  const { setSearch, setStock, setSort, setPage } = usePharmacyStore.getState();
  const [editing, setEditing] = useState<Medicine | 'new' | null>(null);
  const [restocking, setRestocking] = useState<Medicine | null>(null);

  const refresh = useThrottledCallback(() => { void qc.invalidateQueries({ queryKey: queryKeys.pharmacy.medicines() }); toast('Stock refreshed', { id: 'stock-refresh' }); }, 4000);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = (query.data ?? []).filter((m) => m.active && (stock === 'ALL' || stockLevel(m) === stock) && (!q || m.name.toLowerCase().includes(q) || (m.genericName ?? '').toLowerCase().includes(q) || m.sku.toLowerCase().includes(q)));
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : (a[sort] as number) - (b[sort] as number)) * dir);
  }, [query.data, search, stock, sort, sortDir]);

  const pageCount = Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(page, Math.max(pageCount - 1, 0));
  const pageRows = useMemo(() => filtered.slice(safePage * pageSize, (safePage + 1) * pageSize), [filtered, safePage, pageSize]);
  const counts = useMemo(() => { const c = { OK: 0, LOW: 0, OUT: 0 }; (query.data ?? []).filter((m) => m.active).forEach((m) => { c[stockLevel(m)]++; }); return c; }, [query.data]);

  const open = useCallback((id: number) => navigate(`/pharmacy/medicines/${id}`), [navigate]);
  const pin = useCallback((id: number) => usePharmacyStore.getState().togglePin(id), []);
  const onRestock = useCallback((m: Medicine) => setRestocking(m), []);
  const onEdit = useCallback((m: Medicine) => setEditing(m), []);

  const th = (key: MedicineSort, label: string, right = false) => (
    <TableHead className={cn(right && 'text-right')}><button type="button" className="inline-flex items-center gap-1 uppercase hover:text-fg" onClick={() => setSort(key)}>{label}{sort === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button></TableHead>
  );
  const chips: Array<{ v: StockLevel | 'ALL'; label: string; n?: number }> = [{ v: 'ALL', label: 'All' }, { v: 'OK', label: 'In stock', n: counts.OK }, { v: 'LOW', label: 'Low', n: counts.LOW }, { v: 'OUT', label: 'Out', n: counts.OUT }];

  return (
    <>
      <PageHeader title="Medicines" subtitle="Pharmacy inventory and availability" icon={<Pill className="h-5 w-5" />} actions={<><Button variant="outline" onClick={refresh} disabled={query.isFetching}><RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} /> Refresh</Button>{canManage && <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add medicine</Button>}</>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onSearch={setSearch} placeholder="Search name, generic, SKU…" />
        <div className="inline-flex rounded-lg bg-surface-alt p-1" role="tablist" aria-label="Stock filter">{chips.map((c) => <button key={c.v} role="tab" aria-selected={stock === c.v} onClick={() => setStock(c.v)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', stock === c.v ? 'bg-surface shadow' : 'text-muted')}>{c.label}{c.n !== undefined ? ` (${c.n})` : ''}</button>)}</div>
        <Select value={sort} onValueChange={(v) => setSort(v as MedicineSort)}><SelectTrigger className="w-44" aria-label="Sort by"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Sort: name</SelectItem><SelectItem value="unitPrice">Sort: price</SelectItem><SelectItem value="stockQuantity">Sort: stock</SelectItem></SelectContent></Select>
        {pinned.length > 0 && <span className="text-sm text-muted">{pinned.length} pinned</span>}
      </div>
      <QueryBoundary query={query} isEmpty={() => filtered.length === 0} emptyTitle="No medicines match" emptyDescription="Adjust the search or stock filter.">
        {() => (
          <ProfiledSection id="MedicineTable">
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <Table aria-label="Medicines"><TableHeader><TableRow className="hover:bg-transparent">{th('name', 'Medicine')}{th('unitPrice', 'Price', true)}{th('stockQuantity', 'Stock', true)}<TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{pageRows.map((m) => <MedicineRow key={m.id} medicine={m} pinned={pinned.includes(m.id)} canManage={canManage} onOpen={open} onPin={pin} onRestock={onRestock} onEdit={onEdit} />)}</TableBody></Table>
            </div>
            <Pagination page={safePage} totalPages={pageCount} totalElements={filtered.length} onPageChange={setPage} label="medicines" />
          </ProfiledSection>
        )}
      </QueryBoundary>
      {editing && <MedicineFormDialog medicine={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {restocking && <RestockDialog medicine={restocking} onClose={() => setRestocking(null)} />}
    </>
  );
}
