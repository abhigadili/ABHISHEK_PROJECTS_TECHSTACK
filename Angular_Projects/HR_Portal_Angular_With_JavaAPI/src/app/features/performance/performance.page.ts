import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { PermissionService } from '../../core/services/permission.service';
import { ChartCardComponent } from '../../shared/charts/chart-card.component';
import { barOption, donutOption } from '../../shared/charts/chart-options';
import { ModalComponent } from '../../shared/components/modal.component';
import { RefService } from '../../shared/components/ref.service';
import { SafeHtmlComponent } from '../../shared/components/safe-html.component';
import { CardComponent, LoadingBlockComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { DetailComponent } from '../../shared/components/value.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { EmployeeScopeComponent } from '../../shared/op/employee-scope.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { DataTableComponent, type Col } from '../../shared/tables/data-table.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';

const RICH_SELF = { achievements: { rich: true }, strengths: { rich: true }, improvementAreas: { rich: true } };
const RICH_MGR = { managerFeedback: { rich: true }, strengths: { rich: true }, improvementAreas: { rich: true } };
const FB = { comment: { rich: true } };
const FIELDS = ['achievements', 'strengths', 'improvementAreas', 'managerFeedback', 'hrComment'];

@Component({
  selector: 'app-review-detail', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, ModalComponent, DetailComponent, SafeHtmlComponent, DataTableComponent, OpViewComponent, OpButtonComponent, LoadingBlockComponent],
  template: `<app-modal [open]="true" [title]="'Review · ' + (r()?.employeeName ?? '')" size="xl" (closed)="closed.emit()">
    @if (q.isLoading()) { <app-loading-block /> }
    @if (r(); as r) { <div class="d-grid gap-3">
      <app-detail [data]="r" [hide]="['id','answers','achievements','strengths','improvementAreas','managerFeedback','hrComment']" />
      @for (k of present(); track k) { <div><div class="field-label">{{ ('fields.' + k) | translate }}</div><app-safe-html [html]="r[k]" /></div> }
      @if (r.answers?.length) { <div><div class="field-label">Answers</div><app-data-table id="rev-answers" [rows]="r.answers" /></div> }
      <app-op-view op="performance.trail" [path]="{ id: id() }" title="Review history" />
      @if (r.formId) { <app-op-view op="performance.form" [path]="{ id: r.formId }" title="Review form" /> }</div> }
    <ng-container footer>@if (r(); as r) {
      @if ((isOwner() || !self()) && r.status === 'SELF_PENDING') { <app-op-button op="performance.saveSelf" [path]="{ id: id() }" [initial]="r" label="Save self-evaluation" size="md" dialogSize="xl" [overrides]="rs" /><app-op-button op="performance.submitSelf" [path]="{ id: id() }" label="Submit self-evaluation" variant="primary" size="md" /> }
      @if (perm.canCall('performance.saveManager') && r.status === 'SELF_SUBMITTED') { <app-op-button op="performance.saveManager" [path]="{ id: id() }" [initial]="r" label="Manager evaluation" size="md" dialogSize="xl" [overrides]="rm" /><app-op-button op="performance.submitManager" [path]="{ id: id() }" label="Submit evaluation" variant="primary" size="md" /><app-op-button op="performance.returnReview" [path]="{ id: id() }" label="Return to employee" icon="pi-undo" size="md" [overrides]="fb" /> }
      @if (perm.canCall('performance.approve') && r.status === 'MANAGER_SUBMITTED') { <app-op-button op="performance.approve" [path]="{ id: id() }" [label]="'common.approve' | translate" icon="pi-check" variant="success" size="md" [overrides]="fb" /> } }</ng-container>
  </app-modal>`,
})
export class ReviewDetailComponent {
  perm = inject(PermissionService); id = input.required<string>(); closed = output<void>(); rs = RICH_SELF; rm = RICH_MGR; fb = FB;
  self = computed(() => this.perm.user()?.employeeId);
  q = injectOp<any>('performance.review', () => ({ path: { id: this.id() } })); r = computed(() => this.q.data());
  isOwner = computed(() => this.r()?.employeeId === this.self());
  present = computed(() => FIELDS.filter((k) => this.r()?.[k]));
}

