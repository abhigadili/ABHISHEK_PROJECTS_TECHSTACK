import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { injectOpMutation } from '../../api/mutations/op-mutation';
import { LanguageService } from '../../core/services/language.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent, LoadingBlockComponent } from '../../shared/components/ui.components';
import { SafeHtmlComponent } from '../../shared/components/safe-html.component';
import { StatusBadgeComponent } from '../../shared/components/value.components';
import { OpButtonComponent } from '../../shared/op/op-button.component';
import { addDays, isoDate, parseDate, startOfWeek } from '../../shared/utilities/date';
import { uiStore } from '../../state/zustand-style/ui.store';

const num = (s: unknown) => { const n = parseFloat(String(s ?? '')); return Number.isFinite(n) ? n : 0; };
const HOURS = /^\d{0,2}(\.\d{0,2})?$/;

/** Tasks of the selected project (GET /timesheet/tasks?projectId=) for one grid row. */
@Component({
  selector: 'app-ts-task-select', standalone: true, imports: [ReactiveFormsModule], changeDetection: ChangeDetectionStrategy.Default,
  template: `<select class="form-select" style="font-size:12px;padding:2px 24px 2px 6px" [formControl]="ctrl()" aria-label="task" (change)="picked()"><option value="">— task —</option>@for (t of q.data() ?? []; track t.id) { <option [value]="t.id">{{ t.name }}</option> }</select>`,
})
export class TaskSelectComponent {
  projectId = input.required<string>(); ctrl = input.required<FormControl>(); billable = input<FormControl>();
  q = injectOp<any[]>('timesheet.tasks', () => ({ query: { projectId: this.projectId() } }), () => ({ enabled: !!this.projectId() }));
  picked() { const t = (this.q.data() ?? []).find((x) => x.id === this.ctrl().value); if (t?.billable !== undefined) this.billable()?.setValue(!!t.billable); }
}

