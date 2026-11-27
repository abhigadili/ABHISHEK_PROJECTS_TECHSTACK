import { EntityState, createEntityAdapter } from '@ngrx/entity';
import type { Bill, BillStatus, Payment, PaymentMethod } from '../../core/models';

export interface SettlementResult { readonly billId: number; readonly billNumber: string; readonly amount: number; readonly outcome: 'paid' | 'pending' | 'failed'; readonly transactionRef?: string; readonly message?: string }
export interface BillingState extends EntityState<Bill> {
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  readonly filter: { readonly status: BillStatus | ''; readonly search: string; readonly page: number; readonly size: number };
  readonly paging: { readonly totalElements: number; readonly totalPages: number };
  readonly selectedIds: readonly number[];
  readonly method: PaymentMethod;
  /** payments normalised by bill id */
  readonly payments: Readonly<Record<number, readonly Payment[]>>;
  readonly settlement: readonly SettlementResult[];
}
export const billingAdapter = createEntityAdapter<Bill>({ sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt) });
export const initialBillingState: BillingState = billingAdapter.getInitialState({
  loading: false, saving: false, error: null, filter: { status: '', search: '', page: 0, size: 10 }, paging: { totalElements: 0, totalPages: 0 }, selectedIds: [], method: 'UPI', payments: {}, settlement: [],
});
