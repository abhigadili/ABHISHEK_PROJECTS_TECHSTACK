import { Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { permissionGuard } from '../../core/guards/auth.guards';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { BillingEffects } from '../../state/effects/billing.effects';
import { billingFeature } from '../../state/reducers/billing.reducer';

/** Billing: `billing:read` (ADMIN, BILLING_STAFF, PATIENT). The billing slice + class-based effects are registered lazily by the route `providers`. */
export const BILLING_ROUTES: Routes = [
  { path: '', providers: [provideState(billingFeature), provideEffects(BillingEffects)], canActivate: [permissionGuard('billing:read')], children: [
    { path: '', loadComponent: () => import('./billing-dashboard.component').then((m) => m.BillingDashboardComponent), data: { breadcrumb: 'Billing' } },
    { path: 'invoices', loadComponent: () => import('./billing-invoices.component').then((m) => m.BillingInvoicesComponent), data: { breadcrumb: 'Invoices' } },
    { path: 'invoices/:billId', loadComponent: () => import('./billing-details.component').then((m) => m.BillingDetailsComponent), data: { breadcrumb: 'Invoice :billId' } },
    { path: 'payments', loadComponent: () => import('./billing-payments.component').then((m) => m.BillingPaymentsComponent), data: { breadcrumb: 'Payments' } },
    { path: 'generate', canActivate: [permissionGuard('billing:manage')], canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./billing-generate.component').then((m) => m.BillingGenerateComponent), data: { breadcrumb: 'Generate' } },
  ] },
];