@Component({
  selector: 'app-my-reviews', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CardComponent, OpTableComponent, ReviewDetailComponent],
  template: `<app-card title="My reviews"><app-op-table op="performance.myReviews" tableId="my-reviews" [rowClickable]="true" (rowClick)="open.set($event.id)" [columns]="cols" /></app-card>@if (open(); as o) { <app-review-detail [id]="o" (closed)="open.set(null)" /> }`,
})
export class MyReviewsComponent { open = signal<string | null>(null); cols: Col[] = [{ key: 'cycleId' }, { key: 'status' }, { key: 'selfRating' }, { key: 'managerRating' }, { key: 'finalRating' }, { key: 'managerId', hidden: true }]; }

@Component({
  selector: 'app-goals', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, CrudSectionComponent, OpButtonComponent],
  template: `<app-crud-section title="Goals & OKRs" [list]="list()" tableId="goals" [create]="employeeId() ? undefined : { op: 'performance.createGoal' }" [update]="{ op: 'performance.updateGoal', path: idp }" [remove]="employeeId() ? undefined : { op: 'performance.deleteGoal', path: idp }" dialogSize="lg" [columns]="cols" [extraRowActions]="acts">
    @if (!employeeId()) { <select actions class="form-select" style="width:auto" [ngModel]="cycle()" (ngModelChange)="cycle.set($event)" aria-label="cycle"><option value="">All cycles</option>@for (c of cycles(); track c.value) { <option [value]="c.value">{{ c.label }}</option> }</select> }</app-crud-section>
    <ng-template #acts let-r><app-op-button op="performance.progress" [path]="{ id: r.id }" label="Progress" variant="ghost" />@for (k of krs(r); track k.id) { <app-op-button op="performance.keyResult" [path]="{ id: r.id, keyResultId: k.id }" [label]="'KR: ' + short(k)" variant="ghost" /> }</ng-template>`,
})
export class GoalsComponent {
  employeeId = input<string>(); cycle = signal(''); cycles = inject(RefService).options('cycle'); idp = (r: any) => ({ id: r.id });
  list = computed(() => (this.employeeId() ? { op: 'performance.goalsOf', path: { employeeId: this.employeeId()! } } : { op: 'performance.myGoals', query: { cycleId: this.cycle() } }));
  cols: Col[] = [{ key: 'title' }, { key: 'type' }, { key: 'status' }, { key: 'progress', fmt: (v) => (v != null ? `${v}%` : '—') }, { key: 'weight' }, { key: 'targetDate' }, { key: 'cycleId', hidden: true }];
  krs = (r: any): any[] => (r.keyResults ?? []).slice(0, 4); short = (k: any) => String(k.title ?? k.description ?? 'result').slice(0, 14);
}

@Component({
  selector: 'app-team-reviews', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CardComponent, OpTableComponent, ReviewDetailComponent],
  template: `<app-card title="Reviews awaiting my action"><app-op-table op="performance.pending" tableId="rev-pending" [rowClickable]="true" (rowClick)="open.set($event.id)" [columns]="cols" /></app-card>@if (open(); as o) { <app-review-detail [id]="o" (closed)="open.set(null)" /> }`,
})
export class TeamReviewsComponent { open = signal<string | null>(null); cols: Col[] = [{ key: 'employeeName' }, { key: 'cycleId' }, { key: 'status' }, { key: 'selfRating' }, { key: 'managerRating' }]; }

