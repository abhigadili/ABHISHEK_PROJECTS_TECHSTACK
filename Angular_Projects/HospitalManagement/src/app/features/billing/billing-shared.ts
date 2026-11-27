import type { BillStatus, PaymentMethod } from '../../core/models';

export const METHODS: PaymentMethod[] = ['UPI', 'CARD', 'NET_BANKING', 'CASH', 'INSURANCE'];
export const BILL_STATUSES: BillStatus[] = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'];
/** Bootstrap contextual colours per status. */
export const badgeOf = (s: string) => ({ PENDING: 'text-bg-warning', PAID: 'text-bg-success', OVERDUE: 'text-bg-danger', CANCELLED: 'text-bg-secondary', SUCCESS: 'text-bg-success', FAILED: 'text-bg-danger' } as Record<string, string>)[s] ?? 'text-bg-light';
