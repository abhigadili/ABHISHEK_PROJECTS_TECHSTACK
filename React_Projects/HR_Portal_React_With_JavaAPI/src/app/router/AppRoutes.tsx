import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PublicOnly, RequireAccess, RequireAuth } from './guards';

const L = (f: () => Promise<{ default: React.ComponentType<any> }>) => lazy(f);
const Login = L(() => import('@/features/authentication/LoginPage'));
const Forgot = L(() => import('@/features/authentication/ForgotPasswordPage'));
const Reset = L(() => import('@/features/authentication/ResetPasswordPage'));
const Register = L(() => import('@/features/authentication/RegisterPage'));
const ChangePw = L(() => import('@/features/authentication/ChangePasswordPage'));
const Dashboard = L(() => import('@/features/dashboard/DashboardPage'));
const Employees = L(() => import('@/features/employees/EmployeesPage'));
const EmployeeProfile = L(() => import('@/features/employees/EmployeeProfilePage'));
const Directory = L(() => import('@/features/employees/DirectoryPage'));
const OrgChart = L(() => import('@/features/organization/OrgChartPage'));
const OrgSetup = L(() => import('@/features/organization/OrganizationSetupPage'));
const Leave = L(() => import('@/features/leaves/LeavePage'));
const Holidays = L(() => import('@/features/holidays/HolidaysPage'));
const Attendance = L(() => import('@/features/attendance/AttendancePage'));
const Payroll = L(() => import('@/features/payroll/PayrollPage'));
const Tax = L(() => import('@/features/tax/TaxPage'));
const Performance = L(() => import('@/features/performance/PerformancePage'));
const Customers = L(() => import('@/features/customers/CustomersPage'));
const CustomerDetail = L(() => import('@/features/customers/CustomerDetailPage'));
const Projects = L(() => import('@/features/projects/ProjectsPage'));
const ProjectDetail = L(() => import('@/features/projects/ProjectDetailPage'));
const Timesheets = L(() => import('@/features/timesheets/TimesheetsPage'));
const Exit = L(() => import('@/features/exit-interviews/ExitPage'));
const Documents = L(() => import('@/features/documents/DocumentsPage'));
const Approvals = L(() => import('@/features/approvals/ApprovalsPage'));
const Reports = L(() => import('@/features/reports/ReportsPage'));
const Notifications = L(() => import('@/features/notifications/NotificationsPage'));
const Users = L(() => import('@/features/administration/UsersPage'));
const Roles = L(() => import('@/features/administration/RolesPage'));
const Audit = L(() => import('@/features/administration/AuditPage'));
const NotifAdmin = L(() => import('@/features/administration/NotificationAdminPage'));
const Explorer = L(() => import('@/features/administration/ApiExplorerPage'));
const Coverage = L(() => import('@/features/administration/CoveragePage'));
const Profile = L(() => import('@/features/profile/ProfilePage'));
const Help = L(() => import('@/pages/HelpPage'));
const NotFound = L(() => import('@/pages/NotFoundPage'));

const ADMIN = ['HR_ADMIN', 'SUPER_ADMIN'];
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><Forgot /></PublicOnly>} />
      <Route path="/reset-password" element={<PublicOnly><Reset /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/change-password" element={<ChangePw />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<RequireAccess anyOp={['employee.search']}><Employees /></RequireAccess>} />
        <Route path="employees/:id" element={<EmployeeProfile />} />
        <Route path="directory" element={<Directory />} />
        <Route path="org-chart" element={<OrgChart />} />
        <Route path="organization" element={<RequireAccess roles={['HR_ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN']}><OrgSetup /></RequireAccess>} />
        <Route path="leave" element={<Leave />} />
        <Route path="holidays" element={<Holidays />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="tax" element={<Tax />} />
        <Route path="performance" element={<Performance />} />
        <Route path="customers" element={<RequireAccess anyOp={['project.listCustomers']}><Customers /></RequireAccess>} />
        <Route path="customers/:id" element={<RequireAccess anyOp={['project.getCustomers']}><CustomerDetail /></RequireAccess>} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="exit" element={<Exit />} />
        <Route path="documents" element={<Documents />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="reports" element={<Reports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="help" element={<Help />} />
        <Route path="admin/users" element={<RequireAccess roles={ADMIN}><Users /></RequireAccess>} />
        <Route path="admin/roles" element={<RequireAccess roles={ADMIN}><Roles /></RequireAccess>} />
        <Route path="admin/audit" element={<RequireAccess roles={ADMIN}><Audit /></RequireAccess>} />
        <Route path="admin/notifications" element={<RequireAccess anyOp={['notification.templates']}><NotifAdmin /></RequireAccess>} />
        <Route path="admin/api-explorer" element={<RequireAccess roles={ADMIN}><Explorer /></RequireAccess>} />
        <Route path="admin/coverage" element={<RequireAccess roles={ADMIN}><Coverage /></RequireAccess>} />
        <Route path="admin" element={<Navigate to="/admin/users" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
