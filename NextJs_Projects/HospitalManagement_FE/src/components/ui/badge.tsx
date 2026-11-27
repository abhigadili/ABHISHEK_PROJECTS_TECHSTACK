import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utilities/cn';
const v = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', { variants: { tone: { neutral: 'bg-surface2 text-muted', ok: 'bg-ok/15 text-ok', warn: 'bg-warn/15 text-warn', danger: 'bg-danger/15 text-danger', info: 'bg-info/15 text-info' } }, defaultVariants: { tone: 'neutral' } });
export const Badge = ({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof v>) => <span className={cn(v({ tone }), className)} {...p} />;
const map: Record<string, 'neutral' | 'ok' | 'warn' | 'danger' | 'info'> = { CONFIRMED: 'info', PENDING: 'warn', COMPLETED: 'ok', CANCELLED: 'danger', NO_SHOW: 'warn', ACTIVE: 'ok', SUSPENDED: 'danger', ISSUED: 'warn', PAID: 'ok', PARTIALLY_PAID: 'info', REFUNDED: 'neutral', SUCCEEDED: 'ok', FAILED: 'danger', DISPENSED: 'ok', PARTIALLY_DISPENSED: 'info', EXPIRED: 'neutral', REQUESTED: 'warn', SAMPLE_COLLECTED: 'info', PROCESSING: 'info', URGENT: 'warn', STAT: 'danger', ROUTINE: 'neutral', DRAFT: 'neutral' };
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={map[status] ?? 'neutral'}>{status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
