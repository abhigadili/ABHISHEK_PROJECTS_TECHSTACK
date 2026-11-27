import { createFeature, createReducer, on } from '@ngrx/store';
import { BillingActions as A } from '../actions/billing.actions';
import { billingAdapter, initialBillingState } from '../entities/billing.entity';

export const billingReducer = createReducer(
  initialBillingState,
  on(A.loadStaffPage, (s, { status, page, size }) => ({ ...s, loading: true, error: null, filter: { ...s.filter, status, page, size } })),
  on(A.loadStaffPageSuccess, (s, { result }) => billingAdapter.setAll(result.content, { ...s, loading: false, paging: { totalElements: result.totalElements, totalPages: result.totalPages } })),
  on(A.loadForPatient, (s) => ({ ...s, loading: true, error: null })),
  on(A.loadForPatientSuccess, (s, { bills }) => billingAdapter.setAll(bills, { ...s, loading: false, paging: { totalElements: bills.length, totalPages: 1 } })),
  on(A.loadOneSuccess, (s, { bill }) => billingAdapter.upsertOne(bill, s)),
  on(A.loadFailure, (s, { error }) => ({ ...s, loading: false, error })),
  on(A.loadPaymentsSuccess, (s, { billId, payments }) => ({ ...s, payments: { ...s.payments, [billId]: payments } })),
  on(A.pay, A.generate, A.cancelBill, A.confirmPayment, A.settleSelected, (s) => ({ ...s, saving: true, error: null })),
  on(A.paySuccess, (s, { payment }) => ({ ...s, saving: false, payments: { ...s.payments, [payment.billId]: [payment, ...(s.payments[payment.billId] ?? []).filter((p) => p.id !== payment.id)] } })),
  on(A.confirmPaymentSuccess, (s, { billId, payment }) => ({ ...s, saving: false, payments: { ...s.payments, [billId]: (s.payments[billId] ?? []).map((p) => (p.id === payment.id ? payment : p)) } })),
  on(A.settleSelectedSuccess, (s, { results }) => ({ ...s, saving: false, selectedIds: [], settlement: [...results, ...s.settlement].slice(0, 20) })),
  on(A.generateSuccess, (s, { bill }) => billingAdapter.addOne(bill, { ...s, saving: false })),
  on(A.cancelBillSuccess, (s, { bill }) => billingAdapter.updateOne({ id: bill.id, changes: bill }, { ...s, saving: false })),
  on(A.saveFailure, (s, { error }) => ({ ...s, saving: false, error })),
  on(A.statusFilterChanged, (s, { status }) => ({ ...s, selectedIds: [], filter: { ...s.filter, status, page: 0 } })),
  on(A.searchChanged, (s, { search }) => ({ ...s, filter: { ...s.filter, search } })),
  on(A.pageChanged, (s, { page }) => ({ ...s, filter: { ...s.filter, page } })),
  on(A.billToggled, (s, { id }) => ({ ...s, selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] })),
  on(A.selectionSet, (s, { ids }) => ({ ...s, selectedIds: ids })),
  on(A.methodChanged, (s, { method }) => ({ ...s, method })),
  on(A.settlementCleared, (s) => ({ ...s, settlement: [] })),
);
export const billingFeature = createFeature({ name: 'billing', reducer: billingReducer });
