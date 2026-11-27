'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { VirtualList, type VirtualListHandle } from '@/components/common/VirtualList';
import { pharmacyApi } from '@/services/api/clientApis';
import { keys } from '@/services/queryKeys';
import { deriveMedicines, stockLevel, usePharmacyStore } from '@/store/zustand/pharmacyStore';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/components/providers/AuthProvider';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utilities/format';
import type { Medicine } from '@/types';

// Dynamic imports (next/dynamic): the dialogs' code is split into separate chunks and fetched on first open
const RestockDialog = dynamic(() => import('./Dialogs').then((m) => m.RestockDialog), { ssr: false, loading: () => null });
const AddMedicineDialog = dynamic(() => import('./Dialogs').then((m) => m.AddMedicineDialog), { ssr: false, loading: () => null });
const tone = { OK: 'ok', LOW: 'warn', OUT: 'danger' } as const;

/** Zustand holds filters/sort (persisted); TanStack Query holds the medicine list; filtering is client-side with a debounced search; "Load more" paginates locally. */
export function MedicineBrowser() {
  const { can } = useAuth();
  const { search, stock, sort, pageSize, setSearch, setStock, setSort, reset } = usePharmacyStore();
  const [limit, setLimit] = useState(pageSize);
  const [restock, setRestock] = useState<Medicine | null>(null);
  const [adding, setAdding] = useState(false);
  const [virtual, setVirtual] = useState(false);
  const listRef = useRef<VirtualListHandle>(null);
  const term = useDebounce(search, 300);
  const q = useQuery({ queryKey: keys.pharmacy.medicines, queryFn: ({ signal }) => pharmacyApi.medicines(signal), refetchInterval: 60_000 });
  const rows = useMemo(() => deriveMedicines(q.data ?? [], { search: term, stock, sort }), [q.data, term, stock, sort]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input className="w-64" placeholder="Search name, generic or SKU" aria-label="Search medicines" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(pageSize); }} />
        <Select className="w-40" aria-label="Stock level" value={stock} onChange={(e) => setStock(e.target.value as typeof stock)}><option value="ALL">All stock</option><option value="OK">In stock</option><option value="LOW">Low stock</option><option value="OUT">Out of stock</option></Select>
        <Select className="w-40" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="name">Name</option><option value="price">Price</option><option value="stock">Stock (lowest first)</option></Select>
        <Button variant="ghost" onClick={reset}>Reset</Button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={virtual} onChange={(e) => setVirtual(e.target.checked)} />Virtualised list</label>
        {can('pharmacy:manage') && <Button className="ml-auto" onClick={() => setAdding(true)}><Plus className="size-4" />Add medicine</Button>}
      </div>
      {q.isPending ? <TableSkeleton /> : q.isError ? <ErrorState message={q.error.message} action={<Button onClick={() => void q.refetch()}>Retry</Button>} /> : rows.length === 0 ? <EmptyState title="No medicines match" /> : (
        virtual ? (
          <div className="space-y-2"><VirtualList ref={listRef} label="Medicines" items={rows} rowHeight={48} height={360} getKey={(m) => m.id} renderRow={(m) => <div className="flex w-full items-center justify-between gap-3 text-sm"><Link href={`/pharmacy/medicines/${m.id}`} className="truncate font-medium text-primary hover:underline">{m.name}</Link><span className="num">{formatCurrency(m.unitPrice)}</span><Badge tone={tone[stockLevel(m)]}>{m.stockQuantity}</Badge></div>} /><Button size="sm" variant="outline" onClick={() => listRef.current?.scrollToIndex(0)}>Back to top</Button></div>
        ) : (<>
          <Table><THead><TR><TH>Medicine</TH><TH>SKU</TH><TH>Price</TH><TH>Stock</TH><TH>Availability</TH><TH><span className="sr-only">Actions</span></TH></TR></THead><TBody>{rows.slice(0, limit).map((m) => { const lvl = stockLevel(m); return <TR key={m.id}><TD><Link href={`/pharmacy/medicines/${m.id}`} className="font-medium text-primary hover:underline">{m.name}</Link><div className="text-xs text-muted">{m.genericName ?? ''}</div></TD><TD className="font-mono text-xs">{m.sku}</TD><TD className="num">{formatCurrency(m.unitPrice)}</TD><TD className="num">{m.stockQuantity}</TD><TD><Badge tone={tone[lvl]}>{lvl === 'OK' ? 'In stock' : lvl === 'LOW' ? 'Low stock' : 'Out of stock'}</Badge></TD><TD>{can('pharmacy:manage') && <Button size="sm" variant="ghost" onClick={() => setRestock(m)}>Restock</Button>}</TD></TR>; })}</TBody></Table>
          <div className="flex items-center justify-between text-sm text-muted"><span className="num">Showing {Math.min(limit, rows.length)} of {rows.length}</span>{limit < rows.length && <Button variant="outline" onClick={() => setLimit((l) => l + pageSize)}>Show more</Button>}</div>
        </>)
      )}
      {restock && <RestockDialog medicine={restock} onClose={() => setRestock(null)} />}
      {adding && <AddMedicineDialog onClose={() => setAdding(false)} />}
    </div>
  );
}
