import { Routes } from '@angular/router';
import { permissionGuard, unsavedChangesGuard } from '../../core/guards/guards';
import { trainResolver } from '../../core/services/resolvers';
import { BookingsListStore } from '../bookings/bookings-list.store';

const T = 'Back office · ';
/** Lazy-loaded back-office routes. `permissionGuard` (canActivateChild) reads `data.permissions` on every child; the backend re-checks each API call. */
export const ADMIN_ROUTES: Routes = [
  {
    path: '', canActivateChild: [permissionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: T + 'Dashboard', data: { permissions: ['stats:read'] }, loadComponent: () => import('./admin-dashboard.component').then((m) => m.AdminDashboardComponent) },
      { path: 'users', title: T + 'Users', data: { permissions: ['user:read'] }, loadComponent: () => import('./users.component').then((m) => m.UsersComponent) },
      { path: 'trains', title: T + 'Trains', data: { permissions: ['train:operate', 'train:manage'] }, loadComponent: () => import('./trains-admin.component').then((m) => m.TrainsAdminComponent) },
      { path: 'trains/new', title: T + 'New train', data: { permissions: ['train:manage'] }, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./train-form.component').then((m) => m.TrainFormComponent) },
      { path: 'trains/:id', title: T + 'Train', data: { permissions: ['train:operate', 'train:manage'] }, resolve: { train: trainResolver }, runGuardsAndResolvers: 'paramsOrQueryParamsChange', loadComponent: () => import('./train-admin-detail.component').then((m) => m.TrainAdminDetailComponent) },
      { path: 'trains/:id/edit', title: T + 'Edit train', data: { permissions: ['train:manage'] }, resolve: { train: trainResolver }, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./train-form.component').then((m) => m.TrainFormComponent) },
      { path: 'stations', title: T + 'Stations', data: { permissions: ['station:manage'] }, loadComponent: () => import('./stations-admin.component').then((m) => m.StationsAdminComponent) },
      { path: 'routes', title: T + 'Routes', data: { permissions: ['train:operate', 'train:manage'] }, loadComponent: () => import('./routes-admin.component').then((m) => m.RoutesAdminComponent) },
      { path: 'routes/new', title: T + 'New route', data: { permissions: ['train:manage'] }, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./route-form-page.component').then((m) => m.RouteFormPageComponent) },
      { path: 'routes/:id/edit', title: T + 'Edit route', data: { permissions: ['train:manage'] }, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./route-form-page.component').then((m) => m.RouteFormPageComponent) },
      { path: 'schedules', title: T + 'Schedules', data: { permissions: ['schedule:manage'] }, loadComponent: () => import('./schedules-admin.component').then((m) => m.SchedulesAdminComponent) },
      { path: 'bookings', title: T + 'Bookings', data: { permissions: ['booking:read-all'], heading: 'All bookings' }, providers: [BookingsListStore], loadComponent: () => import('../bookings/booking-list.component').then((m) => m.BookingListComponent) },
      { path: 'payments', title: T + 'Payments', data: { permissions: ['payment:read-all'] }, loadComponent: () => import('../payments/payment-history.component').then((m) => m.PaymentHistoryComponent) },
      { path: 'refunds', title: T + 'Refunds', data: { permissions: ['payment:read-all'] }, loadComponent: () => import('../refunds/refund-list.component').then((m) => m.RefundListComponent) },
      { path: 'cancellations', title: T + 'Cancellations', data: { permissions: ['payment:read-all'] }, loadComponent: () => import('./cancellations-admin.component').then((m) => m.CancellationsAdminComponent) },
      { path: 'settings', title: T + 'Cancellation rules', data: { permissions: ['settings:manage'] }, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./settings-admin.component').then((m) => m.SettingsAdminComponent) },
    ],
  },
];
