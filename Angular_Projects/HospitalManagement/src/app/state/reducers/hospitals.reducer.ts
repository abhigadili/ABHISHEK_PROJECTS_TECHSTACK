import { createFeature, createReducer, on } from '@ngrx/store';
import { HospitalsActions as A } from '../actions/hospitals.actions';
import { departmentAdapter, hospitalAdapter, initialHospitalsState } from '../entities/hospitals.entity';

export const hospitalsReducer = createReducer(
  initialHospitalsState,
  on(A.load, (s) => ({ ...s, loading: true, error: null })),
  on(A.loadSuccess, (s, { hospitals }) => ({ ...s, loading: false, hospitals: hospitalAdapter.setAll(hospitals, s.hospitals) })),
  on(A.loadFailure, A.failure, (s, { error }) => ({ ...s, loading: false, error })),
  // nested immutable update: replace only the departments of ONE hospital, keep the others
  on(A.loadDepartmentsSuccess, (s, { hospitalId, departments }) => ({
    ...s,
    departments: departmentAdapter.upsertMany(departments, departmentAdapter.removeMany((d) => d.hospitalId === hospitalId && !departments.some((x) => x.id === d.id), s.departments)),
  })),
  on(A.saveHospitalSuccess, (s, { hospital }) => ({ ...s, hospitals: hospitalAdapter.upsertOne(hospital, s.hospitals) })),
  on(A.deactivateHospitalSuccess, (s, { id }) => ({ ...s, hospitals: hospitalAdapter.updateOne({ id, changes: { active: false } }, s.hospitals) })),
  on(A.saveDepartmentSuccess, (s, { department }) => ({ ...s, departments: departmentAdapter.upsertOne(department, s.departments) })),
  on(A.deleteDepartmentSuccess, (s, { id }) => ({ ...s, departments: departmentAdapter.removeOne(id, s.departments) })),
  on(A.activeHospitalSet, (s, { id }) => ({ ...s, activeHospitalId: id })),
);
export const hospitalsFeature = createFeature({ name: 'hospitals', reducer: hospitalsReducer });
