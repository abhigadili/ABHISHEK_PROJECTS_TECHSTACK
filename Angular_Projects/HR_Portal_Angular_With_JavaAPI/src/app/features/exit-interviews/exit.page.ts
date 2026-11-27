import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { injectOpMutation } from '../../api/mutations/op-mutation';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { ChartCardComponent } from '../../shared/charts/chart-card.component';
import { donutOption } from '../../shared/charts/chart-options';
import { EmployeeNameComponent } from '../../shared/components/employee.components';
import { ModalComponent } from '../../shared/components/modal.component';
import { RichTextEditorComponent } from '../../shared/components/rich-text-editor.component';
import { SafeHtmlComponent } from '../../shared/components/safe-html.component';
import { CardComponent, LoadingBlockComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { DetailComponent } from '../../shared/components/value.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { type Col } from '../../shared/tables/data-table.component';
import { OpTableComponent } from '../../shared/tables/op-table.component';

const STEPS = ['SUBMITTED', 'MANAGER_APPROVED', 'HR_CONFIRMED', 'CLEARED', 'INTERVIEW_DONE', 'SETTLEMENT_PENDING', 'COMPLETED'];
const COLS: Col[] = [{ key: 'employeeName' }, { key: 'submittedOn' }, { key: 'requestedLastWorkingDay' }, { key: 'confirmedLastWorkingDay', hidden: true }, { key: 'noticePeriodDays', hidden: true }, { key: 'departmentId', hidden: true }, { key: 'status' }];
const RC = { comment: { rich: true } };

/** Exit-interview questionnaire (dynamic Reactive Form built from GET /exit/interview-form); answers go to POST .../interview/complete. */
@Component({
  selector: 'app-interview-dialog', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [ReactiveFormsModule, TranslateModule, ModalComponent, RichTextEditorComponent, LoadingBlockComponent],
  template: `<app-modal [open]="true" [title]="form.data()?.name ?? 'Exit interview'" size="lg" (closed)="closed.emit()">
    @if (form.isLoading()) { <app-loading-block /> } @else {
    <form [formGroup]="fg" class="d-grid gap-3" id="iv-form" (ngSubmit)="submit()">
      <div formGroupName="answers" class="d-grid gap-3">@for (q of qs(); track q.id) { <div><label class="field-label">{{ q.text }}@if (isReq(q)) { <span class="text-danger"> *</span> }</label>
        @if (q.type === 'RATING') { <select class="form-select" [formControlName]="q.id"><option value="">—</option>@for (n of [1,2,3,4,5]; track n) { <option>{{ n }}</option> }</select> }
        @else if (q.type === 'BOOLEAN') { <select class="form-select" [formControlName]="q.id"><option value="">—</option><option>Yes</option><option>No</option></select> }
        @else { <textarea class="form-control" rows="3" [formControlName]="q.id"></textarea> }
        @if (fg.get('answers.' + q.id)?.touched && fg.get('answers.' + q.id)?.invalid) { <div class="field-error">{{ 'common.validation.required' | translate }}</div> }</div> }</div>
      <div><label class="field-label">Feedback summary (HR)</label><app-rich-text-editor formControlName="feedbackSummary" [minHeight]="140" /></div>
      <div><label class="field-label">Would recommend the company?</label><select class="form-select" formControlName="wouldRecommend"><option value="">—</option><option value="yes">{{ 'common.yes' | translate }}</option><option value="no">{{ 'common.no' | translate }}</option></select></div></form> }
    <ng-container footer><button type="button" class="btn-hr outline" (click)="closed.emit()">{{ 'common.cancel' | translate }}</button><button type="submit" form="iv-form" class="btn-hr primary ms-2" [disabled]="m.isPending()">{{ 'common.submit' | translate }}</button></ng-container></app-modal>`,
})
export class InterviewDialogComponent {
  private fb = inject(FormBuilder); private toast = inject(ToastService);
  resignationId = input.required<string>(); closed = output<void>();
  form = injectOp<any>('exit.form'); qs = computed<any[]>(() => this.form.data()?.questions ?? []);
  fg = this.fb.group({ answers: this.fb.group({}), feedbackSummary: [''], wouldRecommend: [''] });
  m = injectOpMutation('exit.completeInterview', () => ({ onSuccess: () => this.closed.emit() }));
  isReq = (q: any) => String(q.required) === 'true';
  constructor() {
    effect(() => { const qs = this.qs(); untracked(() => { const g = this.fb.group({}); qs.forEach((q) => g.addControl(q.id, this.fb.control('', this.isReq(q) ? Validators.required : null))); this.fg.setControl('answers', g); }); });
  }
  submit() {
    this.fg.markAllAsTouched(); if (this.fg.invalid) { this.toast.error('common.validationFailed'); return; }
    const v = this.fg.getRawValue() as any; const answers: Record<string, string> = {}; Object.entries(v.answers).forEach(([k, a]) => a && (answers[k] = String(a)));
    this.m.mutate({ path: { id: this.resignationId() }, body: { answers, feedbackSummary: v.feedbackSummary || undefined, wouldRecommend: v.wouldRecommend === '' ? undefined : v.wouldRecommend === 'yes' } });
  }
}

@Component({
  selector: 'app-resignation-detail', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, MatStepperModule, ModalComponent, DetailComponent, SafeHtmlComponent, EmployeeNameComponent, CrudSectionComponent, OpButtonComponent, OpViewComponent, LoadingBlockComponent, InterviewDialogComponent],
  template: `<app-modal [open]="true" [title]="'Resignation · ' + (r()?.employeeName ?? '')" size="xl" (closed)="closed.emit()">
    @if (q.isLoading()) { <app-loading-block /> }
    @if (r(); as r) { <div class="d-grid gap-3">
      <mat-stepper [selectedIndex]="step()" [linear]="false" labelPosition="bottom" class="pe-none" style="background:transparent">@for (x of steps; track x) { <mat-step [completed]="steps.indexOf(x) < step() || r.status === 'COMPLETED'" [editable]="false"><ng-template matStepLabel>{{ label(x) }}</ng-template></mat-step> }</mat-stepper>
      <app-detail [data]="r" [hide]="['id', 'reason', 'managerComment', 'hrComment']" /><div>{{ 'common.manager' | translate }}: <app-employee-name [id]="r.managerId" /></div>
      @for (k of present(); track k) { <div><div class="field-label">{{ ('fields.' + k) | translate }}</div><app-safe-html [html]="r[k]" /></div> }
      <app-crud-section title="Exit tasks / clearance" [list]="{ op: 'exit.tasks', path: { id: id() } }" [create]="{ op: 'exit.addTask', path: { id: id() } }" tableId="exit-tasks" [extraRowActions]="taskAct" />
      <app-op-view op="exit.interview" [path]="{ id: id() }" title="Exit interview" [hide]="['answers']" /><app-op-view op="exit.settlement" [path]="{ id: id() }" title="Final settlement" /><app-op-view op="exit.history" [path]="{ id: id() }" title="History" /></div> }
    <ng-template #taskAct let-row>@if (row.status !== 'DONE' && row.status !== 'COMPLETED') { <app-op-button op="exit.complete" [path]="{ taskId: row.id }" label="Complete" variant="ghost" icon="pi-check" /> }</ng-template>
    @if (iv()) { <app-interview-dialog [resignationId]="id()" (closed)="iv.set(false); q.refetch()" /> }
    <ng-container footer>@if (r(); as r) {
      @if (r.employeeId === self() && (r.status === 'SUBMITTED' || r.status === 'MANAGER_APPROVED')) { <app-op-button op="exit.withdraw" [path]="{ id: id() }" label="Withdraw" size="md" /> }
      @if (perm.canCall('exit.managerDecision') && r.status === 'SUBMITTED') { <app-op-button op="exit.managerDecision" [path]="{ id: id() }" label="Manager decision" size="md" variant="primary" [overrides]="rc" /> }
      @if (perm.canCall('exit.confirm') && r.status === 'MANAGER_APPROVED') { <app-op-button op="exit.confirm" [path]="{ id: id() }" label="HR confirm" size="md" variant="primary" [overrides]="rc" /> }
      @if (perm.canCall('exit.confirm') && (r.status === 'HR_CONFIRMED' || r.status === 'CLEARED')) { <app-op-button op="exit.schedule" [path]="{ id: id() }" label="Schedule interview" size="md" /><button type="button" class="btn-hr primary" (click)="iv.set(true)">Complete interview</button> }
      @if (perm.canCall('exit.calculate') && (r.status === 'INTERVIEW_DONE' || r.status === 'SETTLEMENT_PENDING')) { <app-op-button op="exit.calculate" [path]="{ id: id() }" label="Calculate settlement" size="md" /><app-op-button op="exit.process" [path]="{ id: id() }" label="Process settlement" size="md" variant="primary" /> }
      @if (perm.canCall('exit.confirm') && (r.status === 'SETTLEMENT_PENDING' || r.status === 'INTERVIEW_DONE')) { <app-op-button op="exit.completeExit" [path]="{ id: id() }" label="Complete exit" size="md" variant="success" icon="pi-check" confirm="Complete the exit? The employee account is deactivated." /> } }</ng-container>
  </app-modal>`,
})
export class ResignationDetailComponent {
  perm = inject(PermissionService); id = input.required<string>(); closed = output<void>(); iv = signal(false); steps = STEPS; rc = RC;
  self = computed(() => this.perm.user()?.employeeId);
  q = injectOp<any>('exit.get', () => ({ path: { id: this.id() } })); r = computed(() => this.q.data());
  step = computed(() => Math.max(0, STEPS.indexOf(this.r()?.status)));
  present = computed(() => ['reason', 'managerComment', 'hrComment'].filter((k) => this.r()?.[k]));
  label = (x: string) => x.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

@Component({
  selector: 'app-exit-mine', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CardComponent, OpButtonComponent, OpTableComponent, ResignationDetailComponent],
  template: `<app-card title="My resignation"><app-op-button actions op="exit.submit" label="Submit resignation" variant="primary" size="md" [overrides]="{ reason: { rich: true } }" /><app-op-table op="exit.mine" tableId="exit-mine" [columns]="cols" [rowClickable]="true" (rowClick)="open.set($event.id)" /></app-card>
    @if (open(); as o) { <app-resignation-detail [id]="o" (closed)="open.set(null)" /> }`,
})
export class ExitMineComponent { open = signal<string | null>(null); cols = COLS; }

