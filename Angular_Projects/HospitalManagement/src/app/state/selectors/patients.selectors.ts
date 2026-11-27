import { createSelector } from '@ngrx/store';
import { patientsAdapter } from '../entities/patients.entity';
import { patientsFeature } from '../reducers/patients.reducer';
import { selectRouteParam } from './router.selectors';

const { selectPatientsState, selectLoading, selectError, selectPaging, selectPageIds, selectSaving } = patientsFeature;
const entity = patientsAdapter.getSelectors(selectPatientsState);
export const selectPatientEntities = entity.selectEntities;
export const selectPatientsLoading = selectLoading;
export const selectPatientsError = selectError;
export const selectPatientsPaging = selectPaging;
export const selectPatientsSaving = selectSaving;
/** The rows of the current server page in server order (selector built from entities + pageIds). */
export const selectPatientRows = createSelector(selectPatientEntities, selectPageIds, (e, ids) => ids.map((id) => e[id]).filter((p): p is NonNullable<typeof p> => !!p));
export const selectPatientById = (id: number) => createSelector(selectPatientEntities, (e) => e[id] ?? null);
/** Router-store + entity selector: the patient of the current route `/patients/:patientId`. */
export const selectRoutedPatient = createSelector(selectPatientEntities, selectRouteParam('patientId'), (e, id) => (id ? (e[Number(id)] ?? null) : null));
export const selectPatientsSummary = createSelector(selectPatientsPaging, selectPatientRows, (p, rows) => ({ total: p.totalElements, shown: rows.length, query: p.q, inactive: rows.filter((r) => r.status === 'INACTIVE').length }));
