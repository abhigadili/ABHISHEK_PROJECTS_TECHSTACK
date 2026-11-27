import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utilities/cn';
const v = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: { tone: { neutral: 'bg-surface2 text-muted', ok: 'bg-ok/15 text-ok', warn: 'bg-warn/15 text-warn', danger: 'bg-danger/15 text-danger', info: 'bg-info/15 text-info' } },
  defaultVariants: { tone: 'neutral' },
});
export const Badge = ({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof v>) => <span className={cn(v({ tone }), className)} {...p} />;
const map: Record<string, 'neutral' | 'ok' | 'warn' | 'danger' | 'info'> = {
  BOOKED: 'info', COMPLETED: 'ok', CANCELLED: 'danger', MISSED: 'warn', RESCHEDULED: 'warn', ACTIVE: 'ok', INACTIVE: 'neutral', PENDING: 'warn', PAID: 'ok', OVERDUE: 'danger', SUCCESS: 'ok', FAILED: 'danger',
  REQUESTED: 'warn', SAMPLE_COLLECTED: 'info', IN_PROGRESS: 'info', DISPENSED: 'ok', REJECTED: 'danger', EXPIRED: 'neutral', SENT: 'ok', QUEUED: 'warn', URGENT: 'warn', STAT: 'danger', ROUTINE: 'neutral', NOT_BILLED: 'neutral',
};
/** Status -> colour tone mapping used everywhere a backend status is displayed. */
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={map[status] ?? 'neutral'}>{status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
