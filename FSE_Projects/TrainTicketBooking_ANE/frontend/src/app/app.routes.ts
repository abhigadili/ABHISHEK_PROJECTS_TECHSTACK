import { Routes } from '@angular/router';
import { adminNav, passengerNav } from './core/config/nav';
import { authGuard, backOfficeGuard, guestGuard } from './core/guards/guards';
import { stationResolver, trainResolver } from './core/services/resolvers';
import { AdminLayoutComponent } from './layout/admin-layout/admin-layout.component';
import { AuthLayoutComponent } from './layout/auth-layout/auth-layout.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { PassengerLayoutComponent } from './layout/passenger-layout/passenger-layout.component';

const TITLE = 'RailBook';
export const routes: Routes = [
  {
    path: '', component: MainLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', title: `${TITLE} · Search trains`, loadComponent: () => import('./features/trains/home.component').then((m) => m.HomeComponent) },
      { path: 'search', title: `${TITLE} · Search results`, loadComponent: () => import('./features/trains/search-results.component').then((m) => m.SearchResultsComponent) },
      { path: 'trains', title: `${TITLE} · Trains`, loadComponent: () => import('./features/trains/train-list.component').then((m) => m.TrainListComponent) },
      { path: 'trains/:id', title: `${TITLE} · Train details`, resolve: { train: trainResolver }, runGuardsAndResolvers: 'paramsChange', loadComponent: () => import('./features/trains/train-detail.component').then((m) => m.TrainDetailComponent) },
      { path: 'stations', title: `${TITLE} · Stations`, loadComponent: () => import('./features/stations/station-list.component').then((m) => m.StationListComponent) },
      { path: 'stations/:id', title: `${TITLE} · Station`, resolve: { station: stationResolver }, loadComponent: () => import('./features/stations/station-detail.component').then((m) => m.StationDetailComponent) },
      { path: 'pnr', canActivate: [authGuard], title: `${TITLE} · PNR status`, loadComponent: () => import('./features/bookings/pnr-status.component').then((m) => m.PnrStatusComponent) },
    ],
  },
  { path: 'auth', component: AuthLayoutComponent, canActivate: [guestGuard], loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES) },
  { path: 'login', redirectTo: 'auth/login' },
  { path: 'register', redirectTo: 'auth/register' },
  { path: 'reset-password', redirectTo: 'auth/reset-password' }, // the e-mailed link points here
  {
    path: 'app', component: PassengerLayoutComponent, canActivate: [authGuard], providers: [...passengerNav],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: `${TITLE} · Dashboard`, loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'book', title: `${TITLE} · Book tickets`, loadComponent: () => import('./features/bookings/booking-wizard.component').then((m) => m.BookingWizardComponent) },
      { path: 'bookings', loadChildren: () => import('./features/bookings/bookings.routes').then((m) => m.BOOKING_ROUTES) },
      { path: 'passengers', loadChildren: () => import('./features/passengers/passengers.routes').then((m) => m.PASSENGER_ROUTES) },
      { path: 'payments', title: `${TITLE} · Payments`, loadComponent: () => import('./features/payments/payment-history.component').then((m) => m.PaymentHistoryComponent) },
      { path: 'payments/:id/receipt', title: `${TITLE} · Receipt`, loadComponent: () => import('./features/payments/receipt.component').then((m) => m.ReceiptComponent) },
      { path: 'refunds', title: `${TITLE} · Refunds`, loadComponent: () => import('./features/refunds/refund-list.component').then((m) => m.RefundListComponent) },
      { path: 'notifications', title: `${TITLE} · Notifications`, loadComponent: () => import('./features/notifications/notification-list.component').then((m) => m.NotificationListComponent) },
      { path: 'profile', loadChildren: () => import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES) },
    ],
  },
  {
    path: 'admin', component: AdminLayoutComponent, canActivate: [authGuard, backOfficeGuard], providers: [...adminNav],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '**', title: `${TITLE} · Not found`, loadComponent: () => import('./features/not-found.component').then((m) => m.NotFoundComponent) },
];
