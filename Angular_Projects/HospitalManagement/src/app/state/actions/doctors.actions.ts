import { createAction, props } from '@ngrx/store';
import type { Doctor, DoctorInput } from '../../core/models';
import type { DoctorFilters, DoctorSortKey } from '../entities/doctors.entity';

/**
 * Doctor actions – naming convention "[Source] Event". Request / Success / Failure triplets for every async workflow,
 * payload actions with props<>(), an EMPTY action (no props) and plain UI actions (filter changes).
 */
// ----- requests (API calls handled by effects)
export const loadDoctors = createAction('[Doctors Page] Load Doctors', props<{ active?: boolean }>());
export const loadDoctor = createAction('[Doctor Details] Load Doctor', props<{ id: number }>());
export const createDoctor = createAction('[Doctor Form] Create Doctor', props<{ doctor: DoctorInput }>());
export const updateDoctor = createAction('[Doctor Form] Update Doctor', props<{ id: number; doctor: DoctorInput }>());
export const deactivateDoctor = createAction('[Doctor Details] Deactivate Doctor', props<{ id: number }>());
// ----- successes
export const loadDoctorsSuccess = createAction('[Doctors API] Load Doctors Success', props<{ doctors: Doctor[] }>());
export const loadDoctorSuccess = createAction('[Doctors API] Load Doctor Success', props<{ doctor: Doctor }>());
export const createDoctorSuccess = createAction('[Doctors API] Create Doctor Success', props<{ doctor: Doctor }>());
export const updateDoctorSuccess = createAction('[Doctors API] Update Doctor Success', props<{ doctor: Doctor }>());
export const deactivateDoctorSuccess = createAction('[Doctors API] Deactivate Doctor Success', props<{ id: number }>());
// ----- failures (one shared failure action keeps reducers small; `source` says what failed)
export const doctorsFailure = createAction('[Doctors API] Failure', props<{ source: string; error: string }>());
// ----- UI state
export const searchChanged = createAction('[Doctors Filters] Search Changed', props<{ search: string }>());
export const specializationChanged = createAction('[Doctors Filters] Specialization Changed', props<{ specialization: string }>());
export const departmentChanged = createAction('[Doctors Filters] Department Changed', props<{ departmentId: number | null }>());
export const onlyActiveChanged = createAction('[Doctors Filters] Only Active Changed', props<{ onlyActive: boolean }>());
export const sortChanged = createAction('[Doctors Filters] Sort Changed', props<{ key: DoctorSortKey }>());
export const pageChanged = createAction('[Doctors Filters] Page Changed', props<{ page: number; pageSize?: number }>());
export const compareToggled = createAction('[Doctors Compare] Toggled', props<{ id: number }>());
/** Empty action: no payload at all. */
export const filtersReset = createAction('[Doctors Filters] Reset');
export const compareCleared = createAction('[Doctors Compare] Cleared');
export type _DoctorFiltersRef = DoctorFilters;
