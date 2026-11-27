'use client';
import { useState, useTransition } from 'react';
import { setRolePermissionsAction } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { emitToast } from '@/components/ui/toast';
/** Role ↔ permission editor (many-to-many). Changes take effect for every role member within ~30 s (server permission cache TTL + immediate invalidation). */
export function PermissionMatrix({ roles, catalog }: { roles: { key: string; name: string; users: number; permissions: string[] }[]; catalog: { key: string; label: string }[] }) {
  const [state, setState] = useState(Object.fromEntries(roles.map((r) => [r.key, new Set(r.permissions)]))); const [p, st] = useTransition(); const [saving, setSaving] = useState('');
  const toggle = (r: string, k: string) => setState((s) => { const n = new Set(s[r]); if (n.has(k)) n.delete(k); else n.add(k); return { ...s, [r]: n }; });
  return <div className="space-y-6">{roles.map((r) => <Card key={r.key}><CardHeader><CardTitle>{r.name} <span className="ml-2 text-xs font-normal text-muted">{r.users} user(s) · {state[r.key].size} permissions</span></CardTitle>{r.key === 'SUPER_ADMIN' ? <span className="text-xs text-muted">Always has every permission</span> : <Button size="sm" loading={p && saving === r.key} onClick={() => { setSaving(r.key); st(async () => { const x = await setRolePermissionsAction(r.key, [...state[r.key]]); emitToast({ kind: x.ok ? 'success' : 'error', text: x.message ?? '' }); }); }}>Save</Button>}</CardHeader><CardBody><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{catalog.map((c) => <label key={c.key} className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" disabled={r.key === 'SUPER_ADMIN'} checked={state[r.key].has(c.key)} onChange={() => toggle(r.key, c.key)} /><span><span className="font-mono text-xs">{c.key}</span><br /><span className="text-xs text-muted">{c.label}</span></span></label>)}</div></CardBody></Card>)}</div>;
}
