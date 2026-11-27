/** TanStack Query key factories - hierarchical so invalidateQueries({queryKey: keys.appointments.all}) cascades. */
export const keys = {
  doctors: { all: ['doctors'] as const, list: (f: object) => ['doctors', 'list', f] as const, specs: ['doctors', 'specializations'] as const, available: (date: string, spec?: string) => ['doctors', 'available', date, spec ?? ''] as const },
  appointments: {
    all: ['appointments'] as const,
    slots: (doctorId: number | null, date: string) => ['appointments', 'slots', doctorId, date] as const,
    byPatient: (patientId: number | null) => ['appointments', 'patient', patientId] as const,
    byDoctor: (doctorId: number, date?: string) => ['appointments', 'doctor', doctorId, date ?? 'all'] as const,
  },
  patients: { all: ['patients'] as const, search: (q: string) => ['patients', 'search', q] as const, detail: (id: number | null) => ['patients', 'detail', id] as const },
  lab: { all: ['lab'] as const, tests: ['lab', 'tests'] as const, requests: (status: string) => ['lab', 'requests', status] as const, byPatient: (id: number) => ['lab', 'patient', id] as const },
  pharmacy: { all: ['pharmacy'] as const, medicines: ['pharmacy', 'medicines'] as const, orders: (status: string) => ['pharmacy', 'orders', status] as const },
  billing: { all: ['billing'] as const, byPatient: (id: number) => ['billing', 'patient', id] as const },
  notifications: { all: ['notifications'] as const, my: ['notifications', 'my'] as const },
};
