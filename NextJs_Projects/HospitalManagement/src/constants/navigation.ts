import { Activity, Bell, Building2, CalendarDays, FileText, FlaskConical, LayoutDashboard, Pill, ReceiptText, ShieldCheck, Stethoscope, Users, type LucideIcon } from 'lucide-react';
import type { Permission } from './permissions';

export interface NavItem { label: string; href: string; segment: string; icon: LucideIcon; permission?: Permission; onlyRole?: 'PATIENT' }
/** Sidebar navigation. `segment` matches useSelectedLayoutSegment() of the (dashboard) layout to highlight the active module. */
export const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', segment: 'dashboard', icon: LayoutDashboard },
  { label: 'Patients', href: '/patients', segment: 'patients', icon: Users, permission: 'patients:read' },
  { label: 'My profile', href: '/patients/me', segment: 'patients-me', icon: Users, onlyRole: 'PATIENT' },
  { label: 'Doctors', href: '/doctors', segment: 'doctors', icon: Stethoscope },
  { label: 'Appointments', href: '/appointments', segment: 'appointments', icon: CalendarDays },
  { label: 'Hospitals', href: '/hospitals', segment: 'hospitals', icon: Building2 },
  { label: 'Medical records', href: '/medical-records', segment: 'medical-records', icon: FileText, permission: 'records:read' },
  { label: 'Prescriptions', href: '/prescriptions', segment: 'prescriptions', icon: Activity, permission: 'prescriptions:read' },
  { label: 'Laboratory', href: '/laboratory', segment: 'laboratory', icon: FlaskConical, permission: 'lab:read' },
  { label: 'Billing', href: '/billing', segment: 'billing', icon: ReceiptText, permission: 'billing:read' },
  { label: 'Pharmacy', href: '/pharmacy', segment: 'pharmacy', icon: Pill, permission: 'pharmacy:access' },
  { label: 'Notifications', href: '/notifications', segment: 'notifications', icon: Bell },
  { label: 'Admin · Users', href: '/admin/users', segment: 'admin', icon: ShieldCheck, permission: 'users:manage' },
];
