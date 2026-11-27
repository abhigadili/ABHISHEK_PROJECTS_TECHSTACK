import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';
import { BadgeComponent } from './ui.components';
import { SafeHtmlComponent } from './safe-html.component';
import { EmployeeNameComponent } from './employee.components';
import { RefService, refKindForField, type RefKind } from './ref.service';
import { humanize } from '../pipes/format.pipes';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
const TONES: Record<string, Tone> = {
  ACTIVE: 'success', APPROVED: 'success', COMPLETED: 'success', PRESENT: 'success', VERIFIED: 'success', PAID: 'success', FINALIZED: 'success', CLOSED: 'neutral', CONFIRMED: 'success', DONE: 'success', ACCEPTED: 'success',
  PENDING: 'warning', SUBMITTED: 'info', IN_REVIEW: 'info', DRAFT: 'neutral', ON_NOTICE: 'warning', PROCESSING: 'info', OPEN: 'info', SCHEDULED: 'info', PARTIAL: 'warning', HALF_DAY: 'warning', LATE: 'warning', WFH: 'info', ON_LEAVE: 'info',
  REJECTED: 'danger', CANCELLED: 'danger', TERMINATED: 'danger', ABSENT: 'danger', LOCKED: 'danger', INACTIVE: 'neutral', RESIGNED: 'neutral', WITHDRAWN: 'neutral', FAILED: 'danger', EXPIRED: 'danger', RETURNED: 'warning', MANAGER_APPROVED: 'info', HR_CONFIRMED: 'info', SELF_PENDING: 'warning', SELF_SUBMITTED: 'info', MANAGER_SUBMITTED: 'info', UNDER_REVIEW: 'info', PROCESSED: 'info', SETTLEMENT_PENDING: 'warning', INTERVIEW_DONE: 'info', CLEARED: 'success', MANAGER_REJECTED: 'danger', MISSING_PUNCH: 'warning', NO_RECORD: 'neutral', IN_PROGRESS: 'info', NOT_STARTED: 'neutral', UPLOADED: 'info', APPLIED: 'warning', MANDATORY: 'primary', OPTIONAL: 'info', RESTRICTED: 'neutral',
};
@Component({
  selector: 'app-status-badge', standalone: true, imports: [BadgeComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (!value()) { <span class="text-muted">—</span> } @else { <app-badge [tone]="tone()">{{ text() }}</app-badge> }`,
})
export class StatusBadgeComponent {
  private tr = inject(TranslateService); private lang = inject(LanguageService);
  value = input<string | null | undefined>();
  tone = computed(() => TONES[this.value() ?? ''] ?? 'neutral');
  text = computed(() => { this.lang.lang(); const v = this.value() ?? ''; const k = `hr.statuses.${v}`; const t = this.tr.instant(k); return t === k ? v.replace(/_/g, ' ') : t; });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/; const ISO_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const MONEY = /(amount|salary|ctc|gross|^net|netpay|deduction|earning|bonus|basic|allowance|budget|creditlimit|principal|emi|price|billingrate|hourlyrate|totaldeclared|totalapproved|totalgross|totalnet|totaldeductions|payable|recoveries|taxable|tds|fee$)/i;
const STATUSLIKE = /^(status|stage|state|type|category|decision|mode|kind|priority|gender|employmentType|role)$/i;
const SKIP_PLAIN_ID = /(^id$|Id$|^version$)/;
const HTML = /^\s*<(p|div|ul|ol|h[1-6]|br|b|i|strong|em|span|table|a)[\s>/]/i;
const RK: Record<string, RefKind> = { department: 'department', designation: 'designation', location: 'location', jobGrade: 'jobGrade', project: 'project', customer: 'customer', leaveType: 'leaveType', cycle: 'cycle' };
const RFN: Record<string, (r: string) => string> = {};
void RFN;

/** Formats any backend value by its name + shape (dates, instants, money, booleans, statuses, rich text, reference ids, arrays). */
@Component({
  selector: 'app-value', standalone: true, imports: [StatusBadgeComponent, BadgeComponent, SafeHtmlComponent, EmployeeNameComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@switch (kind()) {
    @case ('empty') { <span class="text-muted">—</span> }
    @case ('bool') { <app-badge [tone]="v() ? 'success' : 'neutral'">{{ v() ? 'Yes' : 'No' }}</app-badge> }
    @case ('money') { <span class="tabular-nums">{{ money() }}</span> }
    @case ('number') { <span class="tabular-nums">{{ num() }}</span> }
    @case ('html') { <app-safe-html [html]="str()" /> }
    @case ('employee') { <app-employee-name [id]="str()" /> }
    @case ('ref') { <span [title]="str()">{{ refLabel() }}</span> }
    @case ('datetime') { <span>{{ dt() }}</span> }
    @case ('date') { <span>{{ d() }}</span> }
    @case ('status') { <app-status-badge [value]="str()" /> }
    @case ('id') { <code style="font-size:11px" class="text-muted" [title]="str()">{{ str().slice(0, 8) }}…</code> }
    @case ('list') { <span>{{ list() }}</span> }
    @case ('json') { <code style="font-size:11px">{{ json() }}</code> }
    @default { <span>{{ str() }}</span> } }`,
})
export class ValueComponent {
  private l = inject(LanguageService); private refs = inject(RefService);
  k = input(''); v = input<unknown>(); refsOn = input(true);
  str = computed(() => String(this.v() ?? ''));
  kind = computed(() => {
    const v = this.v(), k = this.k();
    if (v === null || v === undefined || v === '') return 'empty';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'number') return MONEY.test(k) && !/days|count|year|number|hours/i.test(k) ? 'money' : 'number';
    if (typeof v === 'string') {
      if (HTML.test(v)) return 'html';
      if (this.refsOn() && v.length > 20) { const rk = refKindForField(k); if (rk === 'employee') return 'employee'; if (rk && RK[rk]) return 'ref'; }
      if (ISO_DT.test(v)) return 'datetime';
      if (ISO_DATE.test(v)) return 'date';
      if (STATUSLIKE.test(k) || /^[A-Z][A-Z_]{2,}$/.test(v)) return 'status';
      if (SKIP_PLAIN_ID.test(k) && v.length > 20) return 'id';
      return 'text';
    }
    if (Array.isArray(v)) return v.every((x) => typeof x !== 'object') ? 'list' : 'list';
    return 'json';
  });
  money = computed(() => this.l.money(this.v() as number)); num = computed(() => this.l.number(this.v() as number));
  dt = computed(() => this.l.dateTime(this.str())); d = computed(() => this.l.date(this.str()));
  refLabel = computed(() => this.refs.label(refKindForField(this.k())!, this.str()));
  list = computed(() => { const v = this.v() as any[]; return v.every((x) => typeof x !== 'object') ? v.join(', ') : `${v.length} item(s)`; });
  json = computed(() => JSON.stringify(this.v()).slice(0, 80));
}

