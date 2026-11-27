import { EntityState, createEntityAdapter } from '@ngrx/entity';
import type { Doctor } from '../../core/models';

export type DoctorSortKey = 'fullName' | 'specialization' | 'experienceYears' | 'consultationFee';

/** Nested UI state of the directory (filters live in the same feature slice as the entities). */
export interface DoctorFilters {
  readonly search: string;
  readonly specialization: string;
  readonly departmentId: number | null;
  readonly onlyActive: boolean;
  readonly sortKey: DoctorSortKey;
  readonly sortDir: 'asc' | 'desc';
  readonly page: number;
  readonly pageSize: number;
  readonly compareIds: readonly number[];
}

/** State interface = EntityState (normalised ids + entities map) + request status + nested filters. */
export interface DoctorsState extends EntityState<Doctor> {
  readonly loading: boolean;
  readonly loaded: boolean;
  readonly error: string | null;
  readonly filters: DoctorFilters;
}

/** Entity adapter: sorted by name. Provides addOne/setAll/upsertOne/updateOne/removeOne … and entity selectors. */
export const doctorsAdapter = createEntityAdapter<Doctor>({
  selectId: (d) => d.id,
  sortComparer: (a, b) => a.fullName.localeCompare(b.fullName),
});

export const DEFAULT_DOCTOR_FILTERS: DoctorFilters = {
  search: '', specialization: '', departmentId: null, onlyActive: true, sortKey: 'fullName', sortDir: 'asc', page: 0, pageSize: 8, compareIds: [],
};

const KEY = 'hms.ng.doctorFilters';

/** State persistence: UI preferences (not the doctors) survive reloads; `compareIds`/`search` are session-only. */
export function loadPersistedFilters(): DoctorFilters {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_DOCTOR_FILTERS;
    const p = JSON.parse(raw) as Partial<DoctorFilters>;
    return { ...DEFAULT_DOCTOR_FILTERS, specialization: p.specialization ?? '', departmentId: p.departmentId ?? null, onlyActive: p.onlyActive ?? true, sortKey: p.sortKey ?? 'fullName', sortDir: p.sortDir ?? 'asc', pageSize: p.pageSize ?? 8 };
  } catch { return DEFAULT_DOCTOR_FILTERS; }
}
export function persistFilters(f: DoctorFilters): void {
  try { localStorage.setItem(KEY, JSON.stringify({ specialization: f.specialization, departmentId: f.departmentId, onlyActive: f.onlyActive, sortKey: f.sortKey, sortDir: f.sortDir, pageSize: f.pageSize })); } catch { /* ignore */ }
}

export const initialDoctorsState: DoctorsState = doctorsAdapter.getInitialState({ loading: false, loaded: false, error: null, filters: loadPersistedFilters() });
