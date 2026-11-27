import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from '../../layouts/admin-layout/admin-layout.component';
import { AdminRoleGuard } from './admin-role.guard';
import { AdminUserFormComponent } from './admin-user-form.component';
import { AdminUsersComponent } from './admin-users.component';

const routes: Routes = [
  { path: '', component: AdminLayoutComponent, canActivate: [AdminRoleGuard], canActivateChild: [AdminRoleGuard], children: [
    { path: '', pathMatch: 'full', redirectTo: 'users' },
    { path: 'users', component: AdminUsersComponent, data: { breadcrumb: 'Users' } },
  ] },
];

/**
 * ISOLATED NgModule-based feature (the rest of the app is standalone): declares NON-STANDALONE components, imports CommonModule /
 * ReactiveFormsModule / RouterModule.forChild, is lazy-loaded with `loadChildren: () => import(...).then(m => m.AdminModule)` and
 * guarded by `canMatch` in the root routes plus the class-based AdminRoleGuard. HTTP goes through the app-wide HttpClient (root providers),
 * so the functional AND class-based interceptors apply here too.
 */
@NgModule({
  declarations: [AdminUsersComponent, AdminUserFormComponent],
  imports: [CommonModule, ReactiveFormsModule, RouterModule.forChild(routes), AdminLayoutComponent],
})
export class AdminModule {}
