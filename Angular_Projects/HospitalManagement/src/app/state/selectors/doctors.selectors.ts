import { createSelector } from '@ngrx/store';
import { doctorsAdapter } from '../entities/doctors.entity';
import { doctorsFeature } from '../reducers/doctors.reducer';
import { selectRouteParam } from './router.selectors';

/** Feature selector + entity selectors (the adapter generates selectAll / selectEntities / selectIds / selectTotal). */
const { selectDoctorsState, selectFilters, selectLoading, selectLoaded, selectError } = doctorsFeature;
const entity = doctorsAdapter.getSelectors(selectDoctorsState);
export const selectAllDoctors = entity.selectAll;
export const selectDoctorEntities = entity.selectEntities;
export const selectDoctorTotal = entity.selectTotal;
export { selectFilters as selectDoctorFilters, selectLoading as selectDoctorsLoading, selectLoaded as selectDoctorsLoaded, selectError as selectDoctorsError };

/** Derived state (memoised: recomputed only when doctors or filters change). Filter → sort. */
export const selectFilteredDoctors = createSelector(selectAllDoctors, selectFilters, (doctors, f) => {
  const q = f.search.trim().toLowerCase();
  const list = doctors.filter((d) =>
    (!f.onlyActive || d.active) &&
    (!f.specialization || d.specialization === f.specialization) &&
    (f.departmentId === null || d.departmentId === f.departmentId) &&
    (!q || [d.fullName, d.specialization, d.email, d.licenseNumber].some((x) => x.toLowerCase().includes(q))));
  const dir = f.sortDir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const x = a[f.sortKey] ?? -1, y = b[f.sortKey] ?? -1;
    return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * dir;
  });
});

/** Selector composition: page slice built on top of the filtered selector. */
export const selectDoctorPage = createSelector(selectFilteredDoctors, selectFilters, (list, f) => ({
  items: list.slice(f.page * f.pageSize, (f.page + 1) * f.pageSize),
  total: list.length,
  pages: Math.max(1, Math.ceil(list.length / f.pageSize)),
  page: Math.min(f.page, Math.max(0, Math.ceil(list.length / f.pageSize) - 1)),
}));

/** Nested selectors on the filter slice. */
export const selectCompareIds = createSelector(selectFilters, (f) => f.compareIds);
export const selectCompareDoctors = createSelector(selectDoctorEntities, selectCompareIds, (e, ids) => ids.map((id) => e[id]).filter((d): d is NonNullable<typeof d> => !!d));
export const selectHasActiveFilters = createSelector(selectFilters, (f) => !!(f.search || f.specialization || f.departmentId !== null || !f.onlyActive));
export const selectSpecializations = createSelector(selectAllDoctors, (d) => [...new Set(d.map((x) => x.specialization))].sort());

/** PARAMETERISED selector (factory): `store.select(selectDoctorById(3))`. */
export const selectDoctorById = (id: number) => createSelector(selectDoctorEntities, (e) => e[id] ?? null);

/** Router-store integration: the doctor whose id is in the current URL (`/doctors/:doctorId`). */
export const selectRoutedDoctor = createSelector(selectDoctorEntities, selectRouteParam('doctorId'), (e, id) => (id ? (e[Number(id)] ?? null) : null));
export const selectDoctorsByDepartment = createSelector(selectAllDoctors, (d) => d.reduce<Record<string, number>>((acc, x) => { const k = String(x.departmentId ?? 'none'); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}));
