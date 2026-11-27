import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { PROJECT_STATUS } from '../../core/constants/enums';
import { EmployeeNameComponent, EmployeePickerComponent } from '../../shared/components/employee.components';
import { RefService } from '../../shared/components/ref.service';
import { SafeHtmlComponent } from '../../shared/components/safe-html.component';
import { CardComponent, ErrorStateComponent, LoadingBlockComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { DetailComponent, StatusBadgeComponent } from '../../shared/components/value.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { type Col } from '../../shared/tables/data-table.component';
import { CellDirective } from '../../shared/tables/data-table.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';
import { isoDate } from '../../shared/utilities/date';
import { RecentActions } from '../../state/ngrx/recent.state';
import { ProgressBarComponent, scheduleProgress } from './progress';

@Component({
  selector: 'app-projects-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, PageHeaderComponent, OpTableComponent, OpButtonComponent, ProgressBarComponent, CellDirective],
  template: `<app-page-header [title]="'hr.projects.title' | translate" [subtitle]="'hr.projects.sub' | translate"><app-op-button op="project.create" [label]="'common.create' | translate" variant="primary" size="md" dialogSize="lg" [overrides]="ov" /></app-page-header>
  <app-op-table op="project.list" tableId="projects" searchParam="q" [query]="f()" [sortable]="['name', 'startDate', 'status']" [rowClickable]="true" (rowClick)="open($event)" [columns]="cols">
    <ng-template appCell="progress" let-r><app-progress-bar [value]="prog(r)" /></ng-template>
    <span filters class="contents"><select class="form-select" style="width:auto" [ngModel]="f().status" (ngModelChange)="setF('status', $event)" [attr.aria-label]="'common.status' | translate"><option value="">{{ 'common.status' | translate }}</option>@for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }</select>
      <select class="form-select" style="width:auto" [ngModel]="f().customerId" (ngModelChange)="setF('customerId', $event)" aria-label="customer"><option value="">{{ 'fields.customerId' | translate }}</option>@for (o of cust(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select></span></app-op-table>`,
})
export class ProjectsPage {
  private router = inject(Router); cust = inject(RefService).options('customer'); statuses = PROJECT_STATUS; f = signal({ status: '', customerId: '' });
  ov = { description: { rich: true }, billingNotes: { textarea: true } }; prog = (r: any) => scheduleProgress(r.startDate, r.endDate, r.status);
  cols: Col[] = [{ key: 'code' }, { key: 'name', sortable: true }, { key: 'customerId' }, { key: 'projectManagerId' }, { key: 'status', sortable: true }, { key: 'startDate', sortable: true }, { key: 'endDate' }, { key: 'progress', label: 'Schedule', fmt: (_v, r) => `${scheduleProgress(r.startDate, r.endDate, r.status)}%` }, { key: 'budget', hidden: true }, { key: 'billingModel', hidden: true }];
  open(r: any) { this.router.navigate(['/projects', r.id]); }
  setF(k: 'status' | 'customerId', v: string) { this.f.set({ ...this.f(), [k]: v }); }
}

@Component({
  selector: 'app-allocation-check', standalone: true, imports: [FormsModule, CardComponent, EmployeePickerComponent, OpViewComponent], changeDetection: ChangeDetectionStrategy.Default,
  template: `<app-card title="Allocation check"><div class="row g-2 align-items-end"><div class="col-md-5"><app-employee-picker label="Employee" [ngModel]="emp()" (ngModelChange)="emp.set($event)" /></div><div class="col-md-3"><input type="date" class="form-control" [ngModel]="date()" (ngModelChange)="date.set($event)" /></div></div>
    @if (emp()) { <div class="mt-3"><app-op-view op="project.check" [path]="{ id: id() }" [query]="{ employeeId: emp(), date: date() }" [bare]="true" /></div> }</app-card>`,
})
export class AllocationCheckComponent { id = input.required<string>(); emp = signal<string | null>(null); date = signal(isoDate(new Date())); }

@Component({
  selector: 'app-project-ts-report', standalone: true, imports: [FormsModule, OpViewComponent], changeDetection: ChangeDetectionStrategy.Default,
  template: `<div class="mb-3 d-flex gap-2"><input type="date" class="form-control" style="width:auto" [ngModel]="from()" (ngModelChange)="from.set($event)" /><input type="date" class="form-control" style="width:auto" [ngModel]="to()" (ngModelChange)="to.set($event)" /></div>
    <app-op-view op="timesheet.project" [path]="{ projectId: id() }" [query]="{ from: from(), to: to() }" title="Project hours" />`,
})
export class ProjectTimesheetReportComponent { id = input.required<string>(); from = signal(isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))); to = signal(isoDate(new Date())); }