/** Key/value view of any DTO. `labels` overrides, `hide` removes keys; ids stay visible but shortened. */
@Component({
  selector: 'app-detail', standalone: true, imports: [ValueComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dl class="row g-3 m-0">@for (e of entries(); track e[0]) {
    <div [class]="colClass()"><dt class="field-label m-0">{{ labelOf(e[0]) }}</dt><dd class="m-0" style="font-size:13px;word-break:break-word"><app-value [k]="e[0]" [v]="e[1]" /></dd></div> }</dl>`,
})
export class DetailComponent {
  private tr = inject(TranslateService); private lang = inject(LanguageService);
  data = input<Record<string, any> | null | undefined>(); hide = input<string[]>([]); labels = input<Record<string, string>>({}); cols = input<1 | 2 | 3>(3);
  entries = computed(() => Object.entries(this.data() ?? {}).filter(([k, v]) => !this.hide().includes(k) && !(v && typeof v === 'object' && !Array.isArray(v))));
  colClass = computed(() => (this.cols() === 1 ? 'col-12' : this.cols() === 2 ? 'col-12 col-md-6' : 'col-12 col-sm-6 col-lg-4'));
  labelOf(k: string) { this.lang.lang(); const key = `fields.${k}`; const t = this.tr.instant(key); return this.labels()[k] ?? (t === key ? humanize(k) : t); }
}
