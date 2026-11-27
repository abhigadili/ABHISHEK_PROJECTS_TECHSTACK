import { isDevMode } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { provideState, provideStore } from '@ngrx/store';
import { AppointmentsEffects } from './effects/appointments.effects';
import { HospitalsEffects } from './effects/hospitals.effects';
import { appointmentsFeature } from './reducers/appointments.reducer';
import { hospitalsFeature } from './reducers/hospitals.reducer';
import { provideStoreDevtools } from '@ngrx/store-devtools';

/**
 * Root store configuration: `provideStore` (global/root store with the router reducer), `provideEffects` (root effects container),
 * `provideRouterStore` (router state in the store), `provideStoreDevtools` (Redux DevTools; logOnly in production).
 * Feature slices are registered lazily with `provideState` + `provideEffects` in the route `providers` of each feature.
 */
export const provideAppState = () => [
  provideStore({ router: routerReducer }, { runtimeChecks: { strictStateImmutability: true, strictActionImmutability: true, strictStateSerializability: false, strictActionSerializability: false } }),
  provideEffects(),
  // Feature states that several routes share (dashboard, doctor/patient tabs, header, booking) live in the ROOT injector:
  provideState(appointmentsFeature),
  provideEffects(AppointmentsEffects),
  provideState(hospitalsFeature),
  provideEffects(HospitalsEffects),
  provideRouterStore(),
  provideStoreDevtools({ maxAge: 30, logOnly: !isDevMode(), name: 'HospitalManagement', connectInZone: false }),
];
