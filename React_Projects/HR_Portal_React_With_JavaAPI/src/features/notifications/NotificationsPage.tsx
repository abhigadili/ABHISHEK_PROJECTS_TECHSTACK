import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { SafeHtml } from '@/components/editors/SafeHtml';
import { useOp, useOpMutation } from '@/components/op/useOp';
import { useFormat } from '@/contexts/LanguageContext';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { usePermissions } from '@/hooks/usePermissions';

const ROUTE: Record<string, string> = { LEAVE: '/leave', LEAVE_APPLICATION: '/leave', TIMESHEET: '/timesheets', PAYSLIP: '/payroll', PAYROLL: '/payroll', TAX: '/tax', DOCUMENT: '/documents', REVIEW: '/performance', PERFORMANCE: '/performance', RESIGNATION: '/exit', EXIT: '/exit', ATTENDANCE: '/attendance', PROJECT: '/projects', EMPLOYEE: '/employees' };
export default function NotificationsPage() {
  const { t } = useTranslation(); const f = useFormat(); const [unreadOnly, setUnread] = useState(false); const [type, setType] = useState(''); const [page, setPage] = useState(0);
  const { canCall } = usePermissions();
  const q = useOp<any>('notification.inbox', { query: { unreadOnly: unreadOnly || undefined, page, size: 15 } }, { enabled: canCall('notification.inbox') });
  const read = useOpMutation('notification.read', { successMessage: false }); const readAll = useOpMutation('notification.readAll', { successMessage: t('common.done') });
  const rows: any[] = (q.data?.content ?? []).filter((n: any) => !type || n.type === type);
  const types = [...new Set<string>((q.data?.content ?? []).map((n: any) => n.type))];
  return (
    <>
      <PageHeader title={t('hr.notifications.title')} description={t('hr.notifications.sub')} icon={<Bell size={20} />}
        actions={<><NativeSelect className="w-auto" value={unreadOnly ? 'u' : 'a'} onChange={(e) => { setUnread(e.target.value === 'u'); setPage(0); }} aria-label="filter"><option value="a">{t('common.all')}</option><option value="u">{t('common.unread')}</option></NativeSelect>
          <NativeSelect className="w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="type"><option value="">{t('common.all')} · type</option>{types.map((x) => <option key={x}>{x}</option>)}</NativeSelect>
          <Button variant="outline" onClick={() => readAll.mutate({})} loading={readAll.isPending}><CheckCheck size={15} />{t('common.markAllRead')}</Button></>} />
      <Card><CardBody className="p-0">
        {!canCall('notification.inbox') ? <EmptyState title={t('common.notAuthorized')} hint="Your account is not linked to an employee record, so it has no personal inbox." /> : q.isLoading ? <LoadingBlock /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !rows.length ? <EmptyState /> : rows.map((n) => (
          <div key={n.id} className={cn('d-flex gap-3 border-bottom p-3', !n.readAt && 'bg-primary-soft/40')} style={{ borderColor: 'var(--hr-border)' }}>
            <div className="mt-1">{!n.readAt ? <span className="d-inline-block rounded-full bg-primary" style={{ width: 8, height: 8 }} /> : <span style={{ width: 8, display: 'inline-block' }} />}</div>
            <div className="flex-grow-1"><div className="d-flex gap-2 align-items-center"><strong style={{ fontSize: 14 }}>{n.subject ?? n.type}</strong><Badge tone="neutral">{n.type}</Badge><Badge tone="info">{n.channel}</Badge></div>
              <div style={{ fontSize: 13 }}><SafeHtml html={n.body} /></div><div className="text-muted" style={{ fontSize: 11 }}>{f.dateTime(n.createdAt)}{ROUTE[String(n.referenceType).toUpperCase()] && <> · <Link to={ROUTE[String(n.referenceType).toUpperCase()]}>{t('common.open')} →</Link></>}</div></div>
            {!n.readAt && <Button size="sm" variant="outline" onClick={() => read.mutate({ path: { id: n.id } })}>{t('common.read')}</Button>}
          </div>))}
        <div className="d-flex justify-content-between p-2"><Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('common.previous')}</Button><span className="text-muted align-self-center" style={{ fontSize: 12 }}>{t('common.page')} {page + 1} {t('common.of')} {Math.max(1, q.data?.totalPages ?? 1)}</span><Button size="sm" variant="ghost" disabled={page + 1 >= (q.data?.totalPages ?? 1)} onClick={() => setPage(page + 1)}>{t('common.next')}</Button></div>
      </CardBody></Card>
    </>
  );
}
