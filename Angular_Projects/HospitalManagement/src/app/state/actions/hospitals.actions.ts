import { createActionGroup, props } from '@ngrx/store';
import type { Department, DepartmentInput, Hospital, HospitalInput } from '../../core/models';

export const HospitalsActions = createActionGroup({
  source: 'Hospitals',
  events: {
    'Load': props<{ force?: boolean }>(),
    'Load Success': props<{ hospitals: Hospital[] }>(),
    'Load Failure': props<{ error: string }>(),
    'Load Departments': props<{ hospitalId: number }>(),
    'Load Departments Success': props<{ hospitalId: number; departments: Department[] }>(),
    'Save Hospital': props<{ id?: number; hospital: HospitalInput }>(),
    'Save Hospital Success': props<{ hospital: Hospital; created: boolean }>(),
    'Deactivate Hospital': props<{ id: number }>(),
    'Deactivate Hospital Success': props<{ id: number }>(),
    'Save Department': props<{ hospitalId: number; id?: number; department: DepartmentInput }>(),
    'Save Department Success': props<{ department: Department }>(),
    'Delete Department': props<{ id: number }>(),
    'Delete Department Success': props<{ id: number }>(),
    'Failure': props<{ error: string }>(),
    'Active Hospital Set': props<{ id: number | null }>(),
  },
});
