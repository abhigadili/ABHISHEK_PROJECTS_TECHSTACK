import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Network, Search } from 'lucide-react';
import { Avatar } from '@mui/material';
import { AnimatePresence, motion } from 'motion/react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/common/values';
import { useOp } from '@/components/op/useOp';
import { OpView } from '@/components/op/OpView';
import { OpTable } from '@/components/tables/OpTable';
import { QueryBoundary } from '@/components/feedback/states';
import { useRefOptions } from '@/components/op/refs';
import { initials } from '@/utils/format';
import type { OrgChartNode, DepartmentTreeNode } from '@/api/types/organization';

const matches = (n: OrgChartNode, q: string, dept: string): boolean =>
  ((!q || `${n.fullName} ${n.employeeCode} ${n.designation}`.toLowerCase().includes(q)) && (!dept || n.department === dept)) || (n.reports ?? []).some((r) => matches(r, q, dept));

function Node({ n, depth, q, dept, expandAll, onOpen, focus }: { n: OrgChartNode; depth: number; q: string; dept: string; expandAll: number; onOpen: (id: string) => void; focus: (id: string) => void }) {
  const [open, setOpen] = useState(depth < 1);
  const kids = (n.reports ?? []).filter((r) => matches(r, q, dept));
  const forced = !!(q || dept);
  const isOpen = forced || open;
  const hit = q && `${n.fullName} ${n.employeeCode}`.toLowerCase().includes(q);
  return (
    <li key={expandAll}>
      <div className={`d-inline-flex align-items-center gap-2 rounded-lg border px-2 py-1 ${hit ? 'border-primary bg-primary-soft' : 'bg-surface'}`} style={{ borderColor: hit ? undefined : 'var(--hr-border)' }}>
        {kids.length ? <button className="border-0 bg-transparent p-0" onClick={() => setOpen(!open)} aria-label={isOpen ? 'collapse' : 'expand'} aria-expanded={isOpen}>{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button> : <span style={{ width: 15 }} />}
        <Avatar sx={{ width: 28, height: 28, fontSize: 11 }}>{initials(n.fullName)}</Avatar>
        <button className="border-0 bg-transparent p-0 text-start" onClick={() => onOpen(n.employeeId!)}>
          <div className="fw-semibold" style={{ fontSize: 13 }}>{n.fullName} <span className="text-muted fw-normal">· {n.employeeCode}</span></div>
          <div className="text-muted" style={{ fontSize: 11 }}>{n.designation} · {n.department}</div></button>
        <StatusBadge value={n.status} />
        {(n.directReports ?? 0) > 0 && <button className="rounded-full bg-surface-2 px-2 text-[11px] text-muted border-0" title="Show only this subtree" onClick={() => focus(n.employeeId!)}>{n.directReports}</button>}
      </div>
      <AnimatePresence initial={false}>{isOpen && kids.length > 0 && (
        <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="org-tree" style={{ overflow: 'hidden' }}>
          {kids.map((k) => <Node key={k.employeeId} n={k} depth={depth + 1} q={q} dept={dept} expandAll={expandAll} onOpen={onOpen} focus={focus} />)}
        </motion.ul>)}</AnimatePresence>
    </li>
  );
}

function DeptTree({ nodes }: { nodes: DepartmentTreeNode[] }) {
  return <ul className="org-tree" style={{ borderLeft: 0, paddingLeft: 0 }}>{nodes.map((n) => <li key={n.id}><strong>{n.name}</strong> <span className="text-muted">({n.code}) · {n.employeeCount ?? 0} employees</span>{n.children?.length ? <DeptTree nodes={n.children} /> : null}</li>)}</ul>;
}

export default function OrgChartPage() {
  const { t } = useTranslation(); const nav = useNavigate();
  const [q, setQ] = useState(''); const [dept, setDept] = useState(''); const [focusId, setFocusId] = useState(''); const [ver, setVer] = useState(0);
  const chart = useOp<OrgChartNode[]>('organization.chart', undefined, { enabled: !focusId });
  const sub = useOp<OrgChartNode>('organization.chartFor', { path: { employeeId: focusId } }, { enabled: !!focusId });
  const tree = useOp<DepartmentTreeNode[]>('organization.departmentTree');
  const deps = useRefOptions('department');
  const roots = useMemo(() => (focusId ? (sub.data ? [sub.data] : []) : chart.data ?? []), [focusId, sub.data, chart.data]);
  const deptName = deps.options.find((d) => d.value === dept)?.label ?? '';
  const ql = q.trim().toLowerCase();
  const shown = roots.filter((r) => matches(r, ql, deptName));
  const active = focusId ? sub : chart;
  return (
    <>
      <PageHeader title={t('hr.org.title')} description={t('hr.org.sub')} icon={<Network size={20} />} />
      <Tabs tabs={[
        { key: 'chart', label: t('hr.org.title'), content: (<>
          <div className="mb-3 d-flex flex-wrap gap-2 align-items-center">
            <div className="relative" style={{ minWidth: 220 }}><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} aria-label={t('common.search')} /></div>
            <NativeSelect className="w-auto" value={dept} onChange={(e) => setDept(e.target.value)} aria-label={t('common.department')}><option value="">{t('common.all')} · {t('common.department')}</option>{deps.options.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</NativeSelect>
            <Button variant="outline" onClick={() => setVer((v) => v + 1)}>{t('hr.org.collapseAll')}</Button>
            {focusId && <Button variant="soft" onClick={() => setFocusId('')}>← {t('common.all')}</Button>}
          </div>
          <div className="hr-card p-3 overflow-auto">
            <QueryBoundary q={active} empty={!shown.length}>
              <ul className="org-tree" style={{ borderLeft: 0, paddingLeft: 0 }}>{shown.map((r) => <Node key={`${r.employeeId}-${ver}`} n={r} depth={0} q={ql} dept={deptName} expandAll={ver} onOpen={(id) => nav(`/employees/${id}`)} focus={setFocusId} />)}</ul>
            </QueryBoundary>
          </div></>) },
        { key: 'departments', label: t('hr.org.departmentTree'), content: (<div className="row g-3">
          <div className="col-12 col-lg-5"><div className="hr-card p-3"><QueryBoundary q={tree} empty={!tree.data?.length}><DeptTree nodes={tree.data ?? []} /></QueryBoundary></div></div>
          <div className="col-12 col-lg-7"><OpView op="organization.headcount" title="Headcount ranking" /></div></div>) },
        { key: 'members', label: t('nav.employees'), content: <DeptMembers /> },
      ]} />
    </>
  );
}
function DeptMembers() {
  const deps = useRefOptions('department'); const [d, setD] = useState('');
  const id = d || deps.options[0]?.value;
  return (<>
    <NativeSelect className="mb-3 w-auto" value={id ?? ''} onChange={(e) => setD(e.target.value)} aria-label="department">{deps.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
    {id && <OpTable op="organization.departmentEmployees" path={{ id }} tableId="dept-members" />}
  </>);
}
