import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/values';
import { OpButton } from '@/components/op/OpButton';
import { useOp, useOpMutation } from '@/components/op/useOp';
import { startOfWeek } from '@/utils/format';
import { useAppSelector } from '@/store/redux';
import { useUiStore } from '@/store/zustand/uiStore';
import { LoadingBlock } from '@/components/feedback/states';

interface Line { key: string; projectId: string; taskId: string; billable: boolean; hours: string[] }
const lineKey = (p: string, t: string, b: boolean) => `${p}|${t}|${b ? 1 : 0}`;
const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0; };

function TaskSelect({ projectId, value, onChange }: { projectId: string; value: string; onChange: (v: string, billable?: boolean) => void }) {
  const q = useOp<any[]>('timesheet.tasks', { query: { projectId } }, { enabled: !!projectId });
  return (
    <NativeSelect className="h-8 text-xs" value={value} onChange={(e) => onChange(e.target.value, q.data?.find((t) => t.id === e.target.value)?.billable)} aria-label="task"><option value="">— task —</option>{(q.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect>
  );
}

/** Server-side totals for the week (GET .../totals) next to the locally computed ones. */
function ServerTotals({ week }: { week: string }) {
  const q = useOp<any>('timesheet.totals', { path: { weekStart: week } }, { retry: false });
  return q.data ? <span className="text-muted" style={{ fontSize: 12 }}>Saved total: <strong>{Number(q.data.weekTotal ?? 0).toFixed(2)} h</strong></span> : null;
}
/** Editable weekly timesheet: project/task rows x 7 days, live totals, save (PUT /me/entries) and submit. */
export function WeeklyGrid() {
  const { t } = useTranslation(); const self = useAppSelector((s) => s.auth.user?.employeeId); const wk = useAppSelector((s) => s.settings.weekStartsOn);
  const [week, setWeek] = useState(startOfWeek(new Date(), wk)); const { drafts, setDraft, clearDraft } = useUiStore();
  const q = useOp<any>('timesheet.week', { path: { weekStart: week } }, { retry: false });
  const projects = useOp<any[]>('project.employeeProjects', { path: { employeeId: self ?? '' } }, { enabled: !!self });
  const popts = (projects.data ?? []).filter((p) => !p.projectStatus || p.projectStatus === 'ACTIVE').map((p) => ({ id: p.projectId ?? p.id, name: p.projectName ?? p.name ?? p.projectCode ?? p.projectId ?? p.id }));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => dayjs(week).add(i, 'day')), [week]);
  const [lines, setLines] = useState<Line[]>([]);
  const draftKey = `ts-${week}`;
  useEffect(() => {
    if (q.isLoading) return;
    const map = new Map<string, Line>();
    (q.data?.entries ?? []).forEach((e: any) => {
      const k = lineKey(e.projectId ?? '', e.taskId ?? '', !!e.billable);
      const l = map.get(k) ?? { key: k, projectId: e.projectId ?? '', taskId: e.taskId ?? '', billable: !!e.billable, hours: Array(7).fill('') };
      const idx = dayjs(e.workDate).diff(dayjs(week), 'day'); if (idx >= 0 && idx < 7) l.hours[idx] = String(e.hours); map.set(k, l);
    });
    const draft = drafts[draftKey] as Line[] | undefined;
    setLines(draft?.length ? draft : [...map.values()]);
  }, [q.data, q.isLoading, week]); // eslint-disable-line react-hooks/exhaustive-deps
  const status = q.data?.status ?? 'DRAFT'; const editable = ['DRAFT', 'REJECTED'].includes(status) || !q.data;
  const update = (ls: Line[]) => { setLines(ls); setDraft(draftKey, ls); };
  const dayTotals = days.map((_, i) => lines.reduce((a, l) => a + num(l.hours[i]), 0));
  const total = dayTotals.reduce((a, b) => a + b, 0);
  const billable = lines.filter((l) => l.billable).reduce((a, l) => a + l.hours.reduce((x, h) => x + num(h), 0), 0);
  const save = useOpMutation('timesheet.saveWeek', { onSuccess: () => { clearDraft(draftKey); } });
  const doSave = () => {
    if (dayTotals.some((h) => h > 24)) { toast.error('A day cannot exceed 24 hours', { toastId: 'ts24' }); return; }
    const entries = lines.flatMap((l) => l.hours.map((h, i) => ({ h, i })).filter((x) => num(x.h) > 0).map((x) => ({ projectId: l.projectId || undefined, taskId: l.taskId || undefined, workDate: days[x.i].format('YYYY-MM-DD'), hours: num(x.h), billable: l.billable })));
    if (lines.some((l) => !l.projectId && l.hours.some((h) => num(h) > 0))) { toast.error('Choose a project for every row with hours', { toastId: 'tsp' }); return; }
    save.mutate({ body: { weekStart: week, entries } });
  };
  if (q.isLoading) return <LoadingBlock rows={5} />;
  return (
    <Card>
      <CardHeader><CardTitle className="d-flex align-items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => setWeek(dayjs(week).subtract(7, 'day').format('YYYY-MM-DD'))} aria-label={t('common.previous')}><ChevronLeft size={16} /></Button>
        {days[0].format('D MMM')} – {days[6].format('D MMM YYYY')}
        <Button size="icon" variant="outline" onClick={() => setWeek(dayjs(week).add(7, 'day').format('YYYY-MM-DD'))} aria-label={t('common.next')}><ChevronRight size={16} /></Button>
        <Button size="sm" variant="ghost" onClick={() => setWeek(startOfWeek(new Date(), wk))}>{t('common.today')}</Button>
        <StatusBadge value={status} /></CardTitle>
        <div className="d-flex gap-2"><Button variant="outline" onClick={doSave} loading={save.isPending} disabled={!editable}>{t('common.save')}</Button>
          <OpButton op="timesheet.saveDay" label="Log a day" variant="outline" size="md" dialogSize="md" initial={{ workDate: week, billable: true }} />
          <OpButton op="timesheet.submit" path={{ weekStart: week }} label={t('common.submit')} variant="default" size="md" confirm="Submit this week for approval? You cannot edit it afterwards." /></div></CardHeader>
      <CardBody>
        {q.data?.decisionComment && <div className="mb-3 rounded-md bg-warning/15 p-2 text-xs"><strong>{t('hr.statuses.' + status, { defaultValue: status })}:</strong> {q.data.decisionComment}</div>}
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table className="hr-table">
            <thead><tr><th>Project</th><th>Task</th><th>Billable</th>{days.map((d) => <th key={d.valueOf()} style={{ textAlign: 'center' }}>{d.format('ddd D')}</th>)}<th style={{ textAlign: 'right' }}>Σ</th><th /></tr></thead>
            <tbody>
              {lines.map((l, ri) => (
                <tr key={l.key + ri}>
                  <td><NativeSelect className="h-8 text-xs" disabled={!editable} value={l.projectId} onChange={(e) => update(lines.map((x, i) => (i === ri ? { ...x, projectId: e.target.value, taskId: '' } : x)))} aria-label="project"><option value="">— project —</option>{popts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></td>
                  <td><TaskSelect projectId={l.projectId} value={l.taskId} onChange={(v, b) => update(lines.map((x, i) => (i === ri ? { ...x, taskId: v, billable: b ?? x.billable } : x)))} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" disabled={!editable} checked={l.billable} onChange={(e) => update(lines.map((x, i) => (i === ri ? { ...x, billable: e.target.checked } : x)))} aria-label="billable" /></td>
                  {days.map((d, di) => <td key={di}><input inputMode="decimal" disabled={!editable} className="form-control form-control-sm text-center" style={{ width: 62 }} value={l.hours[di]} aria-label={`${d.format('ddd')} hours`} onChange={(e) => { if (/^\d{0,2}(\.\d{0,2})?$/.test(e.target.value)) update(lines.map((x, i) => (i === ri ? { ...x, hours: x.hours.map((h, k) => (k === di ? e.target.value : h)) } : x))); }} /></td>)}
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{l.hours.reduce((a, h) => a + num(h), 0).toFixed(2)}</td>
                  <td>{editable && <Button size="icon" variant="ghost" onClick={() => update(lines.filter((_, i) => i !== ri))} aria-label="remove row"><Trash2 size={14} /></Button>}</td>
                </tr>))}
            </tbody>
            <tfoot><tr><td colSpan={3} style={{ fontWeight: 600 }}>Total</td>{dayTotals.map((h, i) => <td key={i} style={{ textAlign: 'center', fontWeight: 600, color: h > 24 ? 'var(--hr-danger)' : undefined }}>{h.toFixed(2)}</td>)}<td style={{ textAlign: 'right', fontWeight: 700 }}>{total.toFixed(2)}</td><td /></tr></tfoot>
          </table>
        </div>
        <div className="mt-2 d-flex flex-wrap align-items-center gap-3">
          {editable && <Button size="sm" variant="soft" onClick={() => update([...lines, { key: String(Date.now()), projectId: '', taskId: '', billable: true, hours: Array(7).fill('') }])}><Plus size={14} />Add row</Button>}
          <span className="text-muted" style={{ fontSize: 12 }}>Billable {billable.toFixed(2)} h · Non-billable {(total - billable).toFixed(2)} h</span>
          <ServerTotals week={week} />
          {!popts.length && <span className="text-warning" style={{ fontSize: 12 }}>No project allocations found for you — ask a project manager to allocate you.</span>}
        </div>
      </CardBody>
    </Card>
  );
}
