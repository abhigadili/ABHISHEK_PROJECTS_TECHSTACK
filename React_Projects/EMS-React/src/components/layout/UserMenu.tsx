import { Divider, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfilePicture } from '@/components/common/ProfilePicture';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUser } from '@/contexts/UserContext';
import { useNotify } from '@/contexts/NotificationContext';
import { useGetProfileQuery } from '@/store/api/emsApi';

export function UserMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const me = useCurrentUser();
  const notify = useNotify();
  // the profile says whether a picture exists, so we never request one that would 404 (RTK Query shares this cache with My profile)
  const { data: profile } = useGetProfileQuery();
  const go = (to: string) => {
    setAnchor(null);
    navigate(to);
  };
  const signOut = async () => {
    setAnchor(null);
    await logout();
    notify.info('You have been signed out');
    navigate('/login', { replace: true });
  };
  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Account menu" sx={{ p: 0.5 }}>
        <ProfilePicture
          employeeId={profile ? me.employeeId : null}
          name={me.displayName}
          hasPicture={!!profile?.profilePictureUrl}
          size={34}
        />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled sx={{ opacity: '1 !important', display: 'block' }}>
          <Typography fontWeight={700}>{me.displayName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {me.email} · {me.roleLabel}
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => go('/profile')}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          My profile
        </MenuItem>
        <MenuItem onClick={() => go('/settings')}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem onClick={signOut}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
