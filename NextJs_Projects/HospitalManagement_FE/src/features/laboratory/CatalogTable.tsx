'use client';
import { use } from 'react';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtMoney } from '@/lib/utilities/format';
export interface TestRow { id: number; code: string; name: string; category: string; sampleType: string | null; turnaroundHours: number; price: number }
/** React `use()`: the Server Component starts the query but does NOT await it; this Client Component unwraps the promise (suspending inside <Suspense>). */
export function CatalogTable({ tests }: { tests: Promise<TestRow[]> }) {
  const rows = use(tests);
  if (!rows.length) return <EmptyState title="No tests" />;
  return <Table><THead><TR><TH>Code</TH><TH>Test</TH><TH>Category</TH><TH>Sample</TH><TH>Turnaround</TH><TH>Price</TH></TR></THead><TBody>{rows.map((t) => <TR key={t.id}><TD className="font-mono text-xs">{t.code}</TD><TD className="font-medium">{t.name}</TD><TD>{t.category}</TD><TD>{t.sampleType ?? '—'}</TD><TD>{t.turnaroundHours} h</TD><TD className="num">{fmtMoney(t.price)}</TD></TR>)}</TBody></Table>;
}
