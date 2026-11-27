import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Receipt, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '@/store/redux/hooks';
import { billingUiActions, selectBillingUi, selectSelectedCount, settleSelectedBills } from '@/store/slices/billingUiSlice';
import { useBillPage, usePatientBills } from '../hooks/useBilling';
import { PayDialog } from '../components/PayDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { QueryBoundary } from '@/components/common/QueryBoundary';
import { Pagination } from '@/components/common/Pagination';
import { Notice } from '@/components/common/Notice';
import { BillStatusBadge } from '@/components/common/StatusBadge';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth, useCan } from '@/contexts/AuthContext';
import { useCurrentPatient } from '@/features/authentication/hooks/useCurrentIdentity';
import { formatCurrency, formatDate, humanize } from '@/utils/format';
import type { Bill, BillStatus, PaymentMethod } from '@/types';

const STATUSES: BillStatus[] = ['PENDING', 'OVERDUE', 'PAID', 'CANCELLED'];
const isPayable = (b: Bill) => b.status === 'PENDING' || b.status === 'OVERDUE';

/**
 * Invoice list (Tailwind). The filter, page, selection basket and settlement results live in the Redux billing slice;
 * "Pay selected" dispatches a thunk that settles the selected invoices SEQUENTIALLY (initiate -> confirm) and then
 * invalidates the TanStack Query billing cache.
 */
