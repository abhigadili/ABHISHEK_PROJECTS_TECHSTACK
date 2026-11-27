import { EntityState, createEntityAdapter } from '@ngrx/entity';
import type { Patient } from '../../core/models';

export interface PatientsPaging { readonly page: number; readonly size: number; readonly totalElements: number; readonly totalPages: number; readonly q: string }
export interface PatientsState extends EntityState<Patient> {
  readonly loading: boolean;
  readonly error: string | null;
  readonly paging: PatientsPaging;
  /** ids of the CURRENT server page in display order (the entity map also keeps patients from earlier pages/prefetches). */
  readonly pageIds: readonly number[];
  readonly saving: boolean;
}
export const patientsAdapter = createEntityAdapter<Patient>({ selectId: (p) => p.id });
export const initialPatientsState: PatientsState = patientsAdapter.getInitialState({
  loading: false, error: null, saving: false, pageIds: [], paging: { page: 0, size: 10, totalElements: 0, totalPages: 0, q: '' },
});
