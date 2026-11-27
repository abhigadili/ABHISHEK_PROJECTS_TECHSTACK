import { Routes } from '@angular/router';
import { bookingResolver } from '../../core/services/resolvers';
import { BookingsListStore } from './bookings-list.store';

export const BOOKING_ROUTES: Routes = [
  // route-level provider: the ComponentStore lives (and dies) with this route subtree
  { path: '', pathMatch: 'full', title: 'My bookings · RailBook', providers: [BookingsListStore], loadComponent: () => import('./booking-list.component').then((m) => m.BookingListComponent) },
  { path: ':id', title: 'Booking details · RailBook', resolve: { booking: bookingResolver }, loadComponent: () => import('./booking-detail.component').then((m) => m.BookingDetailComponent) },
  { path: ':id/payment', title: 'Payment · RailBook', resolve: { booking: bookingResolver }, loadComponent: () => import('./payment.component').then((m) => m.PaymentComponent) },
];
