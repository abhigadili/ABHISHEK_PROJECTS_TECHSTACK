import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { DoctorApiService } from '../api/doctor-api.service';
import { HospitalApiService } from '../api/hospital-api.service';
import { PatientApiService } from '../api/patient-api.service';
import type { Doctor, Hospital, Patient } from '../models';

/**
 * Functional route resolvers: the detail record is fetched BEFORE the route activates, so the page renders with data and
 * a missing record redirects to the 404 page instead of showing a half-empty screen (`catchError` → null → page handles).
 * Resolved values arrive through ActivatedRoute data / component input binding (`@Input patient` via withComponentInputBinding).
 */
export const patientResolver: ResolveFn<Patient | null> = (route) =>
  inject(PatientApiService).getById(Number(route.paramMap.get('patientId'))).pipe(catchError(() => of(null)));

export const doctorResolver: ResolveFn<Doctor | null> = (route) =>
  inject(DoctorApiService).getById(Number(route.paramMap.get('doctorId'))).pipe(catchError(() => of(null)));

export const hospitalResolver: ResolveFn<Hospital | null> = (route) =>
  inject(HospitalApiService).getById(Number(route.paramMap.get('hospitalId'))).pipe(catchError(() => of(null)));

/** Resolver that redirects when the entity is missing (used where a null record makes the page meaningless). */
export const requirePatient: ResolveFn<Patient> = (route) => {
  const router = inject(Router);
  return inject(PatientApiService).getById(Number(route.paramMap.get('patientId'))).pipe(
    catchError(() => { void router.navigate(['/not-found']); return of(null as unknown as Patient); }),
  );
};
