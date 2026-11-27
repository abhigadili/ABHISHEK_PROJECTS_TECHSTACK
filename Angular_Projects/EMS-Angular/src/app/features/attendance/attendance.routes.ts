import { Routes } from '@angular/router';

/** 'reports' is declared before ':id' so it isn't captured as an attendance id. */
export const ATTENDANCE_ROUTES: Routes = [
  { path: '', title: 'Attendance', loadComponent: () => import('./attendance.component').then((m) => m.AttendanceComponent) },
  {
    path: 'reports',
    title: 'Attendance reports',
    data: { breadcrumb: 'Reports', permissions: ['attendance.team'] },
    loadComponent: () => import('./attendance-reports.component').then((m) => m.AttendanceReportsComponent),
  },
  {
    path: ':id',
    title: 'Attendance record',
    data: { breadcrumb: 'Record' },
    loadComponent: () => import('./attendance-detail.component').then((m) => m.AttendanceDetailComponent),
  },
];
