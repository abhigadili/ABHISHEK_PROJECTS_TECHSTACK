import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageLoader } from '@/components/ui/Feedback';
import { AccountLayout } from '@/layouts/AccountLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { GuestRoute, ProtectedRoute, RoleRoute } from './guards';

// Route-level code splitting: each page is its own chunk, loaded on demand behind <Suspense>.
// The lazy() components are created ONCE at module scope - creating them inside render would give React a new component type every time.
const P_Home = lazy(() => import('@/pages/public/Home'));
const P_SearchResults = lazy(() => import('@/pages/public/SearchResults'));
const P_TrainDetail = lazy(() => import('@/pages/public/TrainDetail'));
const P_Login = lazy(() => import('@/pages/public/Login'));
const P_Register = lazy(() => import('@/pages/public/Register'));
const P_ForgotPassword = lazy(() => import('@/pages/public/ForgotPassword'));
const P_ResetPassword = lazy(() => import('@/pages/public/ResetPassword'));
const P_Forbidden = lazy(() => import('@/pages/public/Forbidden'));
const P_ErrorPage = lazy(() => import('@/pages/public/ErrorPage'));
const P_NotFound = lazy(() => import('@/pages/public/NotFound'));
const P_BookingFlow = lazy(() => import('@/pages/passenger/BookingFlow'));
const P_Payment = lazy(() => import('@/pages/passenger/Payment'));
const P_Overview = lazy(() => import('@/pages/passenger/Overview'));
const P_MyBookings = lazy(() => import('@/pages/passenger/MyBookings'));
const P_BookingDetail = lazy(() => import('@/pages/passenger/BookingDetail'));
const P_PnrStatus = lazy(() => import('@/pages/passenger/PnrStatus'));
const P_SavedPassengers = lazy(() => import('@/pages/passenger/SavedPassengers'));
const P_PaymentsHistory = lazy(() => import('@/pages/passenger/PaymentsHistory'));
const P_RefundsHistory = lazy(() => import('@/pages/passenger/RefundsHistory'));
const P_Notifications = lazy(() => import('@/pages/passenger/Notifications'));
const P_Profile = lazy(() => import('@/pages/passenger/Profile'));
const P_Dashboard = lazy(() => import('@/pages/admin/Dashboard'));
const P_Bookings = lazy(() => import('@/pages/admin/Bookings'));
const P_Payments = lazy(() => import('@/pages/admin/Payments'));
const P_Refunds = lazy(() => import('@/pages/admin/Refunds'));
const P_Trains = lazy(() => import('@/pages/admin/Trains'));
const P_Schedules = lazy(() => import('@/pages/admin/Schedules'));
const P_Stations = lazy(() => import('@/pages/admin/Stations'));
const P_Users = lazy(() => import('@/pages/admin/Users'));
const P_CancellationRules = lazy(() => import('@/pages/admin/CancellationRules'));
const S = ({ children }: { children: ReactNode }) => <ErrorBoundary><Suspense fallback={<PageLoader />}>{children}</Suspense></ErrorBoundary>;
const page = (C: React.LazyExoticComponent<React.ComponentType>) => <S><C /></S>;

export function AppRoutes() {
  return useRoutes([
    { element: <PublicLayout />, children: [
      { index: true, element: page(P_Home) },
      { path: 'search', element: page(P_SearchResults) },
      { path: 'trains/:id', element: page(P_TrainDetail) },
      { element: <GuestRoute />, children: [
        { path: 'login', element: page(P_Login) },
        { path: 'register', element: page(P_Register) },
        { path: 'forgot-password', element: page(P_ForgotPassword) },
        { path: 'reset-password', element: page(P_ResetPassword) },
      ] },
      { path: '403', element: page(P_Forbidden) },
      { path: '500', element: page(P_ErrorPage) },
      { path: '*', element: page(P_NotFound) },
    ] },
    { element: <ProtectedRoute />, children: [
      { path: 'book', element: <PublicLayout />, children: [
        { index: true, element: page(P_BookingFlow) },
        { path: ':bookingId/pay', element: page(P_Payment) },
      ] },
      { path: 'account', element: <AccountLayout />, children: [
        { index: true, element: page(P_Overview) },
        { path: 'bookings', element: page(P_MyBookings) },
        { path: 'bookings/:id', element: page(P_BookingDetail) },
        { path: 'pnr', element: page(P_PnrStatus) },
        { path: 'passengers', element: page(P_SavedPassengers) },
        { path: 'payments', element: page(P_PaymentsHistory) },
        { path: 'refunds', element: page(P_RefundsHistory) },
        { path: 'notifications', element: page(P_Notifications) },
        { path: 'profile', element: page(P_Profile) },
      ] },
      { element: <RoleRoute roles={['ADMIN', 'BOOKING_STAFF', 'TRAIN_OPERATOR']} />, children: [
        { path: 'admin', element: <AdminLayout />, children: [
          { index: true, element: page(P_Dashboard) },
          { element: <RoleRoute roles={['ADMIN', 'BOOKING_STAFF']} />, children: [
            { path: 'bookings', element: page(P_Bookings) },
            { path: 'payments', element: page(P_Payments) },
            { path: 'refunds', element: page(P_Refunds) },
          ] },
          { element: <RoleRoute roles={['ADMIN', 'TRAIN_OPERATOR']} />, children: [
            { path: 'trains', element: page(P_Trains) },
            { path: 'schedules', element: page(P_Schedules) },
          ] },
          { element: <RoleRoute roles={['ADMIN']} />, children: [
            { path: 'stations', element: page(P_Stations) },
            { path: 'users', element: page(P_Users) },
            { path: 'cancellation-rules', element: page(P_CancellationRules) },
          ] },
        ] },
      ] },
    ] },
    { path: 'home', element: <Navigate to="/" replace /> },
  ]);
}
