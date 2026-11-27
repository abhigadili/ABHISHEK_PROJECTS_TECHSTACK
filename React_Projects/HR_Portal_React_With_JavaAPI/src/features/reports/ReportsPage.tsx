import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { OpView } from '@/components/op/OpView';
import { ChartCard, BarSeries } from '@/components/charts/charts';
import { useOp } from '@/components/op/useOp';
import { usePermissions } from '@/hooks/usePermissions';
import { useRefOptions } from '@/components/op/refs';
import { monthStr, financialYear } from '@/utils/format';
import { EmptyState } from '@/components/feedback/states';
import { cn } from '@/utils/cn';

type P = { name: string; kind: 'month' | 'year' | 'fy' | 'cycle' | 'select' | 'text'; options?: string[]; def?: string };
interface R { key: string; op: string; label: string; params: P[] }
const REPORTS: R[] = [
  { key: 'exec', op: 'reporting.executive', label: 'Executive summary', params: [] },
  { key: 'headcount', op: 'reporting.headcount', label: 'Employee headcount', params: [{ name: 'groupBy', kind: 'select', options: ['department', 'designation', 'location', 'status', 'employmentType'], def: 'department' }] },
  { key: 'departments', op: 'reporting.departments', label: 'Departments', params: [] },
  { key: 'joining', op: 'reporting.joiningExit', label: 'Joining & exits', params: [{ name: 'year', kind: 'year' }] },
  { key: 'attendance', op: 'reporting.attendance', label: 'Attendance', params: [{ name: 'month', kind: 'month' }] },
  { key: 'leave', op: 'reporting.leave', label: 'Leave', params: [{ name: 'period', kind: 'month' }] },
  { key: 'payroll', op: 'reporting.payroll', label: 'Payroll', params: [{ name: 'month', kind: 'month' }] },
  { key: 'timesheets', op: 'reporting.timesheets', label: 'Timesheets', params: [{ name: 'month', kind: 'month' }] },
  { key: 'performance', op: 'reporting.performance', label: 'Performance', params: [{ name: 'cycleId', kind: 'cycle' }] },
  { key: 'allocation', op: 'reporting.allocation', label: 'Project allocation', params: [] },
  { key: 'tax', op: 'reporting.tax', label: 'Income tax', params: [{ name: 'financialYear', kind: 'fy' }] },
  { key: 'exits', op: 'reporting.exits', label: 'Exits', params: [] },
  { key: 'workforce', op: 'reporting.workforce', label: 'Workforce analytics', params: [] },
];
/** Draws a bar chart from the first array of rows in a report that has a label + numeric columns. */
function AutoChart({ op, query }: { op: string; query: Record<string, unknown> }) {
  const q = useOp<any>(op, { query });
  const spec = useMemo(() => {
    const find = (o: any): any[] | null => { if (Array.isArray(o) && o.length && typeof o[0] === 'object') return o; if (o && typeof o === 'object') for (const v of Object.values(o)) { const r = find(v); if (r) return r; } return null; };
    const rows = find(q.data); if (!rows) return null;
    const label = Object.keys(rows[0]).find((k) => typeof rows[0][k] === 'string' && !/id$/i.test(k)) ?? Object.keys(rows[0])[0];
    const nums = Object.keys(rows[0]).filter((k) => typeof rows[0][k] === 'number' || (typeof rows[0][k] === 'string' && /^-?\d+(\.\d+)?$/.test(rows[0][k]) && k !== label)).slice(0, 3);
    if (!nums.length) return null;
    return { rows: rows.map((r) => ({ ...r, ...Object.fromEntries(nums.map((n) => [n, Number(r[n])])) })), label, nums };
  }, [q.data]);
  if (q.isLoading || !spec) return null;
  return <div className="mb-3"><ChartCard title="Chart" height={240}><BarSeries data={spec.rows} x={spec.label} keys={spec.nums.map((n) => ({ key: n, label: n }))} /></ChartCard></div>;
}
export default function ReportsPage() {
  const { t } = useTranslation(); const { canCall } = usePermissions(); const avail = REPORTS.filter((r) => canCall(r.op));
  const [sel, setSel] = useState(avail[0]?.key); const cur = avail.find((r) => r.key === sel) ?? avail[0];
  const [vals, setVals] = useState<Record<string, string>>({ month: monthStr(), period: monthStr(), year: String(new Date().getFullYear()), financialYear: financialYear(), groupBy: 'department' });
  const cycles = useRefOptions('cycle');
  const cycleId = vals.cycleId || cycles.options[0]?.value || '';
  const query = cur ? Object.fromEntries(cur.params.map((p) => [p.name, p.name === 'cycleId' ? cycleId : vals[p.name]])) : {};
  return (
    <>
      <PageHeader title={t('hr.reports.title')} description={t('hr.reports.sub')} icon={<BarChart3 size={20} />} />
      {!cur ? <Card><CardBody><EmptyState title={t('common.notAuthorized')} /></CardBody></Card> : (
        <div className="row g-3">
          <div className="col-12 col-lg-3"><Card><CardBody className="p-2">{avail.map((r) => <button key={r.key} onClick={() => setSel(r.key)} className={cn('mb-1 block w-full rounded-md border-0 px-3 py-2 text-left text-[13px]', cur.key === r.key ? 'bg-primary-soft text-primary fw-semibold' : 'bg-transparent hover:bg-surface-2')}>{r.label}</button>)}</CardBody></Card></div>
          <div className="col-12 col-lg-9">
            <div className="mb-3 d-flex flex-wrap gap-2">{cur.params.map((p) => p.kind === 'select' ? <NativeSelect key={p.name} className="w-auto" value={vals[p.name] ?? p.def} onChange={(e) => setVals({ ...vals, [p.name]: e.target.value })} aria-label={p.name}>{p.options!.map((o) => <option key={o}>{o}</option>)}</NativeSelect>
              : p.kind === 'month' ? <Input key={p.name} type="month" className="w-auto" value={vals[p.name]} onChange={(e) => e.target.value && setVals({ ...vals, [p.name]: e.target.value })} aria-label={p.name} />
              : p.kind === 'cycle' ? <NativeSelect key={p.name} className="w-auto" value={cycleId} onChange={(e) => setVals({ ...vals, cycleId: e.target.value })} aria-label="cycle">{cycles.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
              : <Input key={p.name} className="w-[130px]" value={vals[p.name]} onChange={(e) => setVals({ ...vals, [p.name]: e.target.value })} aria-label={p.name} />)}</div>
            <AutoChart key={cur.key + JSON.stringify(query)} op={cur.op} query={query} />
            <OpView key={cur.key + JSON.stringify(query)} op={cur.op} query={query} title={cur.label} enabled={cur.params.every((p) => query[p.name])} />
          </div>
        </div>)}
    </>
  );
}
