import { EntityState, createEntityAdapter } from '@ngrx/entity';
import type { Department, Hospital } from '../../core/models';

/** NORMALISED state: hospitals and departments are separate entity collections linked by `hospitalId` (no nesting/duplication). */
export interface HospitalsState {
  readonly hospitals: EntityState<Hospital>;
  readonly departments: EntityState<Department>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly activeHospitalId: number | null;
}
export const hospitalAdapter = createEntityAdapter<Hospital>({ sortComparer: (a, b) => a.name.localeCompare(b.name) });
export const departmentAdapter = createEntityAdapter<Department>({ sortComparer: (a, b) => a.name.localeCompare(b.name) });
export const initialHospitalsState: HospitalsState = { hospitals: hospitalAdapter.getInitialState(), departments: departmentAdapter.getInitialState(), loading: false, error: null, activeHospitalId: null };
