import { createFeature, createReducer, on } from '@ngrx/store';
import * as A from '../actions/doctors.actions';
import { DEFAULT_DOCTOR_FILTERS, doctorsAdapter, initialDoctorsState } from '../entities/doctors.entity';

/**
 * Feature reducer (createReducer + on). Every case returns a NEW state object (immutability); nested filter updates spread the
 * `filters` object; entity operations come from the adapter: setAll, upsertOne, addOne, updateOne, removeOne.
 */
export const doctorsReducer = createReducer(
  initialDoctorsState,
  on(A.loadDoctors, (s) => ({ ...s, loading: true, error: null })),
  on(A.loadDoctorsSuccess, (s, { doctors }) => doctorsAdapter.setAll(doctors, { ...s, loading: false, loaded: true })),
  on(A.loadDoctorSuccess, (s, { doctor }) => doctorsAdapter.upsertOne(doctor, s)),
  on(A.createDoctorSuccess, (s, { doctor }) => doctorsAdapter.addOne(doctor, s)),
  on(A.updateDoctorSuccess, (s, { doctor }) => doctorsAdapter.updateOne({ id: doctor.id, changes: doctor }, s)),
  // deactivated doctors disappear while the "active only" filter is on, otherwise they are just flagged
  on(A.deactivateDoctorSuccess, (s, { id }) =>
    s.filters.onlyActive
      ? doctorsAdapter.removeOne(id, { ...s, filters: { ...s.filters, compareIds: s.filters.compareIds.filter((x) => x !== id) } })
      : doctorsAdapter.updateOne({ id, changes: { active: false } }, s)),
  on(A.doctorsFailure, (s, { error }) => ({ ...s, loading: false, error })),

  on(A.searchChanged, (s, { search }) => ({ ...s, filters: { ...s.filters, search, page: 0 } })),
  on(A.specializationChanged, (s, { specialization }) => ({ ...s, filters: { ...s.filters, specialization, page: 0 } })),
  on(A.departmentChanged, (s, { departmentId }) => ({ ...s, filters: { ...s.filters, departmentId, page: 0 } })),
  on(A.onlyActiveChanged, (s, { onlyActive }) => ({ ...s, filters: { ...s.filters, onlyActive, page: 0 } })),
  on(A.sortChanged, (s, { key }) => ({ ...s, filters: { ...s.filters, sortKey: key, sortDir: (s.filters.sortKey === key && s.filters.sortDir === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' } })),
  on(A.pageChanged, (s, { page, pageSize }) => ({ ...s, filters: { ...s.filters, page, pageSize: pageSize ?? s.filters.pageSize } })),
  on(A.compareToggled, (s, { id }) => {
    const c = s.filters.compareIds;
    const next = c.includes(id) ? c.filter((x) => x !== id) : c.length < 3 ? [...c, id] : c;
    return { ...s, filters: { ...s.filters, compareIds: next } };
  }),
  on(A.compareCleared, (s) => ({ ...s, filters: { ...s.filters, compareIds: [] } })),
  on(A.filtersReset, (s) => ({ ...s, filters: { ...DEFAULT_DOCTOR_FILTERS, pageSize: s.filters.pageSize, compareIds: s.filters.compareIds } })),
);

/** createFeature builds the feature selector and one selector per top-level state property automatically (selectDoctorsState, selectLoading …). */
export const doctorsFeature = createFeature({ name: 'doctors', reducer: doctorsReducer });
