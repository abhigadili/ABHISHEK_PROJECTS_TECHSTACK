import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Upload, UserPlus, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { OpTable } from '@/components/tables/OpTable';
import { OpButton } from '@/components/op/OpButton';
import { OpDialog } from '@/components/op/OpDialog';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/input';
import { StatusBadge } from '@/components/common/values';
import { useRefOptions } from '@/components/op/refs';
import { call } from '@/api/client/call';
import { usePermissions } from '@/hooks/usePermissions';
import type { Col } from '@/components/tables/DataTable';

export const EMP_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_NOTICE', 'RESIGNED', 'TERMINATED'];
const COLS: Col[] = [
  { key: 'employeeCode', sortable: true }, { key: 'fullName', sortable: false }, { key: 'workEmail' }, { key: 'departmentId' }, { key: 'designationId' },
  { key: 'locationId', defaultHidden: true }, { key: 'managerId', defaultHidden: true }, { key: 'employmentType', defaultHidden: true },
  { key: 'joiningDate', sortable: true }, { key: 'status', cell: (r) => <StatusBadge value={r.status} />, sortable: true },
];

/** Bulk CSV import: parsed in the browser, then one POST /employees per row (the backend has no bulk endpoint); per-row results are shown. */
function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation(); const qc = useQueryClient();
  const [rows, setRows] = useState<Record<string, string>[]>([]); const [res, setRes] = useState<{ ok: boolean; msg: string }[]>([]); const [busy, setBusy] = useState(false);
  const parse = (txt: string) => {
    const lines = txt.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()); const head = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((l) => { const c = l.split(','); return Object.fromEntries(head.map((h, i) => [h, (c[i] ?? '').trim()])); });
  };
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; setRows(parse(await f.text())); setRes([]); toast.info(t('common.fileUploaded'), { toastId: 'imp' }); };
  const run = async () => {
    setBusy(true); const out: { ok: boolean; msg: string }[] = [];
    for (const r of rows) {
      const body: any = { ...r }; Object.keys(body).forEach((k) => body[k] === '' && delete body[k]); if (body.noticePeriodDays) body.noticePeriodDays = Number(body.noticePeriodDays);
      try { await call('employee.onboard', { body }); out.push({ ok: true, msg: `${r.firstName} ${r.lastName}` }); } catch (e: any) { out.push({ ok: false, msg: `${r.firstName} ${r.lastName}: ${e.message}` }); }
      setRes([...out]);
    }
    setBusy(false); qc.invalidateQueries({ queryKey: ['api', 'employee'] });
  };
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={`${t('common.import')} · ${t('nav.employees')}`} size="lg" description="CSV columns: firstName,lastName,workEmail,joiningDate,gender,employmentType,departmentId,designationId,locationId,managerId"
      footer={<><Button variant="outline" onClick={onClose}>{t('common.close')}</Button><Button onClick={run} loading={busy} disabled={!rows.length}>{t('common.import')} ({rows.length})</Button></>}>
      <input type="file" accept=".csv,text/csv" className="form-control mb-3" onChange={onFile} />
      {rows.length > 0 && <div className="mb-2 text-xs text-muted">{rows.length} row(s) ready</div>}
      <ul className="m-0 list-none p-0 text-xs">{res.map((r, i) => <li key={i} className={r.ok ? 'text-success' : 'text-danger'}>{r.ok ? '✓' : '✗'} {r.msg}</li>)}</ul>
    </Modal>
  );
}
/** Bulk status change: loops PATCH /employees/{id}/status over the selected rows. */
function BulkStatus({ rows }: { rows: any[] }) {
  const { t } = useTranslation(); const qc = useQueryClient(); const [open, setOpen] = useState(false); const [status, setStatus] = useState('INACTIVE'); const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); let ok = 0; const errs: string[] = [];
    for (const r of rows) { try { await call('employee.status', { path: { id: r.id }, body: { status } }); ok++; } catch (e: any) { errs.push(`${r.employeeCode}: ${e.message}`); } }
    setBusy(false); setOpen(false); qc.invalidateQueries({ queryKey: ['api', 'employee'] });
    errs.length ? toast.error(`${ok} updated, ${errs.length} failed — ${errs[0]}`) : toast.success(`${ok} ${t('common.saved')}`);
  };
  return (<>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t('common.status')} →</Button>
    <Modal open={open} onOpenChange={setOpen} title={`${t('common.status')} · ${rows.length}`} size="sm" footer={<><Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={go} loading={busy}>{t('common.apply')}</Button></>}>
      <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>{EMP_STATUSES.map((s) => <option key={s} value={s}>{t(`hr.statuses.${s}`, { defaultValue: s })}</option>)}</NativeSelect>
    </Modal>
  </>);
}

export default function EmployeesPage() {
  const { t } = useTranslation(); const nav = useNavigate(); const p = usePermissions();
  const [f, setF] = useState({ status: '', departmentId: '', designationId: '', employmentType: '' }); const [imp, setImp] = useState(false); const [add, setAdd] = useState(false);
  const dep = useRefOptions('department'); const des = useRefOptions('designation');
  const sel = (k: keyof typeof f, label: string, opts: { value: string; label: string }[]) => (
    <NativeSelect className="w-auto" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-label={label}><option value="">{label}</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect>
  );
  return (
    <>
      <PageHeader title={t('hr.employees.title')} description={t('hr.employees.sub')} icon={<Users size={20} />}
        actions={p.canCall('employee.onboard') ? <><Button variant="outline" onClick={() => setImp(true)}><Upload size={15} />{t('common.import')}</Button><Button onClick={() => setAdd(true)}><UserPlus size={15} />{t('hr.employees.add')}</Button></> : undefined} />
      <OpTable op="employee.search" tableId="employees" fallback={
        <div className="d-grid gap-3"><div role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">The full employee list failed on the server (HTTP 5xx) - typically a record the API cannot read. Showing the company directory (non-sensitive columns) instead.</div>
          <OpTable op="employee.directory" tableId="employees-fallback" searchParam="q" columns={[{ key: 'employeeCode' }, { key: 'fullName' }, { key: 'workEmail' }, { key: 'departmentId' }, { key: 'designationId' }, { key: 'status', cell: (r: any) => <StatusBadge value={r.status} /> }]} onRowClick={(r) => nav(`/employees/${r.id}`)} /></div>} searchParam="q" columns={COLS} sortable={['employeeCode', 'joiningDate', 'status']} defaultSort="employeeCode,asc"
        query={{ status: f.status, departmentId: f.departmentId, designationId: f.designationId, employmentType: f.employmentType }} selectable exportName="employees"
        onRowClick={(r) => nav(`/employees/${r.id}`)} emptyAction={p.canCall('employee.onboard') ? <Button onClick={() => setAdd(true)}>{t('hr.employees.add')}</Button> : undefined}
        bulkActions={(rows) => p.canCall('employee.status') ? <BulkStatus rows={rows} /> : null}
        filters={<>{sel('status', t('common.status'), EMP_STATUSES.map((s) => ({ value: s, label: t(`hr.statuses.${s}`, { defaultValue: s }) })))}{sel('departmentId', t('common.department'), dep.options)}{sel('designationId', t('common.designation'), des.options)}</>} />
      <ImportDialog open={imp} onClose={() => setImp(false)} />
      {add && <OpDialog open op="employee.onboard" title={t('hr.employees.add')} size="lg" onDone={(d: any) => d?.id && nav(`/employees/${d.id}`)} onClose={() => setAdd(false)} />}
    </>
  );
}
void OpButton;