@Component({
  selector: 'app-cycles-admin', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, CardComponent, CrudSectionComponent, OpButtonComponent, DetailComponent, ChartCardComponent],
  template: `<div class="d-grid gap-3">
    <app-crud-section title="Review cycles" [list]="{ op: 'performance.cycles' }" [create]="{ op: 'performance.createCycle' }" dialogSize="lg" tableId="cycles" [extraRowActions]="acts"><app-op-button actions op="performance.runReminders" label="Send reminders" /></app-crud-section>
    <app-card title="Cycle summary"><select actions class="form-select" style="width:auto" [ngModel]="cycle()" (ngModelChange)="cid.set($event)" aria-label="cycle">@for (c of cycles.data() ?? []; track c.id) { <option [value]="c.id">{{ c.name }}</option> }</select>
      @if (sum.data(); as s) { <app-detail [data]="s" [hide]="['cycleId']" /><div class="row g-3 mt-1"><div class="col-lg-6"><app-chart-card title="Reviews by status" [empty]="!st().length" [build]="bSt" /></div><div class="col-lg-6"><app-chart-card title="Final rating distribution" [empty]="!dist().length" [build]="bDist" /></div></div> }</app-card>
    <app-crud-section title="Review forms" [list]="{ op: 'performance.forms' }" [create]="{ op: 'performance.createForm' }" [update]="{ op: 'performance.updateForm', path: idp }" [view]="{ op: 'performance.form', path: idp }" dialogSize="xl" /></div>
    <ng-template #acts let-r>@if (r.status === 'DRAFT') { <app-op-button op="performance.activate" [path]="{ id: r.id }" icon="pi-play" label="Activate" variant="outline" /> }@if (r.status === 'ACTIVE') { <app-op-button op="performance.close" [path]="{ id: r.id }" icon="pi-stop" label="Close" variant="outline" /> }</ng-template>`,
})
export class CyclesAdminComponent {
  cid = signal(''); idp = (r: any) => ({ id: r.id });
  cycles = injectOp<any[]>('performance.cycles'); cycle = computed(() => this.cid() || this.cycles.data()?.[0]?.id || '');
  sum = injectOp<any>('performance.summary', () => ({ path: { id: this.cycle() } }), () => ({ enabled: !!this.cycle() }));
  dist = computed(() => Object.entries(this.sum.data()?.finalRatingDistribution ?? {}).map(([name, count]) => ({ name, count })));
  st = computed(() => Object.entries(this.sum.data()?.byStatus ?? {}).map(([name, value]) => ({ name, value: Number(value) })));
  bSt = (d: boolean) => donutOption(d, this.st()); bDist = (d: boolean) => barOption(d, this.dist(), 'name', [{ key: 'count', label: 'Employees' }]);
}

@Component({
  selector: 'app-performance-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, MyReviewsComponent, GoalsComponent, TeamReviewsComponent, CyclesAdminComponent, CrudSectionComponent, EmployeeScopeComponent, OpViewComponent],
  template: `<app-page-header [title]="'hr.performance.title' | translate" [subtitle]="'hr.performance.sub' | translate" />
  <app-tabs>
    <ng-template appTab="reviews" label="My reviews" [hidden]="!self()"><app-my-reviews /></ng-template>
    <ng-template appTab="goals" label="My goals" [hidden]="!self()"><app-goals /></ng-template>
    <ng-template appTab="feedback" label="Feedback" [hidden]="!perm.canCall('performance.aboutMe')"><app-crud-section title="Feedback about me" [list]="{ op: 'performance.aboutMe' }" [create]="{ op: 'performance.give' }" /></ng-template>
    <ng-template appTab="team" label="Team reviews" [hidden]="!perm.canCall('performance.pending')"><app-team-reviews /></ng-template>
    <ng-template appTab="cycles" label="Cycles & forms" [hidden]="!perm.canCall('performance.createCycle')"><app-cycles-admin /></ng-template>
    <ng-template appTab="employee" label="Employee performance" [hidden]="!perm.canCall('performance.history') || !perm.isManager()"><app-employee-scope><ng-template let-id><div class="d-grid gap-3">
      <app-op-view op="performance.history" [path]="{ employeeId: id }" title="Review history" /><app-goals [employeeId]="id" /><app-op-view op="performance.about" [path]="{ employeeId: id }" title="Feedback" /></div></ng-template></app-employee-scope></ng-template>
  </app-tabs>`,
})
export class PerformancePage { perm = inject(PermissionService); self = computed(() => !!this.perm.user()?.employeeId); }
export default PerformancePage;
