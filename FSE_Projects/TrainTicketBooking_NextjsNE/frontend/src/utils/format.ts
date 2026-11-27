import dayjs from 'dayjs';
export const inr = (v: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(v));
export const fmtDate = (v: string | Date) => dayjs(v).format('DD MMM YYYY');
export const fmtTime = (v: string | Date) => dayjs(v).format('HH:mm');
export const fmtDateTime = (v: string | Date) => dayjs(v).format('DD MMM YYYY, HH:mm');
export const fmtDuration = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
export const todayIso = () => dayjs().format('YYYY-MM-DD');
export const addDaysIso = (n: number) => dayjs().add(n, 'day').format('YYYY-MM-DD');
export const statusTone = (s: string): 'green' | 'red' | 'amber' | 'slate' | 'blue' =>
  ({ CONFIRMED: 'green', SUCCEEDED: 'green', PROCESSED: 'green', ACTIVE: 'green', CANCELLED: 'red', FAILED: 'red', EXPIRED: 'slate', SUSPENDED: 'red', PENDING_PAYMENT: 'amber', PENDING: 'amber', PARTIALLY_CANCELLED: 'amber', REFUNDED: 'blue', PARTIALLY_REFUNDED: 'blue' } as const)[s] ?? 'slate';
export const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
