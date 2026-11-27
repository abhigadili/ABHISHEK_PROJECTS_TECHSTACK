import { Provider } from '@angular/core';
import { NAV_LINKS, NavLink } from './tokens';
const link = (l: NavLink): Provider => ({ provide: NAV_LINKS, multi: true, useValue: [l] });
/** Multi-providers: each entry contributes ONE navigation item (merged into a single array by the injector). */
export const passengerNav: Provider[] = [
  link({ area: 'passenger', order: 1, label: 'Dashboard', icon: 'dashboard', path: '/app/dashboard' }),
  link({ area: 'passenger', order: 2, label: 'My bookings', icon: 'confirmation_number', path: '/app/bookings' }),
  link({ area: 'passenger', order: 3, label: 'Saved passengers', icon: 'groups', path: '/app/passengers' }),
  link({ area: 'passenger', order: 4, label: 'Payments', icon: 'payments', path: '/app/payments' }),
  link({ area: 'passenger', order: 5, label: 'Refunds', icon: 'currency_rupee', path: '/app/refunds' }),
  link({ area: 'passenger', order: 6, label: 'Notifications', icon: 'notifications', path: '/app/notifications' }),
  link({ area: 'passenger', order: 7, label: 'Profile', icon: 'person', path: '/app/profile' }),
];
export const adminNav: Provider[] = [
  link({ area: 'admin', order: 1, label: 'Dashboard', icon: 'insights', path: '/admin/dashboard', permission: 'stats:read' }),
  link({ area: 'admin', order: 2, label: 'Users', icon: 'manage_accounts', path: '/admin/users', permission: 'user:read' }),
  link({ area: 'admin', order: 3, label: 'Trains', icon: 'train', path: '/admin/trains', permission: 'train:operate' }),
  link({ area: 'admin', order: 4, label: 'Stations', icon: 'location_city', path: '/admin/stations', permission: 'station:manage' }),
  link({ area: 'admin', order: 5, label: 'Routes', icon: 'alt_route', path: '/admin/routes', permission: 'train:operate' }),
  link({ area: 'admin', order: 6, label: 'Schedules', icon: 'calendar_month', path: '/admin/schedules', permission: 'schedule:manage' }),
  link({ area: 'admin', order: 7, label: 'Bookings', icon: 'confirmation_number', path: '/admin/bookings', permission: 'booking:read-all' }),
  link({ area: 'admin', order: 8, label: 'Payments', icon: 'payments', path: '/admin/payments', permission: 'payment:read-all' }),
  link({ area: 'admin', order: 9, label: 'Refunds', icon: 'currency_rupee', path: '/admin/refunds', permission: 'payment:read-all' }),
  link({ area: 'admin', order: 10, label: 'Cancellations', icon: 'cancel', path: '/admin/cancellations', permission: 'payment:read-all' }),
  link({ area: 'admin', order: 11, label: 'Cancellation rules', icon: 'rule', path: '/admin/settings', permission: 'settings:manage' }),
];
