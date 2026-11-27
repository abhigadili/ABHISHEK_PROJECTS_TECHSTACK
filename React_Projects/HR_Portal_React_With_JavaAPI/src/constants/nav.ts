import { LayoutDashboard, Users, BookUser, Network, Building2, CalendarDays, Clock, PartyPopper, Timer, Wallet, Receipt, Target, LogOut, Briefcase, FolderKanban, FileText, CheckCheck, BarChart3, Bell, ShieldCheck, KeyRound, History, Mail, Plug, ListChecks, UserCircle, type LucideIcon } from 'lucide-react';

export interface NavItem { key: string; path: string; icon: LucideIcon; roles?: string[]; /** ops of which at least one must be allowed */ anyOp?: string[] }
export interface NavGroup { key: string; items: NavItem[] }
/** Role-based menu: an item is shown when the user passes the backend @PreAuthorize rule of ANY of its anyOp operations (or has one of its roles). */
export const NAV: NavGroup[] = [
  { key: 'main', items: [{ key: 'dashboard', path: '/', icon: LayoutDashboard }] },
  { key: 'people', items: [
    { key: 'employees', path: '/employees', icon: Users, anyOp: ['employee.search'] },
    { key: 'directory', path: '/directory', icon: BookUser },
    { key: 'orgChart', path: '/org-chart', icon: Network },
    { key: 'organization', path: '/organization', icon: Building2, roles: ['HR_ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'] },
  ] },
  { key: 'timeLeave', items: [
    { key: 'leave', path: '/leave', icon: CalendarDays },
    { key: 'attendance', path: '/attendance', icon: Clock },
    { key: 'holidays', path: '/holidays', icon: PartyPopper },
    { key: 'timesheets', path: '/timesheets', icon: Timer },
  ] },
  { key: 'pay', items: [{ key: 'payroll', path: '/payroll', icon: Wallet }, { key: 'tax', path: '/tax', icon: Receipt }] },
  { key: 'growth', items: [{ key: 'performance', path: '/performance', icon: Target }, { key: 'exit', path: '/exit', icon: LogOut }] },
  { key: 'work', items: [
    { key: 'customers', path: '/customers', icon: Briefcase, anyOp: ['project.listCustomers'] },
    { key: 'projects', path: '/projects', icon: FolderKanban },
  ] },
  { key: 'content', items: [{ key: 'documents', path: '/documents', icon: FileText }] },
  { key: 'insight', items: [
    { key: 'approvals', path: '/approvals', icon: CheckCheck },
    { key: 'reports', path: '/reports', icon: BarChart3, roles: ['MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'FINANCE_ADMIN', 'PROJECT_MANAGER', 'SUPER_ADMIN'] },
    { key: 'notifications', path: '/notifications', icon: Bell },
  ] },
  { key: 'admin', items: [
    { key: 'users', path: '/admin/users', icon: ShieldCheck, roles: ['HR_ADMIN', 'SUPER_ADMIN'] },
    { key: 'roles', path: '/admin/roles', icon: KeyRound, roles: ['HR_ADMIN', 'SUPER_ADMIN'] },
    { key: 'audit', path: '/admin/audit', icon: History, roles: ['HR_ADMIN', 'SUPER_ADMIN'] },
    { key: 'notificationAdmin', path: '/admin/notifications', icon: Mail, anyOp: ['notification.templates'] },
    { key: 'apiExplorer', path: '/admin/api-explorer', icon: Plug, roles: ['HR_ADMIN', 'SUPER_ADMIN'] },
    { key: 'coverage', path: '/admin/coverage', icon: ListChecks, roles: ['HR_ADMIN', 'SUPER_ADMIN'] },
  ] },
];
export const PROFILE_ICON = UserCircle;
