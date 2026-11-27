import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { Bill, BillInput, BillStatus, Page, Payment, PaymentMethod } from '../../core/models';
import type { SettlementResult } from '../entities/billing.entity';

export const BillingActions = createActionGroup({
  source: 'Billing',
  events: {
    'Load Staff Page': props<{ status: BillStatus | ''; page: number; size: number }>(),
    'Load Staff Page Success': props<{ result: Page<Bill> }>(),
    'Load For Patient': props<{ patientId: number }>(),
    'Load For Patient Success': props<{ bills: Bill[] }>(),
    'Load One': props<{ id: number }>(),
    'Load One Success': props<{ bill: Bill }>(),
    'Load Failure': props<{ error: string }>(),
    'Load Payments': props<{ billId: number }>(),
    'Load Payments Success': props<{ billId: number; payments: Payment[] }>(),
    'Pay': props<{ billId: number; method: PaymentMethod; simulateOutcome?: 'SUCCESS' | 'FAILURE' }>(),
    'Pay Success': props<{ payment: Payment }>(),
    'Confirm Payment': props<{ billId: number; transactionRef: string; status: 'SUCCESS' | 'FAILED'; reason?: string }>(),
    'Confirm Payment Success': props<{ billId: number; payment: Payment }>(),
    'Settle Selected': props<{ bills: Bill[]; method: PaymentMethod; canConfirm: boolean }>(),
    'Settle Selected Success': props<{ results: SettlementResult[] }>(),
    'Generate': props<{ bill: BillInput }>(),
    'Generate Success': props<{ bill: Bill }>(),
    'Cancel Bill': props<{ id: number }>(),
    'Cancel Bill Success': props<{ bill: Bill }>(),
    'Save Failure': props<{ error: string }>(),
    'Status Filter Changed': props<{ status: BillStatus | '' }>(),
    'Search Changed': props<{ search: string }>(),
    'Page Changed': props<{ page: number }>(),
    'Bill Toggled': props<{ id: number }>(),
    'Selection Set': props<{ ids: number[] }>(),
    'Method Changed': props<{ method: PaymentMethod }>(),
    'Settlement Cleared': emptyProps(),
  },
});
