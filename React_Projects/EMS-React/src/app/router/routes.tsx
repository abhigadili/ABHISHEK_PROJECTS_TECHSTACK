import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from 'react-router-dom';
import type { AppStore } from '@/app/store/store';
import { AppLayout } from '@/components/layout/AppLayout';
import { GuestOnly, ProtectedRoute, RequireAuth } from '@/features/auth/guards';
import { NotFoundPage, RouteError, UnauthorizedPage } from '@/features/auth/StatusPages';
import { departmentStatusAction, employeeLoader } from './loaders';
import type { UIMatch } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loading } from '@/components/common/Feedback';

/** Guest pages are lazy chunks too. `lazy()` MUST be called at module level (never during render) or the component would remount every render. */
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'));
const Guest = ({ children }: { children: React.ReactNode }) => (
  <GuestOnly>
    <Suspense fallback={<Loading page />}>{children}</Suspense>
  </GuestOnly>
);

/** Lazy route helper: the page's chunk is downloaded only when the route is first visited (code splitting via dynamic import). */
const lazyPage = (importer: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await importer()).default,
});
const crumb = (label: string) => ({ crumb: label });
const idCrumb = (prefix: string) => ({
  crumb: (m: UIMatch) => `${prefix} #${m.params.id ?? m.params.employeeId}`,
});

