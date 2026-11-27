import { Badge } from '@/components/ui/badge';
import { useFormat } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { SafeHtml } from '@/components/editors/SafeHtml';
import { EmployeeName } from '@/components/op/employees';
import { refKindForField, useRefList } from '@/components/op/refs';

const TONES: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'> = {
  ACTIVE: 'success', APPROVED: 'success', COMPLETED: 'success', PRESENT: 'success', VERIFIED: 'success', PAID: 'success', FINALIZED: 'success', CLOSED: 'neutral', CONFIRMED: 'success', DONE: 'success', ACCEPTED: 'success',
  PENDING: 'warning', SUBMITTED: 'info', IN_REVIEW: 'info', DRAFT: 'neutral', ON_NOTICE: 'warning', PROCESSING: 'info', OPEN: 'info', SCHEDULED: 'info', PARTIAL: 'warning', HALF_DAY: 'warning', LATE: 'warning', WFH: 'info', ON_LEAVE: 'info',
  REJECTED: 'danger', CANCELLED: 'danger', TERMINATED: 'danger', ABSENT: 'danger', LOCKED: 'danger', INACTIVE: 'neutral', RESIGNED: 'neutral', WITHDRAWN: 'neutral', FAILED: 'danger', EXPIRED: 'danger', RETURNED: 'warning', MANAGER_APPROVED: 'info', HR_CONFIRMED: 'info', SELF_PENDING: 'warning', SELF_SUBMITTED: 'info', MANAGER_SUBMITTED: 'info', UNDER_REVIEW: 'info', PROCESSED: 'info', SETTLEMENT_PENDING: 'warning', INTERVIEW_DONE: 'info', CLEARED: 'success', MANAGER_REJECTED: 'danger', MISSING_PUNCH: 'warning', NO_RECORD: 'neutral', IN_PROGRESS: 'info', NOT_STARTED: 'neutral', UPLOADED: 'info', APPLIED: 'warning', MANDATORY: 'primary', OPTIONAL: 'info', RESTRICTED: 'neutral',
};
export function StatusBadge({ value }: { value?: string | null }) {
  const { t } = useTranslation();
  if (!value) return <span className="text-muted">—</span>;
  return <Badge tone={TONES[value] ?? 'neutral'}>{t(`hr.statuses.${value}`, { defaultValue: value.replace(/_/g, ' ') })}</Badge>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MONEY = /(amount|salary|ctc|gross|^net|netpay|deduction|earning|bonus|basic|allowance|budget|creditlimit|principal|emi|price|billingrate|hourlyrate|totaldeclared|totalapproved|totalgross|totalnet|totaldeductions|payable|recoveries|taxable|tds|fee$)/i;
const STATUSLIKE = /^(status|stage|state|type|category|decision|mode|kind|priority|gender|employmentType|role)$/i;
const SKIP_PLAIN_ID = /(^id$|Id$|^version$)/;

const HTML = /^\s*<(p|div|ul|ol|h[1-6]|br|b|i|strong|em|span|table|a)[\s>/]/i;
const RF: Record<string, [Parameters<typeof useRefList>[0], (r: any) => string]> = { department: ['department', (r) => r.name], designation: ['designation', (r) => r.title], location: ['location', (r) => r.name], jobGrade: ['jobGrade', (r) => r.code], project: ['project', (r) => r.name], customer: ['customer', (r) => r.name], leaveType: ['leaveType', (r) => r.name], cycle: ['cycle', (r) => r.name] };
/** Resolves a reference id (department / project / customer ... id) to its name through the cached reference lists. */
function RefName({ kind, id }: { kind: string; id: string }) {
  const [k, label] = RF[kind]; const q = useRefList(k); const rows: any[] = Array.isArray(q.data) ? q.data : q.data?.content ?? [];
  const hit = rows.find((r) => r.id === id);
  return <span title={id}>{hit ? label(hit) : `${id.slice(0, 8)}…`}</span>;
}
/** Formats any backend value by its name + shape (dates, instants, money, booleans, statuses, rich text, reference ids, arrays). */
export function Value({ k, v, refs = true }: { k: string; v: unknown; refs?: boolean }) {
  const f = useFormat();
  const { t } = useTranslation();
  if (v === null || v === undefined || v === '') return <span className="text-muted">—</span>;
  if (typeof v === 'boolean') return <Badge tone={v ? 'success' : 'neutral'}>{v ? t('common.yes') : t('common.no')}</Badge>;
  if (typeof v === 'number') return <span className="tabular-nums">{MONEY.test(k) && !/days|count|year|number|hours/i.test(k) ? f.money(v) : f.number(v)}</span>;
  if (typeof v === 'string') {
    if (HTML.test(v)) return <SafeHtml html={v} />;
    if (refs && v.length > 20) { const kind = refKindForField(k); if (kind === 'employee') return <EmployeeName id={v} />; if (kind && RF[kind]) return <RefName kind={kind} id={v} />; }
    if (ISO_DT.test(v)) return <span>{f.dateTime(v)}</span>;
    if (ISO_DATE.test(v)) return <span>{f.date(v)}</span>;
    if (STATUSLIKE.test(k) || /^[A-Z][A-Z_]{2,}$/.test(v)) return <StatusBadge value={v} />;
    if (SKIP_PLAIN_ID.test(k) && v.length > 20) return <code className="text-[11px] text-muted" title={v}>{v.slice(0, 8)}…</code>;
    return <span>{v}</span>;
  }
  if (Array.isArray(v)) return v.length === 0 ? <span className="text-muted">—</span> : v.every((x) => typeof x !== 'object') ? <span>{v.join(', ')}</span> : <span className="text-muted">{v.length} item(s)</span>;
  return <code className="text-[11px]">{JSON.stringify(v).slice(0, 80)}</code>;
}