export default function InvoiceListPage() {
  const { role } = useAuth();
  const canManage = useCan('billing:manage');
  const canPay = useCan('billing:pay');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const ui = useAppSelector(selectBillingUi);
  const selectedCount = useAppSelector(selectSelectedCount);
  const [payOpen, setPayOpen] = useState(false);
  const own = useCurrentPatient();
  const staffPage = useBillPage({ status: ui.status || undefined, page: ui.page, size: 10 }, role !== 'PATIENT');
  const mine = usePatientBills(role === 'PATIENT' ? (own.patient?.id ?? 0) : 0);
  const q = ui.search.toLowerCase();

  const filteredMine = useMemo(() => (mine.data ?? []).filter((b) => (!ui.status || b.status === ui.status) && (!q || b.billNumber.toLowerCase().includes(q) || humanize(b.billType).toLowerCase().includes(q))), [mine.data, ui.status, q]);
  const visibleStaff = useMemo(() => (staffPage.data?.content ?? []).filter((b) => !q || b.billNumber.toLowerCase().includes(q) || b.patientName.toLowerCase().includes(q)), [staffPage.data, q]);
  const rows = role === 'PATIENT' ? filteredMine : visibleStaff;
  const selectedBills = rows.filter((b) => ui.selectedIds.includes(b.id) && isPayable(b));

  const toggle = useCallback((id: number) => dispatch(billingUiActions.billToggled(id)), [dispatch]);
  const allSelectable = rows.filter(isPayable);
  const allSelected = allSelectable.length > 0 && allSelectable.every((b) => ui.selectedIds.includes(b.id));

  const columns: Column<Bill>[] = [
    ...(canPay ? [{ key: 'sel', header: '', className: 'w-10', cell: (b: Bill) => (isPayable(b) ? <span onClick={(e) => e.stopPropagation()}><Checkbox checked={ui.selectedIds.includes(b.id)} onCheckedChange={() => toggle(b.id)} aria-label={`Select ${b.billNumber}`} /></span> : null) }] : []),
    { key: 'no', header: 'Invoice', cell: (b) => <span className="font-semibold">{b.billNumber}</span> },
    ...(role !== 'PATIENT' ? [{ key: 'patient', header: 'Patient', cell: (b: Bill) => b.patientName }] : []),
    { key: 'type', header: 'Type', cell: (b) => humanize(b.billType) },
    { key: 'due', header: 'Due', cell: (b) => formatDate(b.dueDate) },
    { key: 'total', header: 'Total', align: 'right', cell: (b) => formatCurrency(b.totalAmount, b.currency) },
    { key: 'paid', header: 'Paid', align: 'right', cell: (b) => formatCurrency(b.paidAmount, b.currency) },
    { key: 'status', header: 'Status', cell: (b) => <BillStatusBadge status={b.status} /> },
  ];

  const pay = async (method: PaymentMethod) => {
    dispatch(billingUiActions.methodChanged(method));
    const res = await dispatch(settleSelectedBills({ bills: selectedBills, canConfirm: canManage })).unwrap();
    const paid = res.filter((r) => r.outcome === 'paid').length;
    const pending = res.filter((r) => r.outcome === 'pending').length;
    const failed = res.filter((r) => r.outcome === 'failed').length;
    toast[failed ? 'error' : 'success'](`${paid} paid${pending ? `, ${pending} awaiting confirmation` : ''}${failed ? `, ${failed} failed` : ''}`);
  };

  const content = (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput value={ui.search} onSearch={(s) => dispatch(billingUiActions.searchChanged(s))} placeholder="Search invoice, patient…" />
        <div className="inline-flex flex-wrap rounded-lg bg-surface-alt p-1" role="tablist" aria-label="Status filter">
          {(['', ...STATUSES] as const).map((s) => <button key={s || 'all'} role="tab" aria-selected={ui.status === s} onClick={() => dispatch(billingUiActions.statusChanged(s))} className={`rounded-md px-3 py-1.5 text-sm font-medium ${ui.status === s ? 'bg-surface shadow' : 'text-muted'}`}>{s ? humanize(s) : 'All'}</button>)}
        </div>
        <div className="flex-1" />
        {canPay && selectedCount > 0 && <><span className="text-sm text-muted">{selectedCount} selected</span><Button onClick={() => setPayOpen(true)} disabled={ui.settling || selectedBills.length === 0}><CreditCard className="h-4 w-4" /> Pay selected</Button></>}
        {canPay && allSelectable.length > 1 && <Button variant="outline" size="sm" onClick={() => dispatch(billingUiActions.selectionSet(allSelected ? [] : allSelectable.map((b) => b.id)))}>{allSelected ? 'Clear selection' : 'Select all payable'}</Button>}
      </div>
      {ui.results.length > 0 && (
        <div className="mb-3 rounded-lg border border-line bg-surface p-3 text-sm"><div className="mb-1 flex items-center justify-between"><b>Latest settlement</b><button className="flex items-center gap-1 text-xs text-muted hover:text-fg" onClick={() => dispatch(billingUiActions.resultsCleared())}><Trash2 className="h-3 w-3" /> clear</button></div>
          <ul className="space-y-0.5">{ui.results.slice(0, 5).map((r) => <li key={r.billId} className="flex justify-between"><span>{r.billNumber} · {formatCurrency(r.amount)}</span><span className={r.outcome === 'paid' ? 'text-emerald-600' : r.outcome === 'failed' ? 'text-red-600' : 'text-amber-600'}>{r.outcome}{r.message ? ` - ${r.message}` : ''}</span></li>)}</ul></div>
      )}
    </>
  );

  return (
    <>
      <PageHeader title="Invoices" subtitle={role === 'PATIENT' ? 'Your invoices' : 'All invoices'} icon={<Receipt className="h-5 w-5" />} actions={canManage && <Button asChild><Link to="/billing/generate">Generate bill</Link></Button>} />
      {role === 'PATIENT' && own.missingProfile ? <Notice tone="warning">Create your patient profile to see invoices.</Notice> : (
        <>
          {content}
          {role === 'PATIENT' ? (
            <QueryBoundary query={mine} isEmpty={() => filteredMine.length === 0} emptyTitle="No invoices">{() => <DataTable caption="Invoices" columns={columns} rows={filteredMine} rowKey={(b) => b.id} onRowClick={(b) => navigate(`/billing/invoices/${b.id}`)} />}</QueryBoundary>
          ) : (
            <QueryBoundary query={staffPage} isEmpty={() => visibleStaff.length === 0} emptyTitle="No invoices found">{() => (<><DataTable caption="Invoices" columns={columns} rows={visibleStaff} rowKey={(b) => b.id} onRowClick={(b) => navigate(`/billing/invoices/${b.id}`)} /><Pagination page={staffPage.data?.page ?? 0} totalPages={staffPage.data?.totalPages ?? 0} totalElements={staffPage.data?.totalElements} onPageChange={(p) => dispatch(billingUiActions.pageChanged(p))} disabled={staffPage.isFetching} label="invoices" /></>)}</QueryBoundary>
          )}
        </>
      )}
      <PayDialog open={payOpen} onClose={() => setPayOpen(false)} bill={selectedBills[0] ? { ...selectedBills[0], totalAmount: selectedBills.reduce((s, b) => s + b.totalAmount, 0), paidAmount: selectedBills.reduce((s, b) => s + b.paidAmount, 0), billNumber: `${selectedBills.length} invoice${selectedBills.length > 1 ? 's' : ''}` } : null} onPay={(m) => pay(m)} />
    </>
  );
}
