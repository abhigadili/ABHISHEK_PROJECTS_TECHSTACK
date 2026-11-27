import type { ReactNode } from 'react';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import PeopleIcon from '@mui/icons-material/People';
import ApartmentIcon from '@mui/icons-material/Apartment';
import BadgeIcon from '@mui/icons-material/Badge';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import CelebrationIcon from '@mui/icons-material/Celebration';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ScienceIcon from '@mui/icons-material/Science';
import SettingsIcon from '@mui/icons-material/Settings';
import type { Permission } from './roles';

export interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  permission?: Permission;
  section: 'main' | 'people' | 'time' | 'insight' | 'admin';
}

/** Sidebar entries; `permission` hides what the role can't use (the backend still enforces access). */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <DashboardIcon />, section: 'main' },
  { label: 'Employees', to: '/employees', icon: <PeopleIcon />, section: 'people' },
  { label: 'Departments', to: '/departments', icon: <ApartmentIcon />, section: 'people' },
  { label: 'Designations', to: '/designations', icon: <BadgeIcon />, section: 'people' },
  { label: 'Organization', to: '/organization', icon: <AccountTreeIcon />, section: 'people' },
  { label: 'Attendance', to: '/attendance', icon: <EventAvailableIcon />, section: 'time' },
  { label: 'Leave', to: '/leaves', icon: <BeachAccessIcon />, section: 'time' },
  { label: 'Holidays', to: '/holidays', icon: <CelebrationIcon />, section: 'time' },
  {
    label: 'Reports',
    to: '/reports',
    icon: <AssessmentIcon />,
    permission: 'reports:view',
    section: 'insight',
  },
  {
    label: 'Users & roles',
    to: '/users',
    icon: <ManageAccountsIcon />,
    permission: 'users:manage',
    section: 'admin',
  },
  { label: 'Notifications', to: '/notifications', icon: <NotificationsIcon />, section: 'admin' },
  { label: 'React Lab', to: '/lab', icon: <ScienceIcon />, section: 'admin' },
  { label: 'Settings', to: '/settings', icon: <SettingsIcon />, section: 'admin' },
];

export const SECTION_TITLES: Record<NavItem['section'], string> = {
  main: '',
  people: 'People',
  time: 'Time',
  insight: 'Insight',
  admin: 'Account',
};
