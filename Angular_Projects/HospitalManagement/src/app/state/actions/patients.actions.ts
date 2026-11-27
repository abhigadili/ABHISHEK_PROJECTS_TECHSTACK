import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { Page, Patient, PatientInput } from '../../core/models';

/** createActionGroup: one call defines a whole family of actions with the same source – "[Patients] Load", "[Patients] Load Success" … */
export const PatientsActions = createActionGroup({
  source: 'Patients',
  events: {
    'Load Page': props<{ q: string; page: number; size: number }>(),
    'Load Page Success': props<{ result: Page<Patient>; q: string }>(),
    'Load Page Failure': props<{ error: string }>(),
    'Prefetch Next': props<{ q: string; page: number; size: number }>(),
    'Prefetch Next Success': props<{ patients: Patient[] }>(),
    'Load One': props<{ id: number }>(),
    'Load One Success': props<{ patient: Patient }>(),
    'Create': props<{ patient: PatientInput }>(),
    'Create Success': props<{ patient: Patient }>(),
    'Update': props<{ id: number; patient: PatientInput }>(),
    'Update Success': props<{ patient: Patient }>(),
    'Deactivate': props<{ id: number }>(),
    'Deactivate Success': props<{ id: number }>(),
    'Save Failure': props<{ error: string }>(),
    'Clear': emptyProps(),
  },
});
