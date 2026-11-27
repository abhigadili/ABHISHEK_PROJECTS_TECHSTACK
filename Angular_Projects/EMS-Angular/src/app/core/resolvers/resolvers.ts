import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { EMPTY, catchError } from 'rxjs';
import { Employee } from '../models/employee.models';
import { Department } from '../models/organization.models';
import { DepartmentService } from '../services/department.service';
import { EmployeeService } from '../services/employee.service';
import { ToastService } from '../services/toast.service';

/**
 * Loads the employee BEFORE the route activates (so pages render with data and the breadcrumb knows the name).
 * A missing/forbidden employee cancels the navigation (EMPTY) and sends the user back to the list.
 */
export const employeeResolver: ResolveFn<Employee> = (route) => {
  const router = inject(Router);
  const toast = inject(ToastService);
  const id = Number(route.paramMap.get('id'));
  return inject(EmployeeService)
    .get(id)
    .pipe(
      catchError(() => {
        toast.error('That employee could not be loaded.');
        void router.navigate(['/employees']);
        return EMPTY;
      }),
    );
};

export const departmentResolver: ResolveFn<Department> = (route) => {
  const router = inject(Router);
  const toast = inject(ToastService);
  const id = Number(route.paramMap.get('id'));
  return inject(DepartmentService)
    .get(id)
    .pipe(
      catchError(() => {
        toast.error('That department could not be loaded.');
        void router.navigate(['/departments']);
        return EMPTY;
      }),
    );
};
