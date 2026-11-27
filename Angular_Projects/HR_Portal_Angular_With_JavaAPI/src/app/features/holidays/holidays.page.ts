import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { injectOp } from '../../api/queries/op-query';
import { CalendarComponent, type CalEvent } from '../../shared/components/calendar.component';
import { RefService } from '../../shared/components/ref.service';
import { CardComponent, PageHeaderComponent, TabDirective, TabsComponent } from '../../shared/components/ui.components';
import { CrudSectionComponent } from '../../shared/op/crud-section.component';
import { OpViewComponent } from '../../shared/op/op-view.component';
import { FmtDatePipe } from '../../shared/pipes/format.pipes';
import { type Col } from '../../shared/tables/data-table.component';

@Component({
  selector: 'app-holidays-page', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, TranslateModule, PageHeaderComponent, TabsComponent, TabDirective, CalendarComponent, CrudSectionComponent, OpViewComponent, CardComponent, FmtDatePipe],
  template: `<app-page-header [title]="'hr.holidays.title' | translate" [subtitle]="'hr.holidays.sub' | translate" />
  <!-- template-driven quick filters -->
  <form class="mb-3 d-flex flex-wrap gap-2" #ff="ngForm">
    <select class="form-select" style="width:auto" name="year" [ngModel]="year()" (ngModelChange)="year.set(+$event)" [attr.aria-label]="'common.year' | translate">@for (y of years(); track y) { <option [value]="y">{{ y }}</option> }</select>
    <select class="form-select" style="width:auto" name="loc" [ngModel]="loc()" (ngModelChange)="loc.set($event)" [attr.aria-label]="'common.location' | translate"><option value="">{{ 'common.all' | translate }} · {{ 'common.location' | translate }}</option>@for (o of locs(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select>
    <select class="form-select" style="width:auto" name="dep" [ngModel]="dep()" (ngModelChange)="dep.set($event)" [attr.aria-label]="'common.department' | translate"><option value="">{{ 'common.all' | translate }} · {{ 'common.department' | translate }}</option>@for (o of deps(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select></form>
  <app-tabs>
    <ng-template appTab="calendar" [label]="'hr.leave.calendar' | translate"><app-calendar [events]="events()" (rangeChange)="range.set($event)" /></ng-template>
    <ng-template appTab="list" [label]="'common.view' | translate"><app-crud-section [title]="('hr.holidays.title' | translate) + ' · ' + year()" [list]="{ op: 'holiday.byYear', query: listQuery() }" tableId="holidays" [create]="{ op: 'holiday.create', initial: { holidayYear: year() } }" [update]="{ op: 'holiday.update', path: idPath }" [remove]="{ op: 'holiday.delete', path: idPath }" [view]="{ op: 'holiday.get', path: idPath }" [columns]="cols" /></ng-template>
    <ng-template appTab="upcoming" [label]="'hr.dashboard.upcomingHolidays' | translate"><app-op-view op="holiday.upcoming" [query]="upQuery()" /></ng-template>
    <ng-template appTab="year" [label]="'' + year()"><app-card [title]="'' + year()">
      @if (cal.data(); as c) { <div class="mb-3 d-flex gap-2 flex-wrap">@for (m of months(); track m[0]) { <div class="rounded-2 p-2" style="min-width:180px;border:1px solid var(--hr-border)"><div class="fw-semibold" style="font-size:12px">{{ m[0] }}</div>@for (h of m[1]; track h.id) { <div style="font-size:12px">{{ h.holidayDate | fmtDate }} · {{ h.name }}</div> }</div> }</div> }
      <app-op-view op="holiday.calendar" [path]="{ year: year() }" [query]="q()" [bare]="true" [hide]="['months', 'byMonth']" /></app-card></ng-template>
    <ng-template appTab="years" label="Holiday years"><app-crud-section title="Holiday years" [list]="{ op: 'holiday.list' }" [create]="{ op: 'holiday.createHolidayYears' }" [update]="{ op: 'holiday.updateHolidayYears', path: idPath }" /></ng-template>
  </app-tabs>`,
})
export class HolidaysPage {
  private refs = inject(RefService);
  year = signal(new Date().getFullYear()); loc = signal(''); dep = signal(''); range = signal({ from: '', to: '' });
  locs = this.refs.options('location'); deps = this.refs.options('department');
  idPath = (r: any) => ({ id: r.id });
  cols: Col[] = [{ key: 'name' }, { key: 'holidayDate', sortable: true }, { key: 'type' }, { key: 'description', hidden: true }, { key: 'scopes', fmt: (v) => (v?.length ? `${v.length} scope(s)` : 'All') }];
  q = computed(() => ({ locationId: this.loc() || undefined, departmentId: this.dep() || undefined }));
  listQuery = computed(() => ({ year: this.year(), ...this.q() })); upQuery = computed(() => ({ limit: 10, ...this.q() }));
  yearsQ = injectOp<any[]>('holiday.list');
  years = computed(() => [...new Set([new Date().getFullYear(), ...(this.yearsQ.data() ?? []).map((y: any) => y.year)])].sort());
  rng = injectOp<any[]>('holiday.range', () => ({ query: { from: this.range().from, to: this.range().to, ...this.q() } }), () => ({ enabled: !!this.range().from }));
  cal = injectOp<any>('holiday.calendar', () => ({ path: { year: this.year() }, query: this.q() }));
  months = computed(() => Object.entries(this.cal.data()?.months ?? this.cal.data()?.byMonth ?? {}) as [string, any[]][]);
  events = computed<CalEvent[]>(() => (this.rng.data() ?? []).map((h: any) => ({ date: h.holidayDate, label: h.name, title: `${h.name} (${h.type})`, tone: h.type === 'MANDATORY' ? 'danger' as const : h.type === 'OPTIONAL' ? 'info' as const : 'warning' as const })));
}
export default HolidaysPage;
