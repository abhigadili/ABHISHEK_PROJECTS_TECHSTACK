import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { OPERATION_MAP } from '../../api/client/api-client.service';
import { injectOpMutation } from '../../api/mutations/op-mutation';
import { PermissionService } from '../../core/services/permission.service';
import { ConfirmService } from '../components/confirm-dialog.service';
import { UiPipe } from '../pipes/format.pipes';
import { OpDialogComponent } from './op-dialog.component';
import { opNeedsInput } from './op-form.component';
import type { Overrides } from '../forms/fields.component';

/**
 * The workhorse of endpoint integration: a button bound to ONE backend operation.
 *  - hidden (or disabled) when the user does not satisfy the backend's @PreAuthorize rule,
 *  - needs input  -> opens a schema-driven dialog (OpDialog),
 *  - no input     -> asks for confirmation and calls the endpoint.
 */
@Component({
  selector: 'app-op-button', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [OpDialogComponent, UiPipe],
  template: `@if (op_() && (allowed() || showWhenForbidden())) {
    <button type="button" class="btn-hr" [class]="cls()" [disabled]="!allowed() || m.isPending()" [title]="tip()" (click)="click()">
      @if (m.isPending()) { <i class="pi pi-spin pi-spinner"></i> } @else if (icon()) { <i class="pi" [class]="icon()"></i> }{{ text() | ui }}</button>
    @if (needs()) { <app-op-dialog [open]="open()" [op]="op()" [title]="title() || text()" [size]="dialogSize()" [path]="path()" [query]="query()" [initial]="initial()" [overrides]="overrides()"
      [queryOverrides]="queryOverrides()" [hideQuery]="hideQuery()" [invalidate]="invalidate()" [mapBody]="mapBody()" [successMessage]="successMessage()" (closed)="open.set(false)" (done)="done.emit($event)" /> }
  }`,
})
export class OpButtonComponent {
  private perm = inject(PermissionService); private confirmSvc = inject(ConfirmService); private tr = inject(TranslateService);
  op = input.required<string>(); label = input<string>(); icon = input<string>(); title = input<string>(); variant = input<'primary' | 'outline' | 'ghost' | 'danger' | 'danger-ghost' | 'soft' | 'success'>(); size = input<'sm' | 'md'>('sm');
  confirm = input<string | false>(); dialogSize = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  path = input<Record<string, string | number>>(); query = input<Record<string, unknown>>(); initial = input<Record<string, any>>(); overrides = input<Overrides>(); queryOverrides = input<Overrides>();
  hideQuery = input<string[]>([]); invalidate = input<string[]>(); mapBody = input<(b: any) => any>(); successMessage = input<string | false>(); showWhenForbidden = input(false);
  done = output<any>();
  open = signal(false);
  op_ = computed(() => OPERATION_MAP[this.op()]);
  allowed = computed(() => this.perm.canCall(this.op()));
  needs = computed(() => opNeedsInput(this.op(), this.path(), this.query()));
  text = computed(() => this.label() ?? this.op_().summary.split(/[(.:]/)[0].slice(0, 40));
  tip = computed(() => this.title() ?? `${this.op_().method} ${this.op_().path}`);
  cls = computed(() => `${this.variant() ?? (this.op_().method === 'DELETE' ? 'danger-ghost' : 'outline')} ${this.size() === 'sm' ? 'sm' : ''}`);
  m = injectOpMutation<any>(() => this.op(), () => ({ successMessage: this.successMessage(), invalidate: this.invalidate(), onSuccess: (d: any) => this.done.emit(d) }));
  async click() {
    if (this.needs()) { this.open.set(true); return; }
    if (this.confirm() !== false) {
      const ok = await this.confirmSvc.ask({ title: this.text(), danger: this.op_().method === 'DELETE', message: this.confirm() || (this.op_().method === 'DELETE' ? this.tr.instant('common.confirmDelete') : this.op_().summary) });
      if (!ok) return;
    }
    this.m.mutate({ path: this.path(), query: this.query() });
  }
}
