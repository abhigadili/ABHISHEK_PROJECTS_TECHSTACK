'use client';
import { use, useDeferredValue, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utilities/format';
import type { LabTest } from '@/types';

/**
 * React `use()`: the Server Component passes an UNAWAITED promise; this Client Component unwraps it with use(), suspending until it
 * resolves (the server page wraps it in <Suspense>) - the HTML shell streams first. A rejected promise reaches the error boundary.
 */
export function LabTestCatalogue({ testsPromise }: { testsPromise: Promise<LabTest[]> }) {
  const tests = use(testsPromise);
  const [q, setQ] = useState('');
  const term = useDeferredValue(q);
  const rows = useMemo(() => tests.filter((t) => !term || `${t.code} ${t.name} ${t.sampleType ?? ''}`.toLowerCase().includes(term.toLowerCase())), [tests, term]);
  return (
    <div className="space-y-3"><Input aria-label="Search tests" placeholder="Search tests" className="w-72" value={q} onChange={(e) => setQ(e.target.value)} />
      <Table><THead><TR><TH>Code</TH><TH>Test</TH><TH>Sample</TH><TH>Turnaround</TH><TH>Price</TH></TR></THead><TBody>{rows.map((t) => <TR key={t.id}><TD className="font-mono text-xs">{t.code}</TD><TD className="font-medium">{t.name}</TD><TD>{t.sampleType ?? '—'}</TD><TD>{t.turnaroundHours ? `${t.turnaroundHours} h` : '—'}</TD><TD className="num">{formatCurrency(t.price)}</TD></TR>)}</TBody></Table></div>
  );
}
