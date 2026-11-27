import { AppBar, IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { NotificationMenu } from './NotificationMenu';
import { UserMenu } from './UserMenu';
import { useThemeMode } from '@/contexts/ThemeContext';
import { useAppConfig } from '@/contexts/AppConfigContext';

export const DRAWER_WIDTH = 248;

export function Header({ onMenu }: { onMenu: () => void }) {
  const { mode, toggle } = useThemeMode();
  const { appName } = useAppConfig();
  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{ zIndex: (t) => t.zIndex.drawer + 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenu}
          aria-label="Open navigation"
          sx={{ mr: 1, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {appName}{' '}
          <Typography component="span" variant="body2" sx={{ opacity: 0.8 }}>
            Employee Management
          </Typography>
        </Typography>
        <Tooltip title={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          <IconButton color="inherit" onClick={toggle} aria-label="Toggle theme">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Tooltip>
        <NotificationMenu />
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
