import Link from 'next/link';
import { Bell, CalendarDays, FlaskConical, Pill, ReceiptText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MarkReadButton } from './NotificationActions';
import { formatDateTime } from '@/lib/utilities/format';
import { cn } from '@/lib/utilities/cn';
import type { AppNotification } from '@/types';

const iconFor = (t: string) => (t.startsWith('APPOINTMENT') ? CalendarDays : t.startsWith('LAB') ? FlaskConical : t.startsWith('PAYMENT') || t.startsWith('BILLING') ? ReceiptText : t.startsWith('PRESCRIPTION') || t.startsWith('MEDICINE') ? Pill : Bell);
/** Server Component list: read/unread comes from the cookie written by the Server Action, so it renders correctly without client JS. */
export function NotificationList({ items, read }: { items: AppNotification[]; read: Set<number> }) {
  return (
    <ul className="divide-y divide-line rounded-[var(--radius)] border border-line bg-surface">
      {items.map((n) => { const Icon = iconFor(n.eventType); const isRead = read.has(n.id); return (
        <li key={n.id} className={cn('flex items-start gap-3 p-4', !isRead && 'bg-primary/5')}>
          <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1"><Link href={`/notifications/${n.id}`} className={cn('block truncate hover:underline', !isRead && 'font-semibold')}>{n.subject}</Link><p className="line-clamp-2 text-sm text-muted">{n.message}</p><p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted"><time className="num">{formatDateTime(n.createdAt)}</time><Badge>{n.eventType.replace(/_/g, ' ').toLowerCase()}</Badge></p></div>
          {!isRead && <MarkReadButton ids={[n.id]} />}
        </li>); })}
    </ul>
  );
}
