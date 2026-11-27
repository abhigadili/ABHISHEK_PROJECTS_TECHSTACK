'use client';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { cn } from '@/lib/utilities/cn';
export function DoctorTabs({ doctorId, canEdit, canSchedule }: { doctorId: number; canEdit: boolean; canSchedule: boolean }) {
  const seg = useSelectedLayoutSegment() ?? '';
  const tabs = [['', 'Profile', true], ['schedule', 'Schedule', true], ['availability', 'Availability', true], ['appointments', 'Appointments', canSchedule], ['edit', 'Edit', canEdit]] as const;
  return <nav aria-label="Doctor sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">{tabs.filter((t) => t[2]).map(([s, l]) => <Link key={s} href={`/doctors/${doctorId}${s ? `/${s}` : ''}`} aria-current={seg === s ? 'page' : undefined} className={cn('-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap text-muted hover:text-fg', seg === s && 'border-primary text-fg')}>{l}</Link>)}</nav>;
}