@Component({
  selector: 'app-project-detail-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, RouterLink, CardComponent, ErrorStateComponent, LoadingBlockComponent, StatusBadgeComponent, DetailComponent, SafeHtmlComponent, EmployeeNameComponent, CrudSectionComponent, OpButtonComponent, OpViewComponent, TabsComponent, TabDirective, ProgressBarComponent, AllocationCheckComponent, ProjectTimesheetReportComponent],
  template: `@if (q.isLoading()) { <app-loading-block [rows]="5" /> } @else if (q.isError()) { <app-error-state [error]="q.error()" (retry)="q.refetch()" /> } @else {
  <div class="hr-card mb-3"><div class="hr-card-body d-flex flex-wrap align-items-center gap-3"><div class="flex-grow-1"><h1 class="page-title">{{ p().name }} <app-status-badge [value]="p().status" /></h1>
    <div class="text-muted" style="font-size:13px">{{ p().code }} · @if (p().customerId) { <a [routerLink]="['/customers', p().customerId]">{{ refs.label('customer', p().customerId) }}</a> } @else { — } · {{ 'common.manager' | translate }}: <app-employee-name [id]="p().projectManagerId" /></div>
    <div class="mt-2" style="max-width:360px"><app-progress-bar [value]="prog()" /></div></div>
    <app-op-button op="project.update" [path]="{ id: id() }" [initial]="p()" [label]="'common.edit' | translate" icon="pi-pencil" dialogSize="lg" [overrides]="{ description: { rich: true }, status: { hidden: true } }" />
    <app-op-button op="project.status" [path]="{ id: id() }" [label]="'common.status' | translate" icon="pi-flag" /><app-op-button op="project.manager" [path]="{ id: id() }" [label]="'common.manager' | translate" icon="pi-user-edit" /></div></div>
  <app-tabs>
    <ng-template appTab="overview" [label]="'common.overview' | translate"><app-card><app-detail [data]="p()" [hide]="['id', 'description', 'version']" />@if (p().description) { <div class="mt-3"><div class="field-label">{{ 'fields.description' | translate }}</div><app-safe-html [html]="p().description" /></div> }</app-card></ng-template>
    <ng-template appTab="team" label="Team & allocation"><div class="d-grid gap-3"><app-crud-section title="Project members" [list]="{ op: 'project.team', path: { id: id() } }" [create]="{ op: 'project.allocate', path: { id: id() } }" [update]="{ op: 'project.updateAllocation', path: ap }" [remove]="{ op: 'project.endAllocation', path: ap }" tableId="proj-team" /><app-allocation-check [id]="id()" /></div></ng-template>
    <ng-template appTab="timesheets" [label]="'nav.timesheets' | translate"><app-project-ts-report [id]="id()" /></ng-template>
    <ng-template appTab="history" [label]="'common.history' | translate"><app-op-view op="project.history" [path]="{ id: id() }" [title]="'common.history' | translate" /></ng-template>
  </app-tabs> }`,
})
export class ProjectDetailPage {
  private store = inject(Store); refs = inject(RefService); id = input.required<string>();
  q = injectOp<any>('project.get', () => ({ path: { id: this.id() } })); p = computed(() => this.q.data() ?? {});
  prog = computed(() => scheduleProgress(this.p().startDate, this.p().endDate, this.p().status)); ap = (r: any) => ({ id: this.id(), allocationId: r.id });
  constructor() { effect(() => { const p = this.q.data(); if (p?.name) untracked(() => this.store.dispatch(RecentActions.visited({ record: { id: 'p' + this.id(), kind: 'project', title: p.name, link: `/projects/${this.id()}`, at: Date.now() } }))); }); }
}
