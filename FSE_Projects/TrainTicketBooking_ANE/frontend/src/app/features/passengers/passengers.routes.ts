import { Routes } from '@angular/router';
export const PASSENGER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', title: 'Saved passengers · RailBook', loadComponent: () => import('./passenger-list.component').then((m) => m.PassengerListComponent) },
];
