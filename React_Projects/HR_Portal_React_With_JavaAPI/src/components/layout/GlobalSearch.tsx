import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, FolderKanban, Briefcase, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { useOp } from '@/components/op/useOp';
import { useDebounced } from '@/hooks/useDebounced';
import { usePermissions } from '@/hooks/usePermissions';
import { useRefList } from '@/components/op/refs';
import { useUiStore } from '@/store/zustand/uiStore';

/** Global search over: employees (directory), projects, customers, departments - all via backend list/search endpoints. */
export function GlobalSearch() {
  const { t } = useTranslation(); const nav = useNavigate(); const { canCall } = usePermissions();
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const dq = useDebounced(q.trim(), 300); const box = useRef<HTMLDivElement>(null);
  const { recentSearches, addRecentSearch } = useUiStore();
  const on = dq.length >= 2;
  const emp = useOp<any>('employee.directory', { query: { q: dq, size: 5 } }, { enabled: on });
  const proj = useOp<any>('project.list', { query: { q: dq, size: 5 } }, { enabled: on && canCall('project.list') });
  const cust = useOp<any>('project.listCustomers', { query: { q: dq, size: 5 } }, { enabled: on && canCall('project.listCustomers') });
  const dep = useRefList('department', on);
  const depHits = (dep.data?.content ?? []).filter((d: any) => d.name?.toLowerCase().includes(dq.toLowerCase())).slice(0, 4);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); (box.current?.querySelector('input') as HTMLInputElement)?.focus(); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);
  const go = (path: string) => { addRecentSearch(dq); setOpen(false); setQ(''); nav(path); };
  const Row = ({ icon: I, label, sub, to }: any) => <button className="flex w-full items-center gap-2 border-0 bg-transparent px-3 py-1.5 text-left text-[13px] hover:bg-surface-2" onClick={() => go(to)}><I size={14} className="text-muted" /><span className="truncate">{label}</span><span className="ml-auto truncate text-[11px] text-muted">{sub}</span></button>;
  const groups = [
    { k: 'emp', rows: (emp.data?.content ?? []).map((e: any) => <Row key={e.id} icon={Users} label={e.fullName} sub={e.employeeCode} to={`/employees/${e.id}`} />) },
    { k: 'dep', rows: depHits.map((d: any) => <Row key={d.id} icon={Building2} label={d.name} sub={d.code} to="/organization" />) },
    { k: 'proj', rows: (proj.data?.content ?? []).map((p: any) => <Row key={p.id} icon={FolderKanban} label={p.name} sub={p.code} to={`/projects/${p.id}`} />) },
    { k: 'cust', rows: (cust.data?.content ?? []).map((c: any) => <Row key={c.id} icon={Briefcase} label={c.name} sub={c.code} to={`/customers/${c.id}`} />) },
  ];
  const any = groups.some((g) => g.rows.length);
  return (
    <div ref={box} className="relative w-full" style={{ maxWidth: 420 }}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <Input className="pl-9" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={t('nav.search')} aria-label={t('common.search')} />
      {open && (
        <div className="hr-card absolute left-0 right-0 top-11 z-[1200] max-h-[60vh] overflow-auto py-1">
          {!on && (recentSearches.length ? recentSearches.map((r) => <button key={r} className="block w-full border-0 bg-transparent px-3 py-1.5 text-left text-[13px] hover:bg-surface-2" onClick={() => setQ(r)}>{r}</button>) : <div className="px-3 py-3 text-xs text-muted">{t('common.typeToSearch')}</div>)}
          {on && !any && !(emp.isFetching || proj.isFetching) && <div className="px-3 py-3 text-xs text-muted">{t('common.noData')}</div>}
          {on && groups.map((g) => g.rows)}
        </div>
      )}
    </div>
  );
}
