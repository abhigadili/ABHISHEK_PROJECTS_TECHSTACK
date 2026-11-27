import { createSelector } from '@ngrx/store';
import { billingAdapter } from '../entities/billing.entity';
import { billingFeature } from '../reducers/billing.reducer';
import { selectRouteParam } from './router.selectors';

const { selectBillingState, selectFilter, selectPaging, selectLoading, selectSaving, selectError, selectSelectedIds, selectPayments, selectSettlement, selectMethod } = billingFeature;
const entity = billingAdapter.getSelectors(selectBillingState);
export const selectAllBills = entity.selectAll;
export const selectBillEntities = entity.selectEntities;
export { selectFilter as selectBillFilter, selectPaging as selectBillPaging, selectLoading as selectBillingLoading, selectSaving as selectBillingSaving, selectError as selectBillingError, selectSelectedIds as selectBillSelectedIds, selectSettlement, selectMethod as selectBillMethod, selectPayments };

const isPayable = (s: string) => s === 'PENDING' || s === 'OVERDUE';
/** Search is applied client-side on the loaded page (the API filters by status only). */
export const selectVisibleBills = createSelector(selectAllBills, selectFilter, (bills, f) => {
  const q = f.search.trim().toLowerCase();
  return bills.filter((b) => (!f.status || b.status === f.status) && (!q || b.billNumber.toLowerCase().includes(q) || b.patientName.toLowerCase().includes(q)));
});
export const selectOutstanding = createSelector(selectAllBills, (bills) => bills.filter((b) => isPayable(b.status)).reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0));
export const selectCollected = createSelector(selectAllBills, (bills) => bills.reduce((sum, b) => sum + b.paidAmount, 0));
export const selectBillCounts = createSelector(selectAllBills, (bills) => bills.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.status]: (acc[b.status] ?? 0) + 1 }), {}));
export const selectSelectedBills = createSelector(selectAllBills, selectSelectedIds, (bills, ids) => bills.filter((b) => ids.includes(b.id) && isPayable(b.status)));
export const selectPayableBills = createSelector(selectVisibleBills, (bills) => bills.filter((b) => isPayable(b.status)));
export const selectBillPayments = (billId: number) => createSelector(selectPayments, (p) => p[billId] ?? []);
export const selectRoutedBill = createSelector(selectBillEntities, selectRouteParam('billId'), (e, id) => (id ? (e[Number(id)] ?? null) : null));
