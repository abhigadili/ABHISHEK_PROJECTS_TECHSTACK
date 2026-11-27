import { Routes } from '@angular/router';

export const HOLIDAY_ROUTES: Routes = [
  { path: '', title: 'Calendar & Holidays', loadComponent: () => import('./calendar-page.component').then((m) => m.CalendarPageComponent) },
];
