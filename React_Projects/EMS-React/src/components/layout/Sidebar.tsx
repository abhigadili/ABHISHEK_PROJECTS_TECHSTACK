import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
} from '@mui/material';
import { Fragment, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, SECTION_TITLES, type NavItem } from '@/constants/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { DRAWER_WIDTH } from './Header';

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = usePermissions();
  // derived data → useMemo, not state + effect
  const groups = useMemo(() => {
    const visible = NAV_ITEMS.filter((i) => !i.permission || can(i.permission));
    const map = new Map<NavItem['section'], NavItem[]>();
    visible.forEach((i) => map.set(i.section, [...(map.get(i.section) ?? []), i]));
    return [...map.entries()];
  }, [can]);
  return (
    <List component="nav" aria-label="Main navigation" dense>
      {groups.map(([section, items], idx) => (
        <Fragment key={section}>
          {idx > 0 && <Divider sx={{ my: 1 }} />}
          {SECTION_TITLES[section] && (
            <ListSubheader sx={{ bgcolor: 'transparent', lineHeight: '28px' }}>
              {SECTION_TITLES[section]}
            </ListSubheader>
          )}
          {items.map((i) => (
            // NavLink adds the `active` class + aria-current automatically for the current route
            <ListItemButton
              key={i.to}
              component={NavLink}
              to={i.to}
              onClick={onNavigate}
              sx={{
                mx: 1,
                borderRadius: 2,
                '&.active': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': { color: 'inherit' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38 }}>{i.icon}</ListItemIcon>
              <ListItemText primary={i.label} />
            </ListItemButton>
          ))}
        </Fragment>
      ))}
    </List>
  );
}

/** Responsive sidebar: permanent from `md` up, a temporary slide-over drawer on phones/tablets. */
export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  return (
    <Box component="aside" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        <Toolbar />
        <NavList onNavigate={onClose} />
      </Drawer>
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <NavList />
      </Drawer>
    </Box>
  );
}
