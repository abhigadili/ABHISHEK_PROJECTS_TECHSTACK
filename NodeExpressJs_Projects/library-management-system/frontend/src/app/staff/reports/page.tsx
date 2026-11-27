'use client';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { SearchInput } from '@/components/pickers';
import { useToast } from '@/components/toast';
import { Button, Card, EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, TextInput } from '@/components/ui';
import { errMsg, useApi, useDebounced, usePaged } from '@/hooks/useApi';
import { api, qs } from '@/lib/api';
import { fmtDate, fmtDateTime, titleCase } from '@/lib/format';

interface Def { key: string; title: string; description: string; dateFilter: boolean }
const fmtCell = (k: string, v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDateTime(v);
  if (typeof v === 'number' && /(amount|outstanding|raised|waived|collected)/i.test(k)) return v.toFixed(2);
  return String(v);
};

export default function ReportsPage() {
  const toast = useToast(); const { data: defs } = useApi<Def[]>('/reports'); const [key, setKey] = useState('inventory');
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [page, setPage] = useState(1); const [dl, setDl] = useState(false);
  const def = defs?.find((d) => d.key === key);
  const params = { q: dq, from: def?.dateFilter ? from : '', to: def?.dateFilter ? to : '', page, pageSize: 25 };
  const { rows, meta, loading, error, reload } = usePaged<Record<string, unknown>>(`/reports/${key}${qs(params)}`);
  const cols = rows && rows[0] ? Object.keys(rows[0]) : [];
  const exportCsv = async () => { setDl(true); try { await api.download(`/reports/${key}${qs({ ...params, page: undefined, pageSize: undefined, format: 'csv' })}`, `${key}-${new Date().toISOString().slice(0, 10)}.csv`); } catch (e) { toast.error(errMsg(e)); } finally { setDl(false); } };
  return (
    <>
      <PageHeader title="Reports" subtitle="Generated from live database queries; CSV exports follow the same permissions." actions={<Button variant="secondary" onClick={exportCsv} loading={dl}><Download className="h-4 w-4" />Export CSV</Button>} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Reports" className="card h-fit p-2"><ul>{defs?.map((d) => <li key={d.key}><button onClick={() => { setKey(d.key); setPage(1); setQ(''); }} aria-current={d.key === key ? 'page' : undefined} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${d.key === key ? 'bg-brand-50 font-medium text-brand-800' : 'hover:bg-slate-50'}`}>{d.title}</button></li>)}</ul></nav>
        <div className="min-w-0">
          <Card className="!p-0">
            <div className="border-b border-slate-100 p-4"><h2 className="font-semibold">{def?.title}</h2><p className="text-sm text-slate-500">{def?.description}</p></div>
            <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Filter this report" label="Filter report" />
              {def?.dateFilter && <><TextInput label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /><TextInput label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></>}</div>
            {error ? <ErrorState message={error} onRetry={reload} /> : loading && !rows ? <TableSkeleton cols={5} /> : !rows?.length ? <EmptyState title="No rows" description="Nothing matches the current filters." /> : (
              <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}><table className="min-w-full divide-y divide-slate-100"><thead className="bg-slate-50"><tr>{cols.map((c) => <th key={c} scope="col" className="th whitespace-nowrap">{titleCase(c.replace(/([A-Z])/g, ' $1'))}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{rows.map((r, i) => <tr key={i} className="hover:bg-slate-50/60">{cols.map((c) => <td key={c} className="td whitespace-nowrap">{fmtCell(c, r[c])}</td>)}</tr>)}</tbody></table></div>)}
            <Pagination meta={meta} onPage={setPage} />
          </Card>
        </div>
      </div>
    </>
  );
}
