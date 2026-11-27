import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/auth.guards';

/** Notifications: every signed-in role may read their own; sending is `notifications:admin`. Route data `unread` is bound to the list's input. */
export const NOTIFICATION_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./notification-list.component').then((m) => m.NotificationListComponent), data: { breadcrumb: 'Notifications', unread: false } },
  { path: 'unread', loadComponent: () => import('./notification-list.component').then((m) => m.NotificationListComponent), data: { breadcrumb: 'Unread', unread: true } },
  { path: 'send', canActivate: [permissionGuard('notifications:admin')], loadComponent: () => import('./notification-send.component').then((m) => m.NotificationSendComponent), data: { breadcrumb: 'Send' } },
  { path: ':id', loadComponent: () => import('./notification-details.component').then((m) => m.NotificationDetailsComponent), data: { breadcrumb: 'Details' } },
];
