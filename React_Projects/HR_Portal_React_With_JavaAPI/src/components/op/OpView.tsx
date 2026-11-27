import { useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOp } from './useOp';
import { usePermissions } from '@/hooks/usePermissions';
import { OPERATION_MAP } from '@/api/client/call';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Detail } from '@/components/common/Detail';
import { DataTable, type Col } from '@/components/tables/DataTable';
import { ErrorState, LoadingBlock } from '@/components/feedback/states';
import { humanize } from '@/components/forms/SchemaFields';
import { Input, NativeSelect } from '@/components/ui/input';
import { EmployeePicker } from './employees';
import { monthStr } from '@/utils/format';

function MissingParams({ params, onSubmit }: { params: { name: string; schema: any }[]; onSubmit: (v: Record<string, string>) => void }) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(params.map((p) => [p.name, /month|period/i.test(p.name) ? monthStr() : /year/i.test(p.name) ? String(new Date().getFullYear()) : ''])));
  return (
    <form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); if (params.every((p) => v[p.name])) onSubmit(v); }}>
      {params.map((p) => (
        <div key={p.name} className="col-12 col-md-4"><label className="field-label">{humanize(p.name)} *</label>
          {/employeeId$/.test(p.name) ? <EmployeePicker value={v[p.name] || null} onChange={(id) => setV({ ...v, [p.name]: id ?? '' })} />
            : p.schema?.enum ? <NativeSelect value={v[p.name]} onChange={(e) => setV({ ...v, [p.name]: e.target.value })}><option value="">—</option>{p.schema.enum.map((o: string) => <option key={o}>{o}</option>)}</NativeSelect>
            : <Input type={/month|period/i.test(p.name) ? 'month' : /date$/i.test(p.name) ? 'date' : 'text'} value={v[p.name]} onChange={(e) => setV({ ...v, [p.name]: e.target.value })} />}</div>
      ))}
      <div className="col-auto"><Button type="submit" size="md">Run</Button></div>
    </form>
  );
}

export interface OpViewProps {
  op: string; path?: Record<string, string | number>; query?: Record<string, unknown>; title?: ReactNode; actions?: ReactNode;
  columns?: Col[]; hide?: string[]; render?: Record<string, (v: any, row: any) => ReactNode>; cols?: 1 | 2 | 3; enabled?: boolean; bare?: boolean; emptyHint?: string;
  /** render the (array) data yourself */ children?: (data: any) => ReactNode; refetchInterval?: number; tableId?: string;
}

/** Shows the result of any GET operation: array -> table, object -> key/value card (+ nested arrays as tables), page -> table. */
export function OpView({ op: opId, path, query, title, actions, columns, hide, render, cols, enabled, bare, emptyHint, children, refetchInterval, tableId }: OpViewProps) {
  const { t } = useTranslation();
  const { canCall } = usePermissions();
  const allowed = canCall(opId);
  const op = OPERATION_MAP[opId];
  // required query parameters nobody supplied -> ask for them instead of sending a request the backend will answer with 400
  const [extra, setExtra] = useState<Record<string, string>>({});
  const missing = op.query.filter((x) => x.required && query?.[x.name] === undefined);
  const merged = { ...(query ?? {}), ...extra };
  const unmet = missing.filter((x) => !extra[x.name]);
  const q = useOp<any>(opId, { path, query: merged }, { enabled: enabled !== false && allowed && unmet.length === 0, refetchInterval });
  const data = q.data;
  let body: ReactNode;
  if (unmet.length && allowed) body = <MissingParams params={unmet} onSubmit={(v) => setExtra({ ...extra, ...v })} />;
  else if (!allowed) body = <ErrorState error={new Error(t('common.notAuthorized'))} />;
  else if (q.isLoading) body = <LoadingBlock />;
  else if (q.isError) body = <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  else if (children) body = children(data);
  else if (Array.isArray(data) || Array.isArray(data?.content)) body = <DataTable id={tableId ?? opId} rows={Array.isArray(data) ? data : data.content} columns={columns} emptyHint={emptyHint} exportName={opId} />;
  else if (data && typeof data === 'object') {
    const tables = Object.entries(data).filter(([k, v]) => !hide?.includes(k) && ((Array.isArray(v) && v.length && typeof v[0] === 'object') || (v && typeof v === 'object' && Array.isArray((v as any).content) && (v as any).content.length)));
    const sections = Object.entries(data).filter(([k, v]) => !hide?.includes(k) && v && typeof v === 'object' && !Array.isArray(v) && !Array.isArray((v as any).content));
    body = (
      <div className="space-y-4">
        <Detail data={data} hide={hide} render={render} cols={cols} />
        {sections.map(([k, v]) => <div key={k}><div className="field-label">{humanize(k)}</div><Detail data={v as any} cols={cols} /></div>)}
        {tables.map(([k, v]) => <div key={k}><div className="field-label">{humanize(k)}</div><DataTable id={`${opId}.${k}`} rows={(Array.isArray(v) ? v : (v as any).content) as any[]} exportName={`${opId}-${k}`} /></div>)}
      </div>
    );
  } else body = <div className="p-3 text-sm">{String(data ?? '—')}</div>;
  if (bare) return <>{body}</>;
  return (
    <Card>
      <CardHeader><CardTitle>{title ?? op?.summary}</CardTitle>
        <div className="flex items-center gap-2">{actions}<Button variant="ghost" size="icon" onClick={() => q.refetch()} aria-label={t('common.refresh')}><RefreshCw size={15} className={q.isFetching ? 'animate-spin' : ''} /></Button></div></CardHeader>
      <CardBody>{body}</CardBody>
    </Card>
  );
}
