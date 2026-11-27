'use client';
import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { cn } from '@/lib/utilities/cn';

const TABS = [['', 'Overview'], ['medical-records', 'Medical records'], ['appointments', 'Appointments'], ['prescriptions', 'Prescriptions'], ['lab', 'Lab reports'], ['billing', 'Billing'], ['edit', 'Edit']] as const;
/** Route-driven tabs: the active tab is the selected child segment of the [patientId] layout (useSelectedLayoutSegment). */
export function PatientTabs({ patientId, showBilling, showEdit, showRecords }: { patientId: number; showBilling: boolean; showEdit: boolean; showRecords: boolean }) {
  const seg = useSelectedLayoutSegment() ?? '';
  return (
    <nav aria-label="Patient sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.filter(([s]) => (s !== 'billing' || showBilling) && (s !== 'edit' || showEdit) && (s !== 'medical-records' || showRecords)).map(([s, l]) => (
        <Link key={s} href={`/patients/${patientId}${s ? `/${s}` : ''}`} aria-current={seg === s ? 'page' : undefined} className={cn('-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap text-muted hover:text-fg', seg === s && 'border-primary text-fg')}>{l}</Link>
      ))}
    </nav>
  );
}