export function buildRoutes(store: AppStore): RouteObject[] {
  const employeeRoutes: RouteObject = {
    path: 'employees',
    handle: crumb('Employees'),
    children: [
      { index: true, lazy: lazyPage(() => import('@/features/employees/EmployeeListPage')) },
      {
        path: 'new',
        handle: crumb('New'),
        element: <ProtectedRoute permission="employee:manage" />,
        children: [{ index: true, lazy: lazyPage(() => import('@/features/employees/EmployeeFormPage')) }],
      },
      {
        // layout route + dynamic segment + loader: everything under /employees/:id shares ONE data fetch and one <Outlet/>
        path: ':id',
        handle: idCrumb('Employee'),
        loader: employeeLoader(store),
        errorElement: <RouteError />,
        lazy: lazyPage(() => import('@/features/employees/EmployeeLayout')),
        children: [
          { index: true, lazy: lazyPage(() => import('@/features/employees/EmployeeOverview')) },
          {
            path: 'profile',
            handle: crumb('Profile'),
            lazy: lazyPage(() => import('@/features/employees/EmployeeProfileTab')),
          },
          {
            path: 'job-history',
            handle: crumb('Job history'),
            lazy: lazyPage(() => import('@/features/employees/JobHistoryTab')),
          },
          {
            path: 'edit',
            handle: crumb('Edit'),
            element: <ProtectedRoute permission="employee:manage" />,
            children: [
              { index: true, lazy: lazyPage(() => import('@/features/employees/EmployeeFormPage')) },
            ],
          },
        ],
      },
    ],
  };

  return [
    {
      path: '/login',
      element: (
        <Guest>
          <LoginPage />
        </Guest>
      ),
    },
    {
      path: '/register',
      element: (
        <Guest>
          <RegisterPage />
        </Guest>
      ),
    },
    {
      path: '/forgot-password',
      element: (
        <Guest>
          <ForgotPasswordPage />
        </Guest>
      ),
    },
    {
      path: '/reset-password',
      element: (
        <Guest>
          <ResetPasswordPage />
        </Guest>
      ),
    },
    {
      path: '/',
      element: (
        <RequireAuth>
          <AppLayout />
        </RequireAuth>
      ),
      errorElement: <RouteError />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> }, // redirect
        {
          path: 'dashboard',
          handle: crumb('Dashboard'),
          lazy: lazyPage(() => import('@/features/dashboard/DashboardPage')),
        },
        employeeRoutes,
        {
          path: 'departments',
          handle: crumb('Departments'),
          children: [
            { index: true, lazy: lazyPage(() => import('@/features/departments/DepartmentListPage')) },
            {
              path: 'new',
              handle: crumb('New'),
              element: <ProtectedRoute permission="department:manage" />,
              children: [
                { index: true, lazy: lazyPage(() => import('@/features/departments/DepartmentFormPage')) },
              ],
            },
            {
              path: ':id',
              handle: idCrumb('Department'),
              lazy: lazyPage(() => import('@/features/departments/DepartmentDetailPage')),
            },
            {
              path: ':id/edit',
              handle: idCrumb('Edit department'),
              element: <ProtectedRoute permission="department:manage" />,
              children: [
                { index: true, lazy: lazyPage(() => import('@/features/departments/DepartmentFormPage')) },
              ],
            },
            { path: ':id/status', action: departmentStatusAction(store) }, // action-only route (no UI)
          ],
        },
        {
          path: 'designations',
          handle: crumb('Designations'),
          lazy: lazyPage(() => import('@/features/designations/DesignationsPage')),
        },
        {
          path: 'organization',
          handle: crumb('Organization'),
          children: [
            { index: true, lazy: lazyPage(() => import('@/features/organization/OrganizationPage')) },
            {
              path: ':employeeId',
              handle: idCrumb('Employee'),
              lazy: lazyPage(() => import('@/features/organization/ReportingChainPage')),
            },
          ],
        },
        {
          path: 'attendance',
          handle: crumb('Attendance'),
          children: [
            { index: true, lazy: lazyPage(() => import('@/features/attendance/AttendancePage')) },
            {
              path: 'calendar',
              handle: crumb('Calendar'),
              lazy: lazyPage(() => import('@/features/attendance/AttendanceCalendarPage')),
            },
            {
              path: 'reports',
              handle: crumb('Reports'),
              element: <ProtectedRoute permission="attendance:view-reports" />,
              children: [
                { index: true, lazy: lazyPage(() => import('@/features/attendance/AttendanceReportsPage')) },
              ],
            },
            {
              path: ':id',
              handle: idCrumb('Record'),
              lazy: lazyPage(() => import('@/features/attendance/AttendanceDetailPage')),
            },
          ],
        },
        {
          path: 'leaves',
          handle: crumb('Leave'),
          children: [
            { index: true, lazy: lazyPage(() => import('@/features/leaves/LeavePage')) },
            {
              path: 'apply',
              handle: crumb('Apply'),
              lazy: lazyPage(() => import('@/features/leaves/LeaveApplyPage')),
            },
            {
              path: 'calendar',
              handle: crumb('Calendar'),
              lazy: lazyPage(() => import('@/features/leaves/LeaveCalendarPage')),
            },
            {
              path: 'approvals',
              handle: crumb('Approvals'),
              element: <ProtectedRoute allowedRoles={['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN']} />,
              children: [
                { index: true, lazy: lazyPage(() => import('@/features/leaves/LeaveApprovalsPage')) },
              ],
            },
            {
              path: 'admin',
              handle: crumb('Administration'),
              element: <ProtectedRoute permission="leave:administer" />,
              children: [{ index: true, lazy: lazyPage(() => import('@/features/leaves/LeaveAdminPage')) }],
            },
            {
              path: ':id',
              handle: idCrumb('Request'),
              lazy: lazyPage(() => import('@/features/leaves/LeaveDetailPage')),
            },
          ],
        },
        {
          path: 'holidays',
          handle: crumb('Holidays'),
          lazy: lazyPage(() => import('@/features/holidays/HolidaysPage')),
        },
        {
          path: 'reports',
          handle: crumb('Reports'),
          element: <ProtectedRoute permission="reports:view" />,
          children: [{ index: true, lazy: lazyPage(() => import('@/features/reports/ReportsPage')) }],
        },
        {
          path: 'notifications',
          handle: crumb('Notifications'),
          lazy: lazyPage(() => import('@/features/notifications/NotificationsPage')),
        },
        {
          path: 'users',
          handle: crumb('Users & roles'),
          element: <ProtectedRoute permission="users:manage" />,
          children: [{ index: true, lazy: lazyPage(() => import('@/features/users/UsersPage')) }],
        },
        {
          path: 'profile',
          handle: crumb('My profile'),
          lazy: lazyPage(() => import('@/features/profile/MyProfilePage')),
        },
        {
          path: 'settings',
          handle: crumb('Settings'),
          lazy: lazyPage(() => import('@/features/settings/SettingsPage')),
        },
        { path: 'lab', handle: crumb('React Lab'), lazy: lazyPage(() => import('@/features/lab/LabPage')) },
        { path: 'unauthorized', element: <UnauthorizedPage /> },
        { path: '*', element: <NotFoundPage /> }, // wildcard inside the layout
      ],
    },
    { path: '*', element: <NotFoundPage /> },
  ];
}

export const createAppRouter = (store: AppStore) => createBrowserRouter(buildRoutes(store));
export const createTestRouter = (store: AppStore, initialEntries: string[]) =>
  createMemoryRouter(buildRoutes(store), { initialEntries });
