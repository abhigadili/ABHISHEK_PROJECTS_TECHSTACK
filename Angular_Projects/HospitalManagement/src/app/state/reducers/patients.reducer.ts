import { createFeature, createReducer, on } from '@ngrx/store';
import { PatientsActions as A } from '../actions/patients.actions';
import { initialPatientsState, patientsAdapter } from '../entities/patients.entity';

export const patientsReducer = createReducer(
  initialPatientsState,
  on(A.loadPage, (s, { q, page, size }) => ({ ...s, loading: true, error: null, paging: { ...s.paging, q, page, size } })),
  // upsertMany merges the page into the entity map (keeps earlier pages & prefetched rows), pageIds remembers display order
  on(A.loadPageSuccess, (s, { result, q }) => patientsAdapter.upsertMany(result.content, { ...s, loading: false, pageIds: result.content.map((p) => p.id), paging: { page: result.page, size: result.size, totalElements: result.totalElements, totalPages: result.totalPages, q } })),
  on(A.loadPageFailure, (s, { error }) => ({ ...s, loading: false, error })),
  on(A.prefetchNextSuccess, (s, { patients }) => patientsAdapter.upsertMany(patients, s)),
  on(A.loadOneSuccess, (s, { patient }) => patientsAdapter.upsertOne(patient, s)),
  on(A.create, A.update, A.deactivate, (s) => ({ ...s, saving: true, error: null })),
  on(A.createSuccess, (s, { patient }) => patientsAdapter.addOne(patient, { ...s, saving: false, pageIds: [patient.id, ...s.pageIds], paging: { ...s.paging, totalElements: s.paging.totalElements + 1 } })),
  on(A.updateSuccess, (s, { patient }) => patientsAdapter.updateOne({ id: patient.id, changes: patient }, { ...s, saving: false })),
  on(A.deactivateSuccess, (s, { id }) => patientsAdapter.updateOne({ id, changes: { status: 'INACTIVE' } }, { ...s, saving: false })),
  on(A.saveFailure, (s, { error }) => ({ ...s, saving: false, error })),
  // removeMany: drop everything that was cached (e.g. on sign-out)
  on(A.clear, (s) => patientsAdapter.removeMany(s.ids as number[], { ...s, pageIds: [] })),
);
export const patientsFeature = createFeature({ name: 'patients', reducer: patientsReducer });
