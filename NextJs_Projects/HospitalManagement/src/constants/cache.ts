/** Central cache-tag registry (data cache). Every tag documented in DATA_FETCHING_AND_CACHING.md. */
export const CACHE_TAGS = {
  hospitals: 'hospitals',
  departments: 'departments',
  doctors: 'doctors',
  doctorSchedule: (id: number | string) => `doctor-schedule-${id}`,
  availability: (doctorId: number | string) => `availability-${doctorId}`,
  patient: (id: number | string) => `patient-${id}`,
  patients: 'patients',
  appointments: 'appointments',
  labReports: 'lab-reports',
  billing: 'billing',
  pharmacy: 'pharmacy',
  notifications: 'notifications',
  prescriptions: 'prescriptions',
  records: 'records',
} as const;
