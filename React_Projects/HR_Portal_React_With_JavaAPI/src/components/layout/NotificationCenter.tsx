import { useState } from 'react';
import { Popover, Tooltip } from '@mui/material';
import { Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useOp, useOpMutation } from '@/components/op/useOp';
import { useFormat } from '@/contexts/LanguageContext';
import { EmptyState } from '@/components/feedback/states';
import { usePermissions } from '@/hooks/usePermissions';
import { SafeHtml } from '@/components/editors/SafeHtml';
import type { NotificationResponse, UnreadCount } from '@/api/types/notification';

export function NotificationCenter() {
  const { t } = useTranslation(); const f = useFormat(); const [a, setA] = useState<HTMLElement | null>(null); const { canCall } = usePermissions(); const on = canCall('notification.unread');
  const count = useOp<UnreadCount>('notification.unread', undefined, { refetchInterval: 30_000, staleTime: 15_000, enabled: on });
  const inbox = useOp<{ content: NotificationResponse[] }>('notification.inbox', { query: { size: 8 } }, { enabled: !!a && on });
  const read = useOpMutation('notification.read', { successMessage: false });
  const readAll = useOpMutation('notification.readAll', { successMessage: t('common.done') });
  const n = count.data?.unread ?? 0;
  if (!on) return null;
  return (
    <>
      <Tooltip title={t('common.notifications')}>
        <Button variant="ghost" size="icon" className="relative" onClick={(e) => setA(e.currentTarget)} aria-label={t('common.notifications')}>
          <Bell size={17} />{n > 0 && <span className="absolute right-0.5 top-0.5 min-w-[16px] rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white">{n > 99 ? '99+' : n}</span>}
        </Button>
      </Tooltip>
      <Popover open={!!a} anchorEl={a} onClose={() => setA(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { width: 360, maxWidth: '92vw' } } }}>
        <div className="flex items-center justify-between border-b border-border px-3 py-2"><strong className="text-sm">{t('common.notifications')}</strong>
          <Button size="sm" variant="ghost" onClick={() => readAll.mutate({})} loading={readAll.isPending}><CheckCheck size={14} />{t('common.markAllRead')}</Button></div>
        <div style={{ maxHeight: 380, overflow: 'auto' }}>
          {inbox.data?.content?.length ? inbox.data.content.map((x) => (
            <button key={x.id} className="block w-full border-0 border-b border-border bg-transparent px-3 py-2 text-left hover:bg-surface-2" onClick={() => { if (!x.readAt) read.mutate({ path: { id: x.id! } }); }}>
              <div className="flex items-center gap-2 text-[13px]">{!x.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}<span className={x.readAt ? '' : 'font-semibold'}>{x.subject ?? x.type}</span></div>
              <div className="line-clamp-2 text-xs text-muted"><SafeHtml html={x.body} /></div>
              <div className="mt-0.5 text-[11px] text-muted">{f.dateTime(x.createdAt)}</div>
            </button>
          )) : <EmptyState title={t('common.noData')} hint="" />}
        </div>
        <div className="p-2 text-center"><Link to="/notifications" onClick={() => setA(null)} className="text-xs">{t('nav.notifications')} →</Link></div>
      </Popover>
    </>
  );
}
