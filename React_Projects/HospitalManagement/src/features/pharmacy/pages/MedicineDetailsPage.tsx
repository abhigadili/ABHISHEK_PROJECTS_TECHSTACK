import { Link, useParams } from 'react-router-dom';
import { useMedicine } from '../hooks/usePharmacy';
import { StockBadge } from '../components/StockBadge';
import { RestockDialog } from '../components/MedicineDialogs';
import { stockLevel } from '../utils/stock';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { PageHeader } from '@/components/common/PageHeader';
import { DetailList } from '@/components/common/DetailList';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useCan } from '@/contexts/AuthContext';
import { formatCurrency, formatNumber } from '@/utils/format';
import { useState } from 'react';

export default function MedicineDetailsPage() {
  const id = Number(useParams().medicineId);
  const query = useMedicine(id);
  const canManage = useCan('pharmacy:manage');
  const [restock, setRestock] = useState(false);
  return (
    <QueryBoundary query={query} isEmpty={(m) => m === null} empty={<EmptyState title="Medicine not found" action={<Button asChild variant="outline"><Link to="/pharmacy/medicines">Back to medicines</Link></Button>} />}>
      {(m) => {
        if (!m) return null;
        const level = stockLevel(m);
        const pct = Math.min(100, Math.round((m.stockQuantity / Math.max(m.reorderLevel * 5, 1)) * 100));
        return (
          <div className="mx-auto max-w-2xl space-y-4">
            <PageHeader title={m.name} subtitle={m.genericName ?? undefined} actions={<StockBadge level={level} />} />
            <Card className="space-y-5 p-5">
              <DetailList columns={3} items={[{ label: 'SKU', value: m.sku }, { label: 'Generic name', value: m.genericName }, { label: 'Unit price', value: formatCurrency(m.unitPrice) }, { label: 'In stock', value: formatNumber(m.stockQuantity) }, { label: 'Reorder level', value: formatNumber(m.reorderLevel) }, { label: 'Status', value: m.active ? 'Active' : 'Inactive' }]} />
              <div><div className="mb-1 flex justify-between text-xs text-muted"><span>Stock relative to 5× reorder level</span><span>{pct}%</span></div><Progress value={pct} /></div>
            </Card>
            <div className="flex gap-2">{canManage && <Button onClick={() => setRestock(true)}>Restock</Button>}<Button variant="outline" asChild><Link to="/pharmacy/medicines">Back to list</Link></Button></div>
            {restock && <RestockDialog medicine={m} onClose={() => setRestock(false)} />}
          </div>
        );
      }}
    </QueryBoundary>
  );
}