/** Server-side totals for the week (GET .../totals) next to the locally computed ones. */
@Component({
  selector: 'app-ts-server-totals', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (q.data(); as d) { <span class="text-muted" style="font-size:12px">Saved total: <strong>{{ (+(d.weekTotal ?? 0)).toFixed(2) }} h</strong></span> }`,
})
export class ServerTotalsComponent { week = input.required<string>(); q = injectOp<any>('timesheet.totals', () => ({ path: { weekStart: this.week() } })); }

/** Editable weekly timesheet (Reactive Forms: FormArray of rows x FormArray of 7 days): live totals, save (PUT /me/entries) and submit. */
@Component({
  selector: 'app-weekly-grid', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [ReactiveFormsModule, TranslateModule, CardComponent, LoadingBlockComponent, StatusBadgeComponent, OpButtonComponent, TaskSelectComponent, ServerTotalsComponent, SafeHtmlComponent],
  template: `@if (q.isLoading()) { <app-loading-block [rows]="5" /> } @else {
  <app-card [title]="range()"><span actions class="d-flex gap-2 align-items-center flex-wrap">
      <button type="button" class="btn-hr outline icon" (click)="shift(-7)" [attr.aria-label]="'common.previous' | translate"><i class="pi pi-chevron-left"></i></button>
      <button type="button" class="btn-hr outline icon" (click)="shift(7)" [attr.aria-label]="'common.next' | translate"><i class="pi pi-chevron-right"></i></button>
      <button type="button" class="btn-hr ghost sm" (click)="week.set(thisWeek())">{{ 'common.today' | translate }}</button><app-status-badge [value]="status()" />
      <button type="button" class="btn-hr outline" (click)="doSave()" [disabled]="!editable() || save.isPending()">{{ 'common.save' | translate }}</button>
      <app-op-button op="timesheet.saveDay" label="Log a day" variant="outline" size="md" [initial]="{ workDate: week(), billable: true }" />
      <app-op-button op="timesheet.submit" [path]="{ weekStart: week() }" [label]="'common.submit' | translate" variant="primary" size="md" confirm="Submit this week for approval? You cannot edit it afterwards." /></span>
    @if (q.data()?.decisionComment) { <div class="mb-3 rounded-2 p-2" style="font-size:12px;background:rgb(var(--hr-warning-rgb)/.15)"><strong>{{ status() }}:</strong> <app-safe-html [html]="q.data().decisionComment" /></div> }
    <div style="overflow:auto"><form [formGroup]="form"><table class="table align-middle m-0" style="font-size:13px;min-width:760px">
      <thead><tr><th>Project</th><th>Task</th><th>Billable</th>@for (d of days(); track d.iso) { <th class="text-center">{{ d.label }}</th> }<th class="text-end">Σ</th><th></th></tr></thead>
      <tbody formArrayName="rows">@for (row of rows.controls; track row; let ri = $index) { <tr [formGroupName]="ri">
        <td><select class="form-select" style="font-size:12px;padding:2px 24px 2px 6px" formControlName="projectId" (change)="row.get('taskId')!.setValue('')" aria-label="project"><option value="">— project —</option>@for (p of projects(); track p.id) { <option [value]="p.id">{{ p.name }}</option> }</select></td>
        <td><app-ts-task-select [projectId]="row.value.projectId" [ctrl]="$any(row.get('taskId'))" [billable]="$any(row.get('billable'))" /></td>
        <td class="text-center"><input type="checkbox" formControlName="billable" aria-label="billable" /></td>
        <ng-container formArrayName="hours">@for (d of days(); track d.iso; let di = $index) { <td><input inputmode="decimal" class="form-control text-center" style="width:62px;padding:3px" [formControlName]="di" [attr.aria-label]="d.label + ' hours'" /></td> }</ng-container>
        <td class="text-end fw-semibold">{{ rowTotal(ri).toFixed(2) }}</td><td>@if (editable()) { <button type="button" class="btn-hr ghost icon" (click)="rows.removeAt(ri); persist()" aria-label="remove row"><i class="pi pi-trash"></i></button> }</td></tr> }</tbody>
      <tfoot><tr><td colspan="3" class="fw-semibold">Total</td>@for (h of dayTotals(); track $index) { <td class="text-center fw-semibold" [style.color]="h > 24 ? 'var(--hr-danger)' : ''">{{ h.toFixed(2) }}</td> }<td class="text-end fw-bold">{{ total().toFixed(2) }}</td><td></td></tr></tfoot></table></form></div>
    <div class="mt-2 d-flex flex-wrap align-items-center gap-3">
      @if (editable()) { <button type="button" class="btn-hr soft sm" (click)="addRow()"><i class="pi pi-plus"></i>Add row</button> }
      <span class="text-muted" style="font-size:12px">Billable {{ billable().toFixed(2) }} h · Non-billable {{ (total() - billable()).toFixed(2) }} h</span>
      <app-ts-server-totals [week]="week()" />
      @if (!projects().length) { <span style="font-size:12px;color:var(--hr-warning)">No project allocations found for you — ask a project manager to allocate you.</span> }</div></app-card> }`,
})
export class WeeklyGridComponent {
  private fb = inject(FormBuilder); private perm = inject(PermissionService); private toast = inject(ToastService); private lang = inject(LanguageService);
  week = signal(isoDate(startOfWeek(new Date(), uiStore.get().weekStartsOn)));
  thisWeek = () => isoDate(startOfWeek(new Date(), uiStore.get().weekStartsOn));
  form = this.fb.group({ rows: this.fb.array<FormGroup>([]) }); get rows() { return this.form.get('rows') as FormArray<FormGroup>; }
  private self = computed(() => this.perm.user()?.employeeId ?? '');
  q = injectOp<any>('timesheet.week', () => ({ path: { weekStart: this.week() } }));
  projQ = injectOp<any[]>('project.employeeProjects', () => ({ path: { employeeId: this.self() } }), () => ({ enabled: !!this.self() }));
  projects = computed(() => (this.projQ.data() ?? []).filter((p) => !p.projectStatus || p.projectStatus === 'ACTIVE').map((p) => ({ id: p.projectId ?? p.id, name: p.projectName ?? p.name ?? p.projectCode ?? p.projectId ?? p.id })));
  days = computed(() => Array.from({ length: 7 }, (_, i) => { const d = addDays(parseDate(this.week()), i); return { iso: isoDate(d), label: `${this.lang.weekday(d)} ${d.getDate()}` }; }));
  range = computed(() => { const d = this.days(); return `${this.lang.date(parseDate(d[0].iso))} – ${this.lang.date(parseDate(d[6].iso))}`; });
  status = computed(() => this.q.data()?.status ?? 'DRAFT');
  editable = computed(() => ['DRAFT', 'REJECTED'].includes(this.status()) || !this.q.data());
  private tick = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  private rev = signal(0);
  private values = computed(() => { this.tick(); this.rev(); return this.rows.getRawValue() as { projectId: string; taskId: string; billable: boolean; hours: string[] }[]; });
  dayTotals = computed(() => Array.from({ length: 7 }, (_, i) => this.values().reduce((a, l) => a + num(l.hours[i]), 0)));
  total = computed(() => this.dayTotals().reduce((a, b) => a + b, 0));
  billable = computed(() => this.values().filter((l) => l.billable).reduce((a, l) => a + l.hours.reduce((x, h) => x + num(h), 0), 0));
  rowTotal = (i: number) => (this.values()[i]?.hours ?? []).reduce((a, h) => a + num(h), 0);
  save = injectOpMutation('timesheet.saveWeek', () => ({ onSuccess: () => { const d = { ...uiStore.get().drafts }; delete d[`ts-${this.week()}`]; uiStore.set({ drafts: d }); } }));

  private mkRow(l?: { projectId?: string; taskId?: string; billable?: boolean; hours?: string[] }) {
    return this.fb.group({ projectId: [l?.projectId ?? ''], taskId: [l?.taskId ?? ''], billable: [l?.billable ?? true], hours: this.fb.array((l?.hours ?? Array(7).fill('')).map((h) => this.fb.control(h, (c: any) => (HOURS.test(String(c.value ?? '')) ? null : { hours: true })))) });
  }
  constructor() {
    effect(() => {
      if (this.q.isLoading()) return;
      const week = this.week(); const data = this.q.data();
      untracked(() => {
        const map = new Map<string, any>();
        (data?.entries ?? []).forEach((e: any) => {
          const k = `${e.projectId ?? ''}|${e.taskId ?? ''}|${e.billable ? 1 : 0}`;
          const l = map.get(k) ?? { projectId: e.projectId ?? '', taskId: e.taskId ?? '', billable: !!e.billable, hours: Array(7).fill('') };
          const idx = Math.round((parseDate(e.workDate).getTime() - parseDate(week).getTime()) / 86_400_000); if (idx >= 0 && idx < 7) l.hours[idx] = String(e.hours); map.set(k, l);
        });
        const draft = uiStore.get().drafts[`ts-${week}`] as any[] | undefined;
        this.rows.clear({ emitEvent: false }); (draft?.length ? draft : [...map.values()]).forEach((l) => this.rows.push(this.mkRow(l), { emitEvent: false })); this.rev.update((n) => n + 1);
        this.editable() ? this.rows.enable({ emitEvent: false }) : this.rows.disable({ emitEvent: false });
      });
    });
    this.form.valueChanges.subscribe(() => this.persist());
  }
  persist() { if (this.editable()) uiStore.set((s) => ({ drafts: { ...s.drafts, [`ts-${this.week()}`]: this.values() } })); }
  addRow() { this.rows.push(this.mkRow()); }
  shift(n: number) { this.week.set(isoDate(addDays(parseDate(this.week()), n))); }
  doSave() {
    const vals = this.values(); const days = this.days();
    if (this.dayTotals().some((h) => h > 24)) { this.toast.error('A day cannot exceed 24 hours'); return; }
    if (vals.some((l) => !l.projectId && l.hours.some((h) => num(h) > 0))) { this.toast.error('Choose a project for every row with hours'); return; }
    const entries = vals.flatMap((l) => l.hours.map((h, i) => ({ h, i })).filter((x) => num(x.h) > 0).map((x) => ({ projectId: l.projectId || undefined, taskId: l.taskId || undefined, workDate: days[x.i].iso, hours: num(x.h), billable: l.billable })));
    this.save.mutate({ body: { weekStart: this.week(), entries } });
  }
}
