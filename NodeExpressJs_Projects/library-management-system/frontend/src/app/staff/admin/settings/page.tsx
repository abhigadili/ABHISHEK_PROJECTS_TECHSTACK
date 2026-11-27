'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { Button, Card, Checkbox, ErrorState, PageHeader, Skeleton, TextArea, TextInput } from '@/components/ui';
import { errMsg, useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { titleCase } from '@/lib/format';

interface Setting { key: string; value: string; type: 'string' | 'number' | 'boolean' | 'text'; category: string; description: string | null }
export default function SettingsPage() {
  const toast = useToast(); const { data, error, reload } = useApi<Setting[]>('/settings'); const [vals, setVals] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setVals(Object.fromEntries(data.map((s) => [s.key, s.value]))); }, [data]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-96" />;
  const dirty = data.filter((s) => vals[s.key] !== s.value);
  const save = async () => { setBusy(true); try { await api.put('/settings', { settings: Object.fromEntries(dirty.map((s) => [s.key, s.type === 'number' ? Number(vals[s.key]) : s.type === 'boolean' ? vals[s.key] === 'true' : vals[s.key]])) }); toast.success(`${dirty.length} setting(s) saved`); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const groups = [...new Set(data.map((s) => s.category))];
  return (
    <>
      <PageHeader title="Library settings" subtitle="Contact details and circulation rules. Changes apply immediately and are written to the audit log." actions={<Button onClick={save} loading={busy} disabled={!dirty.length}>Save {dirty.length ? `(${dirty.length})` : ''}</Button>} />
      <div className="space-y-6">{groups.map((g) => (
        <Card key={g} title={titleCase(g)}><div className="grid gap-4 sm:grid-cols-2">{data.filter((s) => s.category === g).map((s) => s.type === 'boolean'
          ? <div key={s.key} className="flex flex-col justify-center"><Checkbox label={titleCase(s.key)} checked={vals[s.key] === 'true'} onChange={(e) => setVals({ ...vals, [s.key]: String(e.target.checked) })} /><p className="ml-6 text-xs text-slate-500">{s.description}</p></div>
          : s.type === 'text' ? <div key={s.key} className="sm:col-span-2"><TextArea label={titleCase(s.key)} hint={s.description ?? undefined} value={vals[s.key] ?? ''} onChange={(e) => setVals({ ...vals, [s.key]: e.target.value })} /></div>
          : <TextInput key={s.key} label={titleCase(s.key)} hint={s.description ?? undefined} type={s.type === 'number' ? 'number' : 'text'} step={s.type === 'number' ? '0.01' : undefined} min={s.type === 'number' ? 0 : undefined} value={vals[s.key] ?? ''} onChange={(e) => setVals({ ...vals, [s.key]: e.target.value })} />)}</div></Card>))}</div>
    </>
  );
}
