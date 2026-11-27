import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/guards';

/** Static segments (apply / approvals / admin) are declared before ':id'. Role/permission data is enforced by childAccessGuard. */
export const LEAVE_ROUTES: Routes = [
  { path: '', title: 'My leave', loadComponent: () => import('./leave-home.component').then((m) => m.LeaveHomeComponent) },
  { path: 'apply', title: 'Apply for leave', data: { breadcrumb: 'Apply' }, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./leave-apply.component').then((m) => m.LeaveApplyComponent) },
  {
    path: 'approvals',
    title: 'Leave approvals',
    data: { breadcrumb: 'Approvals', permissions: ['leave.approve'] },
    loadComponent: () => import('./leave-approvals.component').then((m) => m.LeaveApprovalsComponent),
  },
  {
    path: 'admin',
    title: 'Leave administration',
    data: { breadcrumb: 'Administration', permissions: ['leave.admin'] },
    loadComponent: () => import('./leave-admin.component').then((m) => m.LeaveAdminComponent),
  },
  { path: ':id', title: 'Leave request', data: { breadcrumb: 'Request' }, loadComponent: () => import('./leave-detail.component').then((m) => m.LeaveDetailComponent) },
];
