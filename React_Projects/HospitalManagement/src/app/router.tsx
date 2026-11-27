import { lazy, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { withAuth, withPermission, withRoles } from '@/components/hoc/withAccess';
import AuthLayout from '@/layouts/AuthLayout';
import AppLayout from '@/layouts/AppLayout';
import { AccessDeniedPage, NotFoundPage, UnauthorizedPage } from '@/features/authentication/pages/AccessPages';

/**
 * Route-based code splitting: every page is a separate chunk loaded on first navigation (React.lazy + dynamic import);
 * <Suspense> boundaries live in the layouts. `named()` adapts modules that export several pages by name.
 */
const named = <T extends Record<string, ComponentType<never>>, K extends keyof T>(load: () => Promise<T>, key: K) => lazy(() => load().then((m) => ({ default: m[key] as unknown as ComponentType })));

const LoginPage = lazy(() => import('@/features/authentication/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));

const PatientList = lazy(() => import('@/features/patients/pages/PatientListPage'));
const PatientRegistration = lazy(() => import('@/features/patients/pages/PatientRegistrationPage'));
const PatientDetails = lazy(() => import('@/features/patients/pages/PatientDetailsPage'));
const PatientEdit = lazy(() => import('@/features/patients/pages/PatientEditPage'));
const MyProfile = lazy(() => import('@/features/patients/pages/MyProfilePage'));
const loadTabs = () => import('@/features/patients/pages/PatientTabs');
const PatientOverviewTab = named(loadTabs, 'PatientOverviewTab');
const PatientHistoryTab = named(loadTabs, 'PatientHistoryTab');
const PatientAppointmentsTab = named(loadTabs, 'PatientAppointmentsTab');
const PatientPrescriptionsTab = named(loadTabs, 'PatientPrescriptionsTab');
const PatientLabTab = named(loadTabs, 'PatientLabTab');
const PatientBillingTab = named(loadTabs, 'PatientBillingTab');

const DoctorList = lazy(() => import('@/features/doctors/pages/DoctorListPage'));
const DoctorDetails = lazy(() => import('@/features/doctors/pages/DoctorDetailsPage'));
const DoctorForm = lazy(() => import('@/features/doctors/pages/DoctorFormPage'));
const loadDoctorTabs = () => import('@/features/doctors/pages/DoctorTabs');
const DoctorProfileTab = named(loadDoctorTabs, 'DoctorProfileTab');
const DoctorScheduleTab = named(loadDoctorTabs, 'DoctorScheduleTab');
const DoctorAvailabilityTab = named(loadDoctorTabs, 'DoctorAvailabilityTab');
const DoctorAppointmentsTab = named(loadDoctorTabs, 'DoctorAppointmentsTab');

const AppointmentList = lazy(() => import('@/features/appointments/pages/AppointmentListPage'));
const BookAppointment = lazy(() => import('@/features/appointments/pages/BookAppointmentPage'));
const AppointmentDetails = lazy(() => import('@/features/appointments/pages/AppointmentDetailsPage'));
const RescheduleAppointment = lazy(() => import('@/features/appointments/pages/RescheduleAppointmentPage'));
const AppointmentCalendar = lazy(() => import('@/features/appointments/pages/AppointmentCalendarPage'));
const AppointmentAvailability = lazy(() => import('@/features/appointments/pages/AppointmentAvailabilityPage'));

const HospitalList = lazy(() => import('@/features/hospitals/pages/HospitalListPage'));
const HospitalDetails = lazy(() => import('@/features/hospitals/pages/HospitalDetailsPage'));
const HospitalForm = lazy(() => import('@/features/hospitals/pages/HospitalFormPage'));

const RecordsHome = lazy(() => import('@/features/medical-records/pages/RecordsHomePage'));
const PatientRecord = lazy(() => import('@/features/medical-records/pages/PatientRecordPage'));
const RecordEntry = lazy(() => import('@/features/medical-records/pages/RecordEntryPage'));
const MedicalDocuments = lazy(() => import('@/features/medical-records/pages/MedicalDocumentsPage'));

const PrescriptionList = lazy(() => import('@/features/prescriptions/pages/PrescriptionListPage'));
const GeneratePrescription = lazy(() => import('@/features/prescriptions/pages/GeneratePrescriptionPage'));
const PrescriptionDetails = lazy(() => import('@/features/prescriptions/pages/PrescriptionDetailsPage'));

const LabTestList = lazy(() => import('@/features/laboratory/pages/LabTestListPage'));
const LabRequestList = lazy(() => import('@/features/laboratory/pages/LabRequestListPage'));
const RequestLabTest = lazy(() => import('@/features/laboratory/pages/RequestLabTestPage'));
const LabRequestDetails = lazy(() => import('@/features/laboratory/pages/LabRequestDetailsPage'));
const LabReports = lazy(() => import('@/features/laboratory/pages/LabReportsPage'));
const LabHistory = lazy(() => import('@/features/laboratory/pages/LabHistoryPage'));

const BillingDashboard = lazy(() => import('@/features/billing/pages/BillingDashboardPage'));
const InvoiceList = lazy(() => import('@/features/billing/pages/InvoiceListPage'));
const InvoiceDetails = lazy(() => import('@/features/billing/pages/InvoiceDetailsPage'));
const GenerateBill = lazy(() => import('@/features/billing/pages/GenerateBillPage'));
const PaymentHistory = lazy(() => import('@/features/billing/pages/PaymentHistoryPage'));

const MedicineList = lazy(() => import('@/features/pharmacy/pages/MedicineListPage'));
const MedicineDetails = lazy(() => import('@/features/pharmacy/pages/MedicineDetailsPage'));
const MedicineAvailability = lazy(() => import('@/features/pharmacy/pages/MedicineAvailabilityPage'));
const PharmacyOrders = lazy(() => import('@/features/pharmacy/pages/PharmacyOrdersPage'));

const NotificationList = lazy(() => import('@/features/notifications/pages/NotificationListPage'));
const NotificationDetails = lazy(() => import('@/features/notifications/pages/NotificationDetailsPage'));

const CacheMonitor = lazy(() => import('@/features/system/pages/CacheMonitorPage'));
const Profiler = lazy(() => import('@/features/system/pages/ProfilerPage'));

// HOC-protected building blocks
const ProtectedLayout = withAuth(AppLayout);
const Guard = {
  pharmacy: (C: ComponentType) => withPermission(C, 'pharmacy:access'),
  patientsRead: (C: ComponentType) => withPermission(C, 'patients:read'),
  recordsRead: (C: ComponentType) => withPermission(C, 'records:read'),
  rxRead: (C: ComponentType) => withPermission(C, 'prescriptions:read'),
  rxCreate: (C: ComponentType) => withPermission(C, 'prescriptions:create'),
  labRead: (C: ComponentType) => withPermission(C, 'lab:read'),
  labRequest: (C: ComponentType) => withPermission(C, 'lab:request'),
  billRead: (C: ComponentType) => withPermission(C, 'billing:read'),
  billManage: (C: ComponentType) => withPermission(C, 'billing:manage'),
  admin: (C: ComponentType) => withRoles(C, ['ADMIN']),
  monitor: (C: ComponentType) => withPermission(C, 'system:monitor'),
};
const PatientsOnly = Guard.patientsRead(PatientList);
const Pharm = { meds: Guard.pharmacy(MedicineList), medDetail: Guard.pharmacy(MedicineDetails), avail: Guard.pharmacy(MedicineAvailability), orders: Guard.pharmacy(PharmacyOrders) };
const AdminDoctorForm = Guard.admin(DoctorForm);
const AdminHospitalForm = Guard.admin(HospitalForm);
const BillDash = Guard.billRead(BillingDashboard), Invoices = Guard.billRead(InvoiceList), InvoiceDetail = Guard.billRead(InvoiceDetails), BillGen = Guard.billManage(GenerateBill), Payments = Guard.billRead(PaymentHistory);
const Records = { home: Guard.recordsRead(RecordsHome), patient: Guard.recordsRead(PatientRecord), entry: Guard.recordsRead(RecordEntry), docs: Guard.labRead(MedicalDocuments) };
const Rx = { list: Guard.rxRead(PrescriptionList), create: Guard.rxCreate(GeneratePrescription), detail: Guard.rxRead(PrescriptionDetails) };
const Lab = { tests: Guard.labRead(LabTestList), list: Guard.labRead(LabRequestList), create: Guard.labRequest(RequestLabTest), detail: Guard.labRead(LabRequestDetails), reports: Guard.labRead(LabReports), history: Guard.labRead(LabHistory) };
const SysCache = Guard.monitor(CacheMonitor), SysProfiler = Guard.monitor(Profiler);

/** Declarative routing: <Routes>/<Route> with layout routes, nested routes, dynamic params, index routes and role/permission guards. */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes inside the auth layout */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<PatientRegistration />} />
      </Route>
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected routes inside the application layout (sidebar + header) */}
      <Route element={<ProtectedLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="access-denied" element={<AccessDeniedPage />} />
        <Route path="profile" element={<MyProfile />} />

        <Route path="patients">
          <Route index element={<PatientsOnly />} />
          <Route path="new" element={<PatientRegistration />} />
          <Route path=":patientId" element={<PatientDetails />}>
            <Route index element={<PatientOverviewTab />} />
            <Route path="medical-history" element={<PatientHistoryTab />} />
            <Route path="appointments" element={<PatientAppointmentsTab />} />
            <Route path="prescriptions" element={<PatientPrescriptionsTab />} />
            <Route path="lab-reports" element={<PatientLabTab />} />
            <Route path="billing" element={<PatientBillingTab />} />
          </Route>
          <Route path=":patientId/edit" element={<PatientEdit />} />
        </Route>

        <Route path="doctors">
          <Route index element={<DoctorList />} />
          <Route path="new" element={<AdminDoctorForm />} />
          <Route path=":doctorId" element={<DoctorDetails />}>
            <Route index element={<DoctorProfileTab />} />
            <Route path="schedule" element={<DoctorScheduleTab />} />
            <Route path="availability" element={<DoctorAvailabilityTab />} />
            <Route path="appointments" element={<DoctorAppointmentsTab />} />
          </Route>
          <Route path=":doctorId/edit" element={<AdminDoctorForm />} />
        </Route>

        <Route path="appointments">
          <Route index element={<AppointmentList />} />
          <Route path="book" element={<BookAppointment />} />
          <Route path="calendar" element={<AppointmentCalendar />} />
          <Route path="availability" element={<AppointmentAvailability />} />
          <Route path=":appointmentId" element={<AppointmentDetails />} />
          <Route path=":appointmentId/reschedule" element={<RescheduleAppointment />} />
        </Route>

        <Route path="hospitals">
          <Route index element={<HospitalList />} />
          <Route path="new" element={<AdminHospitalForm />} />
          <Route path=":hospitalId" element={<HospitalDetails />} />
          <Route path=":hospitalId/departments" element={<HospitalDetails section="departments" />} />
          <Route path=":hospitalId/facilities" element={<HospitalDetails section="facilities" />} />
          <Route path=":hospitalId/edit" element={<AdminHospitalForm />} />
        </Route>

        <Route path="records">
          <Route index element={<Records.home />} />
          <Route path="patients/:patientId" element={<Records.patient />} />
          <Route path="entries/:entryId" element={<Records.entry />} />
          <Route path="documents" element={<Records.docs />} />
        </Route>

        <Route path="prescriptions">
          <Route index element={<Rx.list />} />
          <Route path="new" element={<Rx.create />} />
          <Route path="history/:patientId" element={<Rx.list />} />
          <Route path=":prescriptionId" element={<Rx.detail />} />
        </Route>

        <Route path="lab">
          <Route index element={<Navigate to="requests" replace />} />
          <Route path="tests" element={<Lab.tests />} />
          <Route path="requests" element={<Lab.list />} />
          <Route path="requests/new" element={<Lab.create />} />
          <Route path="requests/:requestId" element={<Lab.detail />} />
          <Route path="reports" element={<Lab.reports />} />
          <Route path="history" element={<Lab.history />} />
        </Route>

        <Route path="billing">
          <Route index element={<BillDash />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/:billId" element={<InvoiceDetail />} />
          <Route path="generate" element={<BillGen />} />
          <Route path="payments" element={<Payments />} />
        </Route>

        <Route path="pharmacy">
          <Route index element={<Navigate to="medicines" replace />} />
          <Route path="medicines" element={<Pharm.meds />} />
          <Route path="medicines/:medicineId" element={<Pharm.medDetail />} />
          <Route path="availability" element={<Pharm.avail />} />
          <Route path="orders" element={<Pharm.orders />} />
        </Route>

        <Route path="notifications">
          <Route index element={<NotificationList />} />
          <Route path="unread" element={<NotificationList unreadOnly />} />
          <Route path=":notificationId" element={<NotificationDetails />} />
        </Route>

        <Route path="system">
          <Route path="cache" element={<SysCache />} />
          <Route path="profiler" element={<SysProfiler />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
