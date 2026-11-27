import { useState, type ReactNode } from 'react';
import { EmployeePicker } from './employees';
import { EmptyState } from '@/components/feedback/states';
/** Pick an employee, then render per-employee tools for them (path params like {employeeId}). */
export function EmployeeScope({ children, initial, label }: { children: (employeeId: string) => ReactNode; initial?: string; label?: string }) {
  const [id, setId] = useState<string | null>(initial ?? null);
  return (
    <div>
      <div className="mb-3" style={{ maxWidth: 420 }}><EmployeePicker value={id} onChange={setId} label={label ?? 'Employee'} /></div>
      {id ? children(id) : <EmptyState title="Select an employee" hint="Search by name or code to load their records." />}
    </div>
  );
}
