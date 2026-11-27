import { createSelector } from '@ngrx/store';
import { departmentAdapter, hospitalAdapter } from '../entities/hospitals.entity';
import { hospitalsFeature } from '../reducers/hospitals.reducer';
import { selectRouteParam } from './router.selectors';

const { selectHospitalsState, selectHospitals, selectDepartments, selectLoading, selectError, selectActiveHospitalId } = hospitalsFeature;
const hospitalSel = hospitalAdapter.getSelectors(selectHospitals);
const deptSel = departmentAdapter.getSelectors(selectDepartments);
export const selectAllHospitals = hospitalSel.selectAll;
export const selectHospitalEntities = hospitalSel.selectEntities;
export const selectAllDepartments = deptSel.selectAll;
export { selectLoading as selectHospitalsLoading, selectError as selectHospitalsError, selectActiveHospitalId, selectHospitalsState };
/** Selector composition across two normalised collections. */
export const selectDepartmentsOf = (hospitalId: number) => createSelector(selectAllDepartments, (d) => d.filter((x) => x.hospitalId === hospitalId));
export const selectHospitalById = (id: number) => createSelector(selectHospitalEntities, (e) => e[id] ?? null);
export const selectRoutedHospital = createSelector(selectHospitalEntities, selectRouteParam('hospitalId'), (e, id) => (id ? (e[Number(id)] ?? null) : null));
export const selectDepartmentNames = createSelector(selectAllDepartments, (d) => Object.fromEntries(d.map((x) => [x.id, x.name])) as Record<number, string>);
export const selectActiveHospital = createSelector(selectHospitalEntities, selectActiveHospitalId, (e, id) => (id ? (e[id] ?? null) : null));
