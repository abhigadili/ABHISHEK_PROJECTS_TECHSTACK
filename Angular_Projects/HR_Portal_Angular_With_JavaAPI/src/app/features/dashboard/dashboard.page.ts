import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { animate, style, transition, trigger } from '@angular/animations';
import { TranslateModule } from '@ngx-translate/core';
import { PermissionService } from '../../core/services/permission.service';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/ui.components';
import { RefService } from '../../shared/components/ref.service';
import { monthStr } from '../../shared/utilities/date';
import { uiStore, type WidgetPref } from '../../state/zustand-style/ui.store';
import { DashAttendanceComponent, DashFilters, DashHeadcountComponent, DashHolidaysComponent, DashJoiningComponent, DashKpisComponent, DashLeavesComponent, DashMyDayComponent, DashOverviewComponent, DashPerformanceComponent, DashProjectsComponent, DashTimesheetsComponent } from './dashboard.widgets';

export const DEFAULT_WIDGETS = ['kpis', 'mine', 'team', 'headcount', 'leaves', 'attendance', 'holidays', 'projects', 'timesheets', 'performance', 'joining'];

@Component({
  selector: 'app-dashboard-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [trigger('card', [transition(':enter', [style({ opacity: 0, transform: 'translateY(10px)' }), animate('220ms ease-out', style({ opacity: 1, transform: 'none' }))])])],
  imports: [FormsModule, TranslateModule, PageHeaderComponent, ModalComponent, CdkDropList, CdkDrag, MatCheckboxModule, DashKpisComponent, DashHeadcountComponent, DashLeavesComponent, DashAttendanceComponent, DashJoiningComponent, DashProjectsComponent, DashTimesheetsComponent, DashPerformanceComponent, DashHolidaysComponent, DashOverviewComponent, DashMyDayComponent],
  template: `
  <app-page-header [title]="'hr.dashboard.title' | translate" [subtitle]="'hr.dashboard.sub' | translate">
    <!-- template-driven quick filters -->
    <form #ff="ngForm" class="d-flex flex-wrap gap-2 align-items-center">
      <input type="month" class="form-control" style="width:auto" name="month" [ngModel]="f().month" (ngModelChange)="setMonth($event)" [attr.aria-label]="'hr.dashboard.range' | translate" />
      <select class="form-select" style="width:auto" name="dept" [ngModel]="f().dept" (ngModelChange)="f.set({ month: f().month, year: f().year, dept: $event })" [attr.aria-label]="'hr.dashboard.department' | translate">
        <option value="">{{ 'common.all' | translate }} · {{ 'common.department' | translate }}</option>@for (d of deps(); track d.value) { <option [value]="d.value">{{ d.label }}</option> }</select></form>
    <button type="button" class="btn-hr outline" (click)="custom.set(true)"><i class="pi pi-sliders-h"></i>{{ 'common.customize' | translate }}</button>
  </app-page-header>

  <app-modal [open]="custom()" [title]="'hr.dashboard.customizeTitle' | translate" [description]="'hr.dashboard.customizeHint' | translate" size="sm" (closed)="custom.set(false)">
    <div cdkDropList (cdkDropListDropped)="drop($event)">
      @for (w of prefs(); track w.id) { <div cdkDrag class="d-flex align-items-center justify-content-between rounded-2 px-2 py-1 mb-1" style="background:var(--hr-surface-2)">
        <span class="d-flex align-items-center gap-2"><i class="pi pi-bars text-muted" cdkDragHandle style="cursor:grab"></i><mat-checkbox [checked]="w.visible" (change)="toggle(w.id)">{{ ('hr.dashboard.w_' + w.id) | translate }}</mat-checkbox></span>
        <span><button type="button" class="btn-hr ghost sm icon" (click)="move(w.id, -1)" aria-label="up"><i class="pi pi-arrow-up"></i></button><button type="button" class="btn-hr ghost sm icon" (click)="move(w.id, 1)" aria-label="down"><i class="pi pi-arrow-down"></i></button></span></div> }</div>
    <ng-container footer><button type="button" class="btn-hr outline" (click)="reset()">{{ 'common.reset' | translate }}</button></ng-container>
  </app-modal>

  <div class="row g-3">
    @if (user()?.employeeId && isVisible('kpis')) { <div class="col-12 col-xl-6" @card><app-dash-my-day /></div> }
    @for (w of shown(); track w.id) {
      <div [class]="w.cls" @card>
        @switch (w.id) {
          @case ('kpis') { <app-dash-kpis [f]="f()" /> } @case ('headcount') { <app-dash-headcount [f]="f()" /> } @case ('leaves') { <app-dash-leaves [f]="f()" /> }
          @case ('attendance') { <app-dash-attendance [f]="f()" /> } @case ('holidays') { <app-dash-holidays /> } @case ('projects') { <app-dash-projects /> }
          @case ('timesheets') { <app-dash-timesheets [f]="f()" /> } @case ('performance') { <app-dash-performance /> } @case ('joining') { <app-dash-joining [f]="f()" /> }
          @case ('mine') { <app-dash-overview op="reporting.employee" title="My overview" /> } @case ('team') { <app-dash-overview op="reporting.manager" title="My team" /> }
        }
      </div> }
  </div>
  @if (hiddenCount() > 0) { <div class="mt-3 text-muted" style="font-size:12px"><i class="pi pi-eye-slash me-1"></i>{{ hiddenCount() }} widget(s) hidden — <button type="button" class="border-0 bg-transparent p-0" style="color:var(--hr-primary)" (click)="reset()">{{ 'common.reset' | translate }}</button></div> }`,
})
export class DashboardPage {
  private perm = inject(PermissionService); private refs = inject(RefService);
  user = this.perm.user; custom = signal(false);
  f = signal<DashFilters>({ month: monthStr(), year: new Date().getFullYear(), dept: '' });
  deps = this.refs.options('department');
  prefs = computed<WidgetPref[]>(() => {
    const saved = uiStore.state().dashboardWidgets;
    const known = saved.filter((w) => DEFAULT_WIDGETS.includes(w.id));
    return [...known, ...DEFAULT_WIDGETS.filter((id) => !known.some((w) => w.id === id)).map((id) => ({ id, visible: true }))];
  });
  private show = computed<Record<string, boolean>>(() => {
    const p = this.perm; p.user(); const emp = !!this.user()?.employeeId;
    return { kpis: true, holidays: true, headcount: p.canCall('reporting.headcount'), leaves: p.canCall('reporting.leave'), attendance: p.canCall('reporting.attendance'), projects: p.canCall('reporting.allocation'), timesheets: p.canCall('reporting.timesheets'), performance: p.canCall('reporting.performance'), joining: p.canCall('reporting.joiningExit'), mine: emp, team: emp && p.canCall('reporting.manager') };
  });
  shown = computed(() => this.prefs().filter((w) => w.visible && this.show()[w.id]).map((w) => ({ id: w.id, cls: w.id === 'kpis' || w.id === 'mine' || w.id === 'team' ? 'col-12' : 'col-12 col-xl-6' })));
  hiddenCount = computed(() => this.prefs().filter((w) => !w.visible).length);
  isVisible(id: string) { return this.prefs().find((w) => w.id === id)?.visible !== false; }
  setMonth(v: string) { if (v) this.f.set({ ...this.f(), month: v, year: Number(v.slice(0, 4)) }); }
  private save(list: WidgetPref[]) { uiStore.set({ dashboardWidgets: list }); }
  toggle(id: string) { this.save(this.prefs().map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))); }
  move(id: string, d: number) { const l = [...this.prefs()]; const i = l.findIndex((w) => w.id === id); const j = i + d; if (j < 0 || j >= l.length) return; moveItemInArray(l, i, j); this.save(l); }
  drop(e: CdkDragDrop<unknown>) { const l = [...this.prefs()]; moveItemInArray(l, e.previousIndex, e.currentIndex); this.save(l); }
  reset() { this.save([]); }
}
export default DashboardPage;
