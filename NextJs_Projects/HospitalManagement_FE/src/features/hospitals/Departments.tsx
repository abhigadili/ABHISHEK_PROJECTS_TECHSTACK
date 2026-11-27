'use client';
import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { addDepartmentAction, removeDepartmentAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emitToast } from '@/components/ui/toast';
export function Departments({ hospitalId, items }: { hospitalId: number; items: { id: number; name: string; description: string | null }[] }) {
  const [name, setName] = useState(''); const [err, setErr] = useState(''); const [p, st] = useTransition();
  return <div className="space-y-3"><ul className="grid gap-2 sm:grid-cols-2">{items.map((d) => <li key={d.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-sm"><span>{d.name}</span><Button variant="ghost" size="icon" aria-label={`Remove ${d.name}`} disabled={p} onClick={() => { if (confirm(`Remove ${d.name}?`)) st(async () => { const r = await removeDepartmentAction(d.id); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); }); }}><Trash2 className="size-4 text-danger" /></Button></li>)}{items.length === 0 && <li className="text-sm text-muted">No departments yet.</li>}</ul><div className="flex flex-wrap gap-2"><div><Input aria-label="Department name" placeholder="New department" value={name} onChange={(e) => setName(e.target.value)} />{err && <p className="text-xs text-danger">{err}</p>}</div><Button disabled={p || !name} onClick={() => st(async () => { const r = await addDepartmentAction(hospitalId, { name }); setErr(r.fieldErrors?.name ?? ''); emitToast({ kind: r.ok ? 'success' : 'error', text: r.message ?? '' }); if (r.ok) setName(''); })}>Add</Button></div></div>;
}
