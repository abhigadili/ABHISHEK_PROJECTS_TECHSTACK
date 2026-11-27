'use client';
import { useActionState, useEffect, useRef, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { createDepartmentAction, deleteDepartmentAction } from '@/actions/hospitals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/features/SubmitButton';
import { emitToast } from '@/components/ui/toast';
import type { Department } from '@/types';
import type { ActionState } from '@/lib/actions/state';

export function Departments({ hospitalId, departments, canEdit }: { hospitalId: number; departments: Department[]; canEdit: boolean }) {
  const [s, action] = useActionState<ActionState, FormData>(createDepartmentAction.bind(null, hospitalId), { ok: false });
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s.ok) { emitToast({ kind: 'success', text: s.message! }); form.current?.reset(); } else if (s.message && !s.fieldErrors) emitToast({ kind: 'error', text: s.message }); }, [s]);
  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-2">{departments.filter((d) => d.active).map((d) => <li key={d.id} className="flex items-start justify-between gap-2 rounded-lg border border-line bg-surface p-3"><div><p className="font-medium">{d.name}</p>{d.description && <p className="text-sm text-muted">{d.description}</p>}</div>{canEdit && <Button variant="ghost" size="icon" aria-label={`Delete ${d.name}`} disabled={pending} onClick={() => { if (confirm(`Delete department ${d.name}?`)) start(async () => { const r = await deleteDepartmentAction(hospitalId, d.id); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); }); }}><Trash2 className="size-4 text-danger" /></Button>}</li>)}{departments.filter((d) => d.active).length === 0 && <li className="text-sm text-muted">No departments yet.</li>}</ul>
      {canEdit && <form ref={form} action={action} className="flex flex-wrap items-start gap-2"><div><Input name="name" placeholder="Department name" aria-label="Department name" aria-invalid={!!s.fieldErrors?.name} />{s.fieldErrors?.name && <p className="text-xs text-danger">{s.fieldErrors.name}</p>}</div><Input name="description" placeholder="Description (optional)" aria-label="Description" className="w-64" /><SubmitButton pendingText="Adding…">Add department</SubmitButton></form>}
    </div>
  );
}
