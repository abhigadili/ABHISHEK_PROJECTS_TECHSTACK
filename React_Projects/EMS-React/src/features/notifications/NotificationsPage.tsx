import {
  Button,
  Card,
  List,
  ListItemButton,
  ListItemText,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useOptimistic, useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorMessage, Loading } from '@/components/common/Feedback';
import { useListNotificationsQuery, useMarkNotificationsReadMutation } from '@/store/api/emsApi';
import { useAppDispatch } from '@/app/store/hooks';
import { decrementUnread, refreshUnreadCount, setUnread } from '@/store/slices/notificationSlice';
import { usePagination } from '@/hooks/usePagination';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { formatDateTime } from '@/utils/format';
import { errorMessage } from '@/api/errors';
import { notificationTarget } from './target';
import type { AppNotification } from '@/types/api';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { notificationPollMs } = useAppConfig();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const pg = usePagination({ initialLimit: 15 });
  // RTK Query polling: the list refetches itself every N ms while this page is mounted
  const { data, isLoading, isError, error, refetch } = useListNotificationsQuery(
    { unread: tab === 'unread' ? true : undefined, page: pg.page, limit: pg.limit },
    { pollingInterval: notificationPollMs },
  );
  const [markRead] = useMarkNotificationsReadMutation();
  const [, startTransition] = useTransition();

  // useOptimistic: the item looks "read" the instant you click, before the server answers; it rolls back if the request fails
  const [items, markOptimistic] = useOptimistic<AppNotification[], number[] | 'all'>(
    data?.items ?? [],
    (cur, ids) => cur.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, isRead: true } : n)),
  );

  const read = (ids: number[]) =>
    startTransition(async () => {
      markOptimistic(ids);
      dispatch(decrementUnread(ids.length));
      try {
        await markRead(ids).unwrap();
      } finally {
        void dispatch(refreshUnreadCount());
      }
    });
  const readAll = () =>
    startTransition(async () => {
      markOptimistic('all');
      dispatch(setUnread(0));
      try {
        await markRead().unwrap();
      } finally {
        void dispatch(refreshUnreadCount());
      }
    });

  const open = (n: AppNotification) => {
    if (!n.isRead) read([n.id]);
    const to = notificationTarget(n.refType, n.refId);
    if (to) navigate(to);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <Button onClick={readAll} disabled={!items.some((n) => !n.isRead)}>
            Mark all as read
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={(_, v) => {
          setTab(v);
          pg.reset();
        }}
        sx={{ mb: 2 }}
      >
        <Tab value="all" label="All" />
        <Tab value="unread" label="Unread" />
      </Tabs>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorMessage message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <Card>
          {items.length === 0 ? (
            <EmptyState title={tab === 'unread' ? 'No unread notifications' : "You're all caught up"} />
          ) : (
            <List disablePadding>
              {items.map((n) => (
                <ListItemButton
                  key={n.id}
                  onClick={() => open(n)}
                  divider
                  sx={{ bgcolor: n.isRead ? undefined : 'action.hover' }}
                >
                  <ListItemText
                    primary={<Typography fontWeight={n.isRead ? 400 : 700}>{n.title}</Typography>}
                    secondary={`${n.message} · ${formatDateTime(n.createdAt)}`}
                  />
                  {!n.isRead && (
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        read([n.id]);
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </ListItemButton>
              ))}
            </List>
          )}
        </Card>
      )}
      {data && data.meta.totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Pagination count={data.meta.totalPages} page={data.meta.page} onChange={(_, p) => pg.setPage(p)} />
        </Stack>
      )}
    </>
  );
}
