import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { injectOp } from '../../api/queries/op-query';
import { RecentActions } from '../../state/ngrx/recent.state';
import { Store } from '@ngrx/store';
import { effect, untracked } from '@angular/core';
import { CardComponent, ErrorStateComponent, LoadingBlockComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { SafeHtmlComponent } from '../../shared/components/safe-html.component';
import { DetailComponent, StatusBadgeComponent } from '../../shared/components/value.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';
import { type Col } from '../../shared/tables/data-table.component';

const NOTES = { notes: { rich: true } };

@Component({
  selector: 'app-customers-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, PageHeaderComponent, OpTableComponent, OpButtonComponent],
  template: `<app-page-header [title]="'hr.customers.title' | translate" [subtitle]="'hr.customers.sub' | translate"><app-op-button op="project.createCustomers" [label]="'common.create' | translate" variant="primary" size="md" dialogSize="lg" [overrides]="notes" /></app-page-header>
  <app-op-table op="project.listCustomers" tableId="customers" searchParam="q" [rowClickable]="true" (rowClick)="open($event)" [selectable]="true" [columns]="cols" [pick]="pick" [rowActions]="edit">
    <select filters class="form-select" style="width:auto" [ngModel]="status()" (ngModelChange)="status.set($event)" [attr.aria-label]="'common.status' | translate"><option value="">{{ 'common.all' | translate }}</option><option>ACTIVE</option><option>INACTIVE</option></select></app-op-table>
  <ng-template #edit let-r><app-op-button op="project.updateCustomers" [path]="{ id: r.id }" [initial]="r" [label]="'common.edit' | translate" variant="ghost" dialogSize="lg" [overrides]="notes" /></ng-template>`,
})
export class CustomersPage {
  private router = inject(Router); notes = NOTES; status = signal('');
  cols: Col[] = [{ key: 'code' }, { key: 'name' }, { key: 'industry' }, { key: 'billingEmail' }, { key: 'paymentTermsDays', hidden: true }, { key: 'creditLimit', hidden: true }, { key: 'status' }];
  // the list endpoint has no status filter - filter client side on the loaded page
  pick = (d: any) => (d?.content ?? []).filter((c: any) => !this.status() || c.status === this.status());
  open(r: any) { this.router.navigate(['/customers', r.id]); }
}

@Component({
  selector: 'app-customer-detail-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, CardComponent, ErrorStateComponent, LoadingBlockComponent, StatusBadgeComponent, DetailComponent, SafeHtmlComponent, CrudSectionComponent, OpButtonComponent, OpTableComponent, TabsComponent, TabDirective],
  template: `@if (q.isLoading()) { <app-loading-block [rows]="5" /> } @else if (q.isError()) { <app-error-state [error]="q.error()" (retry)="q.refetch()" /> } @else {
  <div class="hr-card mb-3"><div class="hr-card-body d-flex flex-wrap align-items-center gap-3"><div class="flex-grow-1"><h1 class="page-title">{{ c().name }} <app-status-badge [value]="c().status" /></h1><div class="text-muted" style="font-size:13px">{{ c().code }} · {{ c().industry }}</div></div>
    <app-op-button op="project.updateCustomers" [path]="{ id: id() }" [initial]="c()" [label]="'common.edit' | translate" icon="pi-pencil" dialogSize="lg" [overrides]="notes" />
    <app-op-button op="project.delete" [path]="{ id: id() }" [label]="'common.delete' | translate" icon="pi-trash" (done)="router.navigate(['/customers'])" /></div></div>
  <app-tabs>
    <ng-template appTab="overview" [label]="'common.overview' | translate"><app-card><app-detail [data]="c()" [hide]="['id', 'notes']" />@if (c().notes) { <div class="mt-3"><div class="field-label">{{ 'fields.notes' | translate }}</div><app-safe-html [html]="c().notes" /></div> }</app-card></ng-template>
    <ng-template appTab="contacts" label="Contacts"><app-crud-section title="Contacts" [list]="{ op: 'project.contacts', path: { id: id() } }" [create]="{ op: 'project.addContact', path: { id: id() } }" [update]="{ op: 'project.updateContact', path: cp }" [remove]="{ op: 'project.deleteContact', path: cp }" /></ng-template>
    <ng-template appTab="projects" [label]="'nav.projects' | translate"><app-op-table op="project.list" [query]="{ customerId: id() }" tableId="cust-projects" [rowClickable]="true" (rowClick)="router.navigate(['/projects', $event.id])" [columns]="pcols" /></ng-template>
  </app-tabs> }`,
})
export class CustomerDetailPage {
  router = inject(Router); private store = inject(Store); notes = NOTES; id = input.required<string>();
  q = injectOp<any>('project.getCustomers', () => ({ path: { id: this.id() } })); c = computed(() => this.q.data() ?? {});
  cp = (r: any) => ({ id: this.id(), contactId: r.id });
  pcols: Col[] = [{ key: 'code' }, { key: 'name' }, { key: 'status' }, { key: 'startDate' }, { key: 'endDate' }, { key: 'budget' }];
  constructor() { effect(() => { const c = this.q.data(); if (c?.name) untracked(() => this.store.dispatch(RecentActions.visited({ record: { id: 'c' + this.id(), kind: 'customer', title: c.name, link: `/customers/${this.id()}`, at: Date.now() } }))); }); }
}
