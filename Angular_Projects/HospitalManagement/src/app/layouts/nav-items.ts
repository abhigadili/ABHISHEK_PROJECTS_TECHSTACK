import { Provider } from '@angular/core';
import { NAV_ITEMS, type NavItem } from '../core/configuration/app-config';

/** Multi providers: each feature area contributes ONE entry; Angular collects them into `NAV_ITEMS: NavItem[]`. */
const item = (i: NavItem): Provider => ({ provide: NAV_ITEMS, useValue: i, multi: true });

export const NAV_PROVIDERS: Provider[] = [
  item({ path: '/dashboard', label: 'Dashboard', icon: 'dashboard', group: 'Care' }),
  item({ path: '/appointments', label: 'Appointments', icon: 'event', group: 'Care' }),
  item({ path: '/patients', label: 'Patients', icon: 'groups', group: 'Care', permission: 'patients:read' }),
  item({ path: '/profile', label: 'My Profile', icon: 'person', group: 'Care' }),
  item({ path: '/doctors', label: 'Doctors', icon: 'medical_services', group: 'Care' }),
  item({ path: '/hospitals', label: 'Hospitals', icon: 'local_hospital', group: 'Care' }),
  item({ path: '/records', label: 'Medical Records', icon: 'folder_shared', group: 'Clinical', permission: 'records:read' }),
  item({ path: '/prescriptions', label: 'Prescriptions', icon: 'description', group: 'Clinical', permission: 'prescriptions:read' }),
  item({ path: '/lab', label: 'Laboratory', icon: 'science', group: 'Clinical', permission: 'lab:read' }),
  item({ path: '/pharmacy', label: 'Pharmacy', icon: 'medication', group: 'Clinical', permission: 'pharmacy:access' }),
  item({ path: '/billing', label: 'Billing', icon: 'receipt_long', group: 'Operations', permission: 'billing:read' }),
  item({ path: '/notifications', label: 'Notifications', icon: 'notifications', group: 'Operations' }),
  item({ path: '/admin/users', label: 'User accounts', icon: 'admin_panel_settings', group: 'Administration', permission: 'users:manage' }),
];
