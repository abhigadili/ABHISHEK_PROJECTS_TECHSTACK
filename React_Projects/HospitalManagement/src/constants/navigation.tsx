import type { ReactNode } from 'react';
import {
  Activity, BedDouble, Bell, CalendarDays, ClipboardList, FileText, FlaskConical, LayoutDashboard, Pill, Receipt, Stethoscope, UserRound, Users, Database,
} from 'lucide-react';
import type { Permission } from './permissions';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** visible only when the role holds this permission (undefined = every signed-in user) */
  permission?: Permission;
  /** hide for these roles even if the permission allows it */
  group: 'Care' | 'Clinical' | 'Operations' | 'System';
}

const i = 'h-[18px] w-[18px]';

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className={i} />, group: 'Care' },
  { to: '/appointments', label: 'Appointments', icon: <CalendarDays className={i} />, group: 'Care' },
  { to: '/patients', label: 'Patients', icon: <Users className={i} />, permission: 'patients:read', group: 'Care' },
  { to: '/profile', label: 'My Profile', icon: <UserRound className={i} />, group: 'Care' },
  { to: '/doctors', label: 'Doctors', icon: <Stethoscope className={i} />, group: 'Care' },
  { to: '/hospitals', label: 'Hospitals', icon: <BedDouble className={i} />, group: 'Care' },
  { to: '/records', label: 'Medical Records', icon: <ClipboardList className={i} />, permission: 'records:read', group: 'Clinical' },
  { to: '/prescriptions', label: 'Prescriptions', icon: <FileText className={i} />, permission: 'prescriptions:read', group: 'Clinical' },
  { to: '/lab', label: 'Laboratory', icon: <FlaskConical className={i} />, permission: 'lab:read', group: 'Clinical' },
  { to: '/pharmacy', label: 'Pharmacy', icon: <Pill className={i} />, permission: 'pharmacy:access', group: 'Clinical' },
  { to: '/billing', label: 'Billing', icon: <Receipt className={i} />, permission: 'billing:read', group: 'Operations' },
  { to: '/notifications', label: 'Notifications', icon: <Bell className={i} />, group: 'Operations' },
  { to: '/system/cache', label: 'Cache Monitor', icon: <Database className={i} />, permission: 'system:monitor', group: 'System' },
  { to: '/system/profiler', label: 'Render Profiler', icon: <Activity className={i} />, permission: 'system:monitor', group: 'System' },
];
