import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, PackageSearch, TriangleAlert, XCircle } from 'lucide-react';
import { useMedicines } from '../hooks/usePharmacy';
import { StockBadge } from '../components/StockBadge';
import { stockLevel } from '../utils/stock';
import { prescriptionApi } from '@/services/endpoints/prescriptionApi';
import { queryKeys } from '@/services/queryKeys';
import { usePharmacyStore } from '@/store/zustand/pharmacyStore';
import { PageHeader } from '@/components/common/PageHeader';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PrescriptionStatusBadge } from '@/components/common/StatusBadge';
import { formatCurrency } from '@/utils/format';
import type { Medicine, PrescriptionItem } from '@/types';

const norm = (s: string) => s.toLowerCase().replace(/\d+\s*(mg|g|ml|mcg)?/g, '').trim();
function match(item: PrescriptionItem, meds: Medicine[]): Medicine | undefined {
  const n = norm(item.medicineName);
  return meds.find((m) => m.active && (m.name.toLowerCase().includes(item.medicineName.toLowerCase()) || norm(m.name) === n || (m.genericName ?? '').toLowerCase() === n));
}

/**
 * Availability: (1) low/out-of-stock watch-list from the cached medicine list, (2) prescription-based lookup - enter a
 * prescription id, the prescribed items are matched against live inventory (matching is by name, the backend has no
 * medicine id on prescription items) and shortages are highlighted.
 */
export default function MedicineAvailabilityPage() {
  const meds = useMedicines();
  const [input, setInput] = useState('');
  const [rxId, setRxId] = useState(0);
  const pinned = usePharmacyStore((s) => s.pinned);
  const rx = useQuery({ queryKey: queryKeys.prescriptions.detail(rxId), queryFn: ({ signal }) => prescriptionApi.get(rxId, signal), enabled: rxId > 0 });
  const watch = useMemo(() => (meds.data ?? []).filter((m) => m.active && stockLevel(m) !== 'OK').sort((a, b) => a.stockQuantity - b.stockQuantity), [meds.data]);
  const pinnedMeds = useMemo(() => (meds.data ?? []).filter((m) => pinned.includes(m.id)), [meds.data, pinned]);

  return (
    <>
      <PageHeader title="Medicine availability" subtitle="Check stock against a prescription" icon={<PackageSearch className="h-5 w-5" />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Prescription lookup</h2>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setRxId(Number(input) || 0); }}>
            <Input inputMode="numeric" placeholder="Prescription id, e.g. 7" value={input} onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))} aria-label="Prescription id" />
            <Button type="submit" disabled={!input}>Check</Button>
          </form>
          {rxId > 0 && (rx.isPending ? <p className="text-sm text-muted">Loading prescription…</p> : rx.isError ? <ErrorState error={rx.error} onRetry={() => void rx.refetch()} title="Prescription not found" /> : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm"><span><b>Rx #{rx.data.id}</b> · {rx.data.patientName}</span><PrescriptionStatusBadge status={rx.data.status} /></div>
              {meds.data && <ul className="divide-y divide-[var(--hms-border)] text-sm">{rx.data.items.map((it) => {
                const m = match(it, meds.data);
                const ok = m && m.stockQuantity >= it.quantity;
                return <li key={it.id} className="flex items-center justify-between gap-3 py-2.5"><span className="flex items-center gap-2">{!m ? <XCircle className="h-4 w-4 text-red-600" /> : ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <TriangleAlert className="h-4 w-4 text-amber-600" />}<span><b>{it.medicineName}</b> {it.dosage} × {it.quantity}<span className="block text-xs text-muted">{!m ? 'Not in inventory' : ok ? `${m.name} · ${m.stockQuantity} in stock · ${formatCurrency(m.unitPrice * it.quantity)}` : `${m.name} · only ${m.stockQuantity} in stock`}</span></span></span>{m && <Link className="text-xs text-brand-600 hover:underline" to={`/pharmacy/medicines/${m.id}`}>view</Link>}</li>;
              })}</ul>}
              <Button variant="outline" size="sm" asChild><Link to={`/prescriptions/${rx.data.id}`}>Open prescription</Link></Button>
            </div>
          ))}
        </Card>
        <div className="space-y-4">
          <Card className="p-5"><h2 className="mb-3 font-semibold">Low and out-of-stock</h2>
            <QueryBoundary query={meds} isEmpty={() => watch.length === 0} emptyTitle="All medicines are well stocked">{() => <ul className="divide-y divide-[var(--hms-border)] text-sm">{watch.map((m) => <li key={m.id} className="flex items-center justify-between py-2"><Link to={`/pharmacy/medicines/${m.id}`} className="hover:underline">{m.name} <span className="text-muted">· {m.stockQuantity} left</span></Link><StockBadge level={stockLevel(m)} /></li>)}</ul>}</QueryBoundary></Card>
          {pinnedMeds.length > 0 && <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Pinned medicines</h2><Button size="sm" variant="ghost" onClick={() => usePharmacyStore.getState().clearPins()}>Clear</Button></div><ul className="space-y-1 text-sm">{pinnedMeds.map((m) => <li key={m.id} className="flex justify-between"><span>{m.name}</span><span className="text-muted">{m.stockQuantity} in stock</span></li>)}</ul></Card>}
        </div>
      </div>
    </>
  );
}
