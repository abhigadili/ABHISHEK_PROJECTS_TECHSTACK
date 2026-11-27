import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { billingApi } from '@/services/endpoints/billingApi';
import { queryKeys } from '@/services/queryKeys';
import { toApiError } from '@/services/axios/errors';
import { sequence } from '@/utils/promise';
import type { Bill, BillStatus, Payment, PaymentMethod } from '@/types';
import type { AppThunkConfig } from '@/store/redux/types';

/**
 * Billing workflow state in Redux Toolkit: filters, the "pay selected invoices" basket and the outcome log of the
 * sequential settlement thunk. The invoices themselves are server state (TanStack Query) and are never copied here.
 */
export interface SettlementResult {
  billId: number;
  billNumber: string;
  amount: number;
  outcome: 'paid' | 'pending' | 'failed';
  transactionRef?: string;
  message?: string;
}

export interface BillingUiState {
  status: BillStatus | '';
  search: string;
  page: number;
  selectedIds: number[];
  method: PaymentMethod;
  settling: boolean;
  results: SettlementResult[];
}

const initialState: BillingUiState = { status: '', search: '', page: 0, selectedIds: [], method: 'UPI', settling: false, results: [] };

/**
 * Sequential API calls: for every selected invoice, (1) initiate the payment, then (2) - only when the caller is
 * allowed to confirm payments (ADMIN / BILLING_STAFF, i.e. the simulated gateway callback) - confirm it.
 * Invoices are processed one after the other so a failure never leaves several half-paid bills, and the thunk
 * invalidates the TanStack Query billing cache once at the end.
 */
export const settleSelectedBills = createAsyncThunk<SettlementResult[], { bills: Bill[]; canConfirm: boolean }, AppThunkConfig>(
  'billingUi/settleSelected',
  async ({ bills, canConfirm }, { getState, extra, dispatch }) => {
    const method = getState().billingUi.method;
    const results = await sequence(bills, async (bill): Promise<SettlementResult> => {
      const due = Math.max(bill.totalAmount - bill.paidAmount, 0);
      try {
        let payment: Payment = await billingApi.pay(bill.id, { method });
        if (payment.status === 'PENDING' && canConfirm) payment = await billingApi.setPaymentStatus(payment.transactionRef, 'SUCCESS');
        const r: SettlementResult = { billId: bill.id, billNumber: bill.billNumber, amount: due, outcome: payment.status === 'SUCCESS' ? 'paid' : payment.status === 'FAILED' ? 'failed' : 'pending', transactionRef: payment.transactionRef, message: payment.failureReason ?? undefined };
        dispatch(billingUiSlice.actions.resultRecorded(r));
        return r;
      } catch (e) {
        const r: SettlementResult = { billId: bill.id, billNumber: bill.billNumber, amount: due, outcome: 'failed', message: toApiError(e).message };
        dispatch(billingUiSlice.actions.resultRecorded(r));
        return r;
      }
    });
    await extra.queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
    await extra.queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all });
    await extra.queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    return results;
  },
);

const billingUiSlice = createSlice({
  name: 'billingUi',
  initialState,
  reducers: {
    statusChanged(s, a: PayloadAction<BillStatus | ''>) {
      s.status = a.payload;
      s.page = 0;
      s.selectedIds = [];
    },
    searchChanged(s, a: PayloadAction<string>) {
      s.search = a.payload;
    },
    pageChanged(s, a: PayloadAction<number>) {
      s.page = a.payload;
    },
    billToggled(s, a: PayloadAction<number>) {
      const i = s.selectedIds.indexOf(a.payload);
      if (i >= 0) s.selectedIds.splice(i, 1);
      else s.selectedIds.push(a.payload);
    },
    selectionSet(s, a: PayloadAction<number[]>) {
      s.selectedIds = a.payload;
    },
    methodChanged(s, a: PayloadAction<PaymentMethod>) {
      s.method = a.payload;
    },
    resultRecorded(s, a: PayloadAction<SettlementResult>) {
      s.results = [a.payload, ...s.results.filter((r) => r.billId !== a.payload.billId)].slice(0, 20);
    },
    resultsCleared(s) {
      s.results = [];
    },
  },
  extraReducers: (b) => {
    b.addCase(settleSelectedBills.pending, (s) => {
      s.settling = true;
    });
    b.addCase(settleSelectedBills.fulfilled, (s) => {
      s.settling = false;
      s.selectedIds = [];
    });
    b.addCase(settleSelectedBills.rejected, (s) => {
      s.settling = false;
    });
  },
});

export const billingUiActions = billingUiSlice.actions;
export default billingUiSlice.reducer;

type Root = { billingUi: BillingUiState };
export const selectBillingUi = (s: Root) => s.billingUi;
export const selectSelectedIds = (s: Root) => s.billingUi.selectedIds;
export const selectSelectedCount = createSelector(selectSelectedIds, (ids) => ids.length);
