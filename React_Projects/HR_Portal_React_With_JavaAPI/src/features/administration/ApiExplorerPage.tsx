import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plug, Play, Activity } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, NativeSelect } from '@/components/ui/input';
import { DataTable } from '@/components/tables/DataTable';
import { OpForm } from '@/components/op/OpForm';
import { OPERATIONS } from '@/api/generated/operations';
import { COVERAGE_MAP, MODULE_ROUTE } from '@/coverage';
import { usePermissions } from '@/hooks/usePermissions';
import { call } from '@/api/client/call';
import { SERVICES } from './AuditPage';
import type { OperationDef, SchemaDef } from '@/api/operationTypes';

const METHOD_TONE: Record<string, any> = { GET: 'info', POST: 'success', PUT: 'warning', PATCH: 'warning', DELETE: 'danger' };
/** Session-critical operations are never executable from the explorer (it would end the admin's own session). */
const BLOCKED = new Set(['auth.login', 'auth.logout', 'auth.refresh', 'auth.changePassword']);
const mask = (v: any): any => (Array.isArray(v) ? v.map(mask) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /token|password|secret/i.test(k) && typeof x === 'string' ? '••••••' : mask(x)])) : v);

function props(s: SchemaDef | null): { name: string; type: string; req: boolean; rules: string }[] {
  if (!s?.properties) return [];
  return Object.entries(s.properties).map(([name, p]) => ({
    name, req: !!s.required?.includes(name),
    type: p.enum ? p.enum.join(' | ') : p.type === 'array' ? `${p.items?.type ?? 'object'}[]` : `${p.type ?? 'object'}${p.format ? `(${p.format})` : ''}`,
    rules: [p.minLength != null && `min ${p.minLength}`, p.maxLength != null && `max ${p.maxLength}`, p.minimum != null && `≥ ${p.minimum}`, p.maximum != null && `≤ ${p.maximum}`, p.pattern && `/${p.pattern}/`].filter(Boolean).join(', '),
  }));
}
function Health() {
  const [res, setRes] = useState<Record<string, string>>({});
  const check = async () => {
    const out: Record<string, string> = {};
    await Promise.all(SERVICES.map(async (s) => { const t0 = performance.now(); try { await call(`${s}.ping`); out[s] = `up · ${Math.round(performance.now() - t0)} ms`; } catch (e: any) { out[s] = `down · ${e.message}`; } }));
    setRes(out);
  };
  return (
    <Card className="mb-3"><CardHeader><CardTitle>Service health (/ping)</CardTitle><Button size="sm" variant="outline" onClick={check}><Activity size={14} />Check all</Button></CardHeader>
      <CardBody className="d-flex flex-wrap gap-2">{SERVICES.map((s) => <Badge key={s} tone={res[s] ? (res[s].startsWith('up') ? 'success' : 'danger') : 'neutral'} title={res[s]}>{s}{res[s] ? ` · ${res[s]}` : ''}</Badge>)}</CardBody></Card>
  );
}
function Details({ op, onClose }: { op: OperationDef; onClose: () => void }) {
  const { t } = useTranslation(); const p = usePermissions(); const cov = COVERAGE_MAP[op.id]; const [result, setResult] = useState<any>(undefined); const [run, setRun] = useState(false); const [ack, setAck] = useState(false);
  const canRun = p.isAdmin && p.canCall(op.id) && !BLOCKED.has(op.id) && !op.binary;
  const bp = props(op.bodySchema);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={op.summary} size="xl" description={<span><Badge tone={METHOD_TONE[op.method]}>{op.method}</Badge> <code>{op.path}</code></span>}>
      <div className="d-grid gap-3" style={{ fontSize: 13 }}>
        <div className="row g-3"><div className="col-md-4"><div className="field-label">Operation id</div><code>{op.id}</code></div>
          <div className="col-md-4"><div className="field-label">Authentication</div>{op.public ? 'Public' : 'Bearer JWT'}</div>
          <div className="col-md-4"><div className="field-label">Authorization (@PreAuthorize)</div><code>{op.authorize ?? 'any authenticated user'}</code></div>
          <div className="col-md-4"><div className="field-label">Related UI</div>{cov?.files?.length ? cov.files.map((f) => <div key={f}><Link to={MODULE_ROUTE[cov.module] ?? '/'} onClick={onClose}>{f.replace('src/', '')}</Link></div>) : '—'}</div>
          <div className="col-md-4"><div className="field-label">Integration</div><Badge tone={cov?.status === 'not-integrated' ? 'danger' : 'success'}>{cov?.status ?? 'unknown'}</Badge></div>
          <div className="col-md-4"><div className="field-label">Response</div><code>{op.binary ? 'binary file' : op.responseType ?? 'no body'}</code> {op.responseStatus && <span className="text-muted">({op.responseStatus})</span>}</div></div>
        {(op.pathParams.length > 0 || op.query.length > 0) && <div><div className="field-label">Parameters</div><DataTable id="ex-params" exportable={false} rows={[...op.pathParams.map((n) => ({ name: n, in: 'path', type: 'string', required: true })), ...op.query.map((q) => ({ name: q.name, in: 'query', type: q.schema.enum ? q.schema.enum.join(' | ') : q.schema.type, required: q.required }))]} /></div>}
        {bp.length > 0 && <div><div className="field-label">Request body {op.multipart && '(multipart)'}</div><DataTable id="ex-body" exportable={false} rows={bp} /></div>}
        {canRun ? (
          <div><div className="field-label">Execute (administrative / diagnostic)</div>
            {op.method !== 'GET' && <label className="d-flex gap-2 mb-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand this {op.method} request changes real data.</label>}
            {!run ? <Button disabled={op.method !== 'GET' && !ack} onClick={() => setRun(true)}><Play size={14} />{t('common.executeRequest')}</Button>
              : <><OpForm op={op.id} successMessage={false} onDone={(d) => setResult(d ?? '(no content)')} submitLabel="Send" formId="explorer-form" /><Button type="submit" form="explorer-form" className="mt-3">{t('common.executeRequest')}</Button></>}
            {result !== undefined && <pre className="mt-3 rounded-md bg-surface-2 p-3" style={{ maxHeight: 320, overflow: 'auto', fontSize: 11 }}>{JSON.stringify(mask(result), null, 2)}</pre>}</div>
        ) : <div className="text-muted">{BLOCKED.has(op.id) ? 'Not executable here: it would end your own session.' : op.binary ? 'Binary download - use the related UI.' : t('common.notAuthorized')}</div>}
      </div>
    </Modal>
  );
}
export default function ApiExplorerPage() {
  const { t } = useTranslation(); const [q, setQ] = useState(''); const [f, setF] = useState({ service: '', method: '', status: '' }); const [open, setOpen] = useState<OperationDef | null>(null);
  const rows = useMemo(() => OPERATIONS.filter((o) => (!f.service || o.service === f.service) && (!f.method || o.method === f.method) && (!f.status || COVERAGE_MAP[o.id]?.status === f.status) && (!q || `${o.path} ${o.summary} ${o.tag} ${o.id}`.toLowerCase().includes(q.toLowerCase()))), [q, f]);
  return (
    <>
      <PageHeader title={t('hr.admin.explorer')} description={`${OPERATIONS.length} endpoints · ${t('hr.admin.explorerSub')}`} icon={<Plug size={20} />} />
      <Health />
      <DataTable id="explorer" rows={rows} exportName="api-endpoints" onRowClick={(r) => setOpen(r)} search={{ value: q, onChange: setQ, placeholder: 'Search path, summary, tag…' }}
        toolbar={<><NativeSelect className="w-auto" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} aria-label="service"><option value="">All services</option>{SERVICES.map((s) => <option key={s}>{s}</option>)}</NativeSelect>
          <NativeSelect className="w-auto" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} aria-label="method"><option value="">Method</option>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((s) => <option key={s}>{s}</option>)}</NativeSelect>
          <NativeSelect className="w-auto" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="status"><option value="">Integration</option><option value="integrated">integrated</option><option value="infrastructure">infrastructure</option><option value="not-integrated">not integrated</option></NativeSelect></>}
        columns={[{ key: 'method', cell: (r: OperationDef) => <Badge tone={METHOD_TONE[r.method]}>{r.method}</Badge>, width: 80 }, { key: 'path', cell: (r: OperationDef) => <code style={{ fontSize: 12 }}>{r.path}</code> }, { key: 'service' }, { key: 'tag' }, { key: 'summary', cell: (r: OperationDef) => <span className="line-clamp-1" style={{ maxWidth: 360, display: 'inline-block' }}>{r.summary}</span> },
          { key: 'authorize', header: 'Authorization', cell: (r: OperationDef) => (r.public ? <Badge>public</Badge> : r.authorize ? <Badge tone="warning" title={r.authorize}>restricted</Badge> : <Badge tone="neutral">authenticated</Badge>), exportValue: (r: OperationDef) => r.authorize ?? (r.public ? 'public' : 'authenticated') },
          { key: 'ui', header: 'Related UI', cell: (r: OperationDef) => COVERAGE_MAP[r.id]?.module ?? '—', exportValue: (r: OperationDef) => COVERAGE_MAP[r.id]?.module },
          { key: 'cov', header: 'Status', cell: (r: OperationDef) => <Badge tone={COVERAGE_MAP[r.id]?.status === 'not-integrated' ? 'danger' : 'success'}>{COVERAGE_MAP[r.id]?.status ?? '—'}</Badge>, exportValue: (r: OperationDef) => COVERAGE_MAP[r.id]?.status },
          { key: 'id', defaultHidden: true }]} />
      <Input hidden readOnly />
      {open && <Details op={open} onClose={() => setOpen(null)} />}
    </>
  );
}
