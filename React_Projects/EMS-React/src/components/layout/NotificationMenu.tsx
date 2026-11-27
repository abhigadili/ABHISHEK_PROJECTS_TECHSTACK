import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListNotificationsQuery, useMarkNotificationsReadMutation } from '@/store/api/emsApi';
import { useNotifications } from '@/hooks/useNotifications';
import { useAppDispatch } from '@/app/store/hooks';
import { refreshUnreadCount } from '@/store/slices/notificationSlice';
import { Loading } from '@/components/common/Feedback';
import { formatDateTime } from '@/utils/format';
import { notificationTarget } from '@/features/notifications/target';

export function NotificationMenu() {
  const { unread } = useNotifications(); // starts the polling
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { data, isFetching } = useListNotificationsQuery({ limit: 6 }, { skip: !anchor }); // only fetched while the menu is open
  const [markRead] = useMarkNotificationsReadMutation();

  const open = async (id: number, refType: string | null, refId: number | null) => {
    await markRead([id])
      .unwrap()
      .catch(() => undefined);
    void dispatch(refreshUnreadCount());
    setAnchor(null);
    const to = notificationTarget(refType, refId);
    if (to) navigate(to);
  };
  const markAll = async () => {
    await markRead()
      .unwrap()
      .catch(() => undefined);
    void dispatch(refreshUnreadCount());
  };

  return (
    <>
      <IconButton
        color="inherit"
        aria-label={`Notifications (${unread} unread)`}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <Badge badgeContent={unread} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: { xs: 300, sm: 380 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
            <Typography fontWeight={700}>Notifications</Typography>
            <Button size="small" onClick={markAll} disabled={unread === 0}>
              Mark all read
            </Button>
          </Box>
          <Divider />
          {isFetching && !data ? (
            <Loading />
          ) : (
            <List dense disablePadding>
              {(data?.items ?? []).length === 0 && (
                <Typography sx={{ p: 2 }} color="text.secondary">
                  You're all caught up.
                </Typography>
              )}
              {(data?.items ?? []).map((n) => (
                <ListItemButton
                  key={n.id}
                  onClick={() => open(n.id, n.refType, n.refId)}
                  sx={{ bgcolor: n.isRead ? undefined : 'action.hover' }}
                >
                  <ListItemText
                    primary={n.title}
                    secondary={`${n.message} · ${formatDateTime(n.createdAt)}`}
                    primaryTypographyProps={{ fontWeight: n.isRead ? 400 : 700 }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
          <Divider />
          <Button
            fullWidth
            onClick={() => {
              setAnchor(null);
              navigate('/notifications');
            }}
          >
            View all
          </Button>
        </Box>
      </Popover>
    </>
  );
}
