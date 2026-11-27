import { Permission } from '../core/models/auth.models';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Item is shown when the user has ANY of these permissions; omitted = everyone. */
  permissions?: readonly Permission[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
  { label: 'Employees', icon: 'groups', route: '/employees' },
  { label: 'Organization', icon: 'account_tree', route: '/organization' },
  { label: 'Departments', icon: 'domain', route: '/departments' },
  { label: 'Designations', icon: 'badge', route: '/designations' },
  { label: 'Attendance', icon: 'schedule', route: '/attendance' },
  { label: 'Leave', icon: 'beach_access', route: '/leaves' },
  { label: 'Calendar & Holidays', icon: 'event', route: '/calendar' },
  { label: 'Reports', icon: 'bar_chart', route: '/reports', permissions: ['report.view'] },
  { label: 'Users & Roles', icon: 'admin_panel_settings', route: '/users', permissions: ['user.manage'] },
];