@Component({
  selector: 'app-exit-pending', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [CardComponent, OpButtonComponent, OpTableComponent, ResignationDetailComponent],
  template: `<app-card title="Awaiting my decision"><app-op-table op="exit.pending" tableId="exit-pending" [columns]="cols" [rowClickable]="true" (rowClick)="open.set($event.id)" [rowActions]="act" /></app-card>
    @if (open(); as o) { <app-resignation-detail [id]="o" (closed)="open.set(null)" /> }
    <ng-template #act let-r><app-op-button op="exit.managerDecision" [path]="{ id: r.id }" label="Decide" icon="pi-times" variant="outline" [overrides]="rc" /></ng-template>`,
})
export class ExitPendingComponent { open = signal<string | null>(null); cols = COLS; rc = RC; }

@Component({
  selector: 'app-exit-all', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [FormsModule, ChartCardComponent, OpTableComponent, ResignationDetailComponent],
  template: `<div class="d-grid gap-3"><div class="row g-3"><div class="col-lg-4"><app-chart-card [title]="'Exit status · total ' + (sum.data()?.total ?? 0)" [loading]="sum.isLoading()" [error]="sum.error()" [empty]="!data().length" [height]="220" [build]="build" /></div>
    <div class="col-lg-8"><app-op-table op="exit.list" tableId="exit-all" [columns]="cols" [query]="{ status: status() }" [rowClickable]="true" (rowClick)="open.set($event.id)">
      <select filters class="form-select" style="width:auto" [ngModel]="status()" (ngModelChange)="status.set($event)" aria-label="status"><option value="">All</option>@for (s of all; track s) { <option>{{ s }}</option> }</select></app-op-table></div></div>
    @if (open(); as o) { <app-resignation-detail [id]="o" (closed)="open.set(null)" /> }</div>`,
})
export class ExitAllComponent {
  open = signal<string | null>(null); status = signal(''); cols = COLS; all = STEPS.concat(['MANAGER_REJECTED', 'WITHDRAWN']);
  sum = injectOp<any>('exit.summary'); data = computed(() => Object.entries(this.sum.data()?.byStatus ?? {}).map(([name, value]) => ({ name, value: Number(value) })));
  build = (dark: boolean) => donutOption(dark, this.data());
}

@Component({
  selector: 'app-exit-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, ExitMineComponent, ExitPendingComponent, ExitAllComponent, OpViewComponent, OpButtonComponent],
  template: `<app-page-header [title]="'hr.exit.title' | translate" [subtitle]="'hr.exit.sub' | translate" />
  <app-tabs>
    <ng-template appTab="mine" [label]="'nav.myWorkspace' | translate" [hidden]="!self()"><app-exit-mine /></ng-template>
    <ng-template appTab="pending" [label]="'hr.leave.approvals' | translate" [hidden]="!perm.canCall('exit.pending')"><app-exit-pending /></ng-template>
    <ng-template appTab="all" label="All resignations" [hidden]="!perm.canCall('exit.list')"><app-exit-all /></ng-template>
    <ng-template appTab="policy" [label]="'hr.leave.policy' | translate" [hidden]="!perm.canCall('exit.policy')"><app-op-view op="exit.policy" title="Exit policy"><span actions><app-op-button op="exit.updatePolicy" label="Edit policy" variant="primary" /></span></app-op-view></ng-template>
  </app-tabs>`,
})
export class ExitPage { perm = inject(PermissionService); self = computed(() => !!this.perm.user()?.employeeId); }
export default ExitPage;
