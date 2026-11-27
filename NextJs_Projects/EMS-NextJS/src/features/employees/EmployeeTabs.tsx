'use client';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const TABS = [{ seg: null, label: 'Overview', path: '' }, { seg: 'profile', label: 'Profile', path: '/profile' }, { seg: 'attendance', label: 'Attendance', path: '/attendance' }, { seg: 'leave-history', label: 'Leave history', path: '/leave-history' }, { seg: 'job-history', label: 'Job history', path: '/job-history' }] as const;

/** Tabs whose active state comes from `useSelectedLayoutSegment()` of the [id] layout (null on the index page = Overview). */
export function EmployeeTabs({ id }: { id: number }) {
  const active = useSelectedLayoutSegment();
  return (
    <nav aria-label="Employee sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((t) => <Link key={t.label} href={`/employees/${id}${t.path}`} aria-current={active === t.seg ? 'page' : undefined} className={cn('border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap', active === t.seg ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground')}>{t.label}</Link>)}
    </nav>
  );
}
