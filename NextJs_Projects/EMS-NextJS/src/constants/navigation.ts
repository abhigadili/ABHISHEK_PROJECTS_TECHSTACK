import type { Permission } from './roles';

export interface NavItem { label: string; href: string; segment: string; permission?: Permission; group: 'Main' | 'People' | 'Time' | 'Insight' | 'Account' }
/** Sidebar entries. `permission` hides what the role can't use — the pages and the API enforce access independently. */
export const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', segment: 'dashboard', group: 'Main' },
  { label: 'Employees', href: '/employees', segment: 'employees', group: 'People' },
  { label: 'Departments', href: '/departments', segment: 'departments', group: 'People' },
  { label: 'Designations', href: '/designations', segment: 'designations', group: 'People' },
  { label: 'Organization', href: '/organization', segment: 'organization', group: 'People' },
  { label: 'Attendance', href: '/attendance', segment: 'attendance', group: 'Time' },
  { label: 'Leave', href: '/leaves', segment: 'leaves', group: 'Time' },
  { label: 'Holidays', href: '/holidays', segment: 'holidays', group: 'Time' },
  { label: 'Reports', href: '/reports', segment: 'reports', permission: 'reports:view', group: 'Insight' },
  { label: 'Users & roles', href: '/users', segment: 'users', permission: 'users:manage', group: 'Insight' },
  { label: 'Notifications', href: '/notifications', segment: 'notifications', group: 'Account' },
  { label: 'My profile', href: '/profile', segment: 'profile', group: 'Account' },
];
