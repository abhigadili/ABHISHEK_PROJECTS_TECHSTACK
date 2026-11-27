import type { BillListParams } from './endpoints/billingApi';
import type { LabRequestListParams } from './endpoints/laboratoryApi';
import type { OrderListParams } from './endpoints/pharmacyApi';
import type { DoctorListParams, ISODate, PatientListParams, RecordEntryType } from '@/types';

/**
 * Query key factories (one per service). Keys are hierarchical so that `invalidateQueries({ queryKey: x.all })`
 * hits everything for that service and `x.lists()` / `x.detail(id)` allow precise invalidation.
 */
export const queryKeys = {
  auth: { me: ['auth', 'me'] as const, users: ['auth', 'users'] as const },
  patients: {
    all: ['patients'] as const,
    lists: () => [...queryKeys.patients.all, 'list'] as const,
    list: (p: PatientListParams) => [...queryKeys.patients.lists(), p] as const,
    detail: (id: number) => [...queryKeys.patients.all, 'detail', id] as const,
    byUser: (userId: number) => [...queryKeys.patients.all, 'by-user', userId] as const,
  },
  doctors: {
    all: ['doctors'] as const,
    lists: () => [...queryKeys.doctors.all, 'list'] as const,
    list: (p: DoctorListParams) => [...queryKeys.doctors.lists(), p] as const,
    detail: (id: number) => [...queryKeys.doctors.all, 'detail', id] as const,
    specializations: () => [...queryKeys.doctors.all, 'specializations'] as const,
    available: (date: ISODate, specialization?: string) => [...queryKeys.doctors.all, 'available', date, specialization ?? 'all'] as const,
    slots: (id: number, date: ISODate) => [...queryKeys.doctors.all, 'slots', id, date] as const,
    schedule: (id: number) => [...queryKeys.doctors.all, 'schedule', id] as const,
    unavailability: (id: number) => [...queryKeys.doctors.all, 'unavailability', id] as const,
  },
  appointments: {
    all: ['appointments'] as const,
    lists: () => [...queryKeys.appointments.all, 'list'] as const,
    forPatient: (patientId: number) => [...queryKeys.appointments.lists(), 'patient', patientId] as const,
    forDoctor: (doctorId: number, date?: ISODate) => [...queryKeys.appointments.lists(), 'doctor', doctorId, date ?? 'all'] as const,
    mine: () => [...queryKeys.appointments.lists(), 'mine'] as const,
    detail: (id: number) => [...queryKeys.appointments.all, 'detail', id] as const,
    availability: (doctorId: number, date: ISODate) => [...queryKeys.appointments.all, 'availability', doctorId, date] as const,
  },
  hospitals: {
    all: ['hospitals'] as const,
    list: () => [...queryKeys.hospitals.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.hospitals.all, 'detail', id] as const,
    departments: (id: number) => [...queryKeys.hospitals.all, 'departments', id] as const,
  },
  records: {
    all: ['records'] as const,
    summary: (patientId: number) => [...queryKeys.records.all, 'summary', patientId] as const,
    entries: (patientId: number, type?: RecordEntryType) => [...queryKeys.records.all, 'entries', patientId, type ?? 'all'] as const,
    entry: (id: number) => [...queryKeys.records.all, 'entry', id] as const,
  },
  prescriptions: {
    all: ['prescriptions'] as const,
    forPatient: (patientId: number) => [...queryKeys.prescriptions.all, 'patient', patientId] as const,
    forDoctor: (doctorId: number) => [...queryKeys.prescriptions.all, 'doctor', doctorId] as const,
    detail: (id: number) => [...queryKeys.prescriptions.all, 'detail', id] as const,
    status: (id: number) => [...queryKeys.prescriptions.all, 'status', id] as const,
  },
  laboratory: {
    all: ['laboratory'] as const,
    tests: () => [...queryKeys.laboratory.all, 'tests'] as const,
    requests: (p: LabRequestListParams) => [...queryKeys.laboratory.all, 'requests', p] as const,
    requestsInfinite: (status?: string) => [...queryKeys.laboratory.all, 'requests-infinite', status ?? 'all'] as const,
    forPatient: (patientId: number) => [...queryKeys.laboratory.all, 'patient', patientId] as const,
    request: (id: number) => [...queryKeys.laboratory.all, 'request', id] as const,
    report: (id: number) => [...queryKeys.laboratory.all, 'report', id] as const,
  },
  billing: {
    all: ['billing'] as const,
    list: (p: BillListParams) => [...queryKeys.billing.all, 'list', p] as const,
    forPatient: (patientId: number) => [...queryKeys.billing.all, 'patient', patientId] as const,
    detail: (id: number) => [...queryKeys.billing.all, 'detail', id] as const,
    payments: (billId: number) => [...queryKeys.billing.all, 'payments', billId] as const,
    summary: () => [...queryKeys.billing.all, 'summary'] as const,
  },
  pharmacy: {
    all: ['pharmacy'] as const,
    medicines: () => [...queryKeys.pharmacy.all, 'medicines'] as const,
    orders: (p: OrderListParams) => [...queryKeys.pharmacy.all, 'orders', p] as const,
    ordersInfinite: (status?: string) => [...queryKeys.pharmacy.all, 'orders-infinite', status ?? 'all'] as const,
    order: (id: number) => [...queryKeys.pharmacy.all, 'order', id] as const,
    orderForPrescription: (id: number) => [...queryKeys.pharmacy.all, 'order-for-prescription', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (scope: 'all' | 'my', p: unknown) => [...queryKeys.notifications.all, 'list', scope, p] as const,
    feed: (scope: 'all' | 'my') => [...queryKeys.notifications.all, 'feed', scope] as const,
    detail: (id: number) => [...queryKeys.notifications.all, 'detail', id] as const,
  },
  dashboard: { all: ['dashboard'] as const, stats: (role: string, id: number | null) => ['dashboard', 'stats', role, id] as const },
} as const;
