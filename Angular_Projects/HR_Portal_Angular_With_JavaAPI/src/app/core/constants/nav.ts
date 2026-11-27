export interface NavItem { key: string; path: string; icon: string; roles?: string[]; /** ops of which at least one must be allowed */ anyOp?: string[] }
export interface NavGroup { key: string; items: NavItem[] }
const ADMIN = ['HR_ADMIN', 'SUPER_ADMIN'];
/** Role-based menu: an item is shown when the user passes the backend @PreAuthorize rule of ANY of its anyOp operations (or has one of its roles). */
export const NAV: NavGroup[] = [
  { key: 'main', items: [{ key: 'dashboard', path: '/', icon: 'pi-th-large' }] },
  { key: 'people', items: [
    { key: 'employees', path: '/employees', icon: 'pi-users', anyOp: ['employee.search'] },
    { key: 'directory', path: '/directory', icon: 'pi-address-book' },
    { key: 'orgChart', path: '/org-chart', icon: 'pi-sitemap' },
    { key: 'organization', path: '/organization', icon: 'pi-building', roles: ['HR_ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'] },
  ] },
  { key: 'timeLeave', items: [
    { key: 'leave', path: '/leave', icon: 'pi-calendar-plus' }, { key: 'attendance', path: '/attendance', icon: 'pi-clock' },
    { key: 'holidays', path: '/holidays', icon: 'pi-gift' }, { key: 'timesheets', path: '/timesheets', icon: 'pi-stopwatch' },
  ] },
  { key: 'pay', items: [{ key: 'payroll', path: '/payroll', icon: 'pi-wallet' }, { key: 'tax', path: '/tax', icon: 'pi-receipt' }] },
  { key: 'growth', items: [{ key: 'performance', path: '/performance', icon: 'pi-bullseye' }, { key: 'exit', path: '/exit', icon: 'pi-sign-out' }] },
  { key: 'work', items: [
    { key: 'customers', path: '/customers', icon: 'pi-briefcase', anyOp: ['project.listCustomers'] },
    { key: 'projects', path: '/projects', icon: 'pi-folder-open' },
  ] },
  { key: 'content', items: [{ key: 'documents', path: '/documents', icon: 'pi-file' }] },
  { key: 'insight', items: [
    { key: 'approvals', path: '/approvals', icon: 'pi-check-circle' },
    { key: 'reports', path: '/reports', icon: 'pi-chart-bar', roles: ['MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'FINANCE_ADMIN', 'PROJECT_MANAGER', 'SUPER_ADMIN'] },
    { key: 'notifications', path: '/notifications', icon: 'pi-bell' },
  ] },
  { key: 'admin', items: [
    { key: 'users', path: '/admin/users', icon: 'pi-shield', roles: ADMIN }, { key: 'roles', path: '/admin/roles', icon: 'pi-key', roles: ADMIN },
    { key: 'audit', path: '/admin/audit', icon: 'pi-history', roles: ADMIN }, { key: 'notificationAdmin', path: '/admin/notifications', icon: 'pi-envelope', anyOp: ['notification.templates'] },
    { key: 'apiExplorer', path: '/admin/api-explorer', icon: 'pi-share-alt', roles: ADMIN }, { key: 'coverage', path: '/admin/coverage', icon: 'pi-list-check', roles: ADMIN },
  ] },
];
