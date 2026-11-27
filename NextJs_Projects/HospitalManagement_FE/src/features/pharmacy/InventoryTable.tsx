import { pharmacyService } from '@/server/services/pharmacy.service';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { AdjustStockDialog } from './PharmacyForms';
import { fmtDate } from '@/lib/utilities/format';
import { daysUntil } from '@/lib/utilities/time';
import type { Principal } from '@/server/authorization/principal';
/** Batch-level inventory with expiry status; `filter=expiring` powers the expiry-management page. */
export async function InventoryTable({ p, filter, page, base, adjust }: { p: Principal; filter?: 'expiring'; page: number; base: string; adjust: boolean }) {
  const r = await pharmacyService.inventory(p, { filter, page, size: 20 });
  return <>{r.items.length === 0 ? <EmptyState title="No batches" /> : <Table><THead><TR><TH>Medicine</TH><TH>Batch</TH><TH>Expiry</TH><TH>Quantity</TH><TH>Status</TH>{adjust && <TH />}</TR></THead><TBody>{r.items.map((i) => { const days = daysUntil(i.expiryDate); return <TR key={i.id}><TD className="font-medium">{i.medicine.name}</TD><TD className="font-mono text-xs">{i.batchNumber}</TD><TD>{fmtDate(i.expiryDate)}</TD><TD className="num">{i.quantity}</TD><TD>{days < 0 ? <Badge tone="danger">Expired</Badge> : days <= 90 ? <Badge tone="warn">Expires in {days} d</Badge> : <Badge tone="ok">OK</Badge>}</TD>{adjust && <TD><AdjustStockDialog id={i.id} batch={i.batchNumber} /></TD>}</TR>; })}</TBody></Table>}<Pagination page={page} size={20} total={r.total} basePath={base} /></>;
}
