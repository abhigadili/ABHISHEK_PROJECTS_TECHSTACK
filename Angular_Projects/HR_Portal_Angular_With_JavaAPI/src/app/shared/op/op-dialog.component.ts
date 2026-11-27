import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { OPERATION_MAP } from '../../api/client/api-client.service';
import { ModalComponent } from '../components/modal.component';
import { OpFormComponent } from './op-form.component';
import type { Overrides } from '../forms/fields.component';
import { UiPipe } from '../pipes/format.pipes';

let seq = 0;
/** Modal around OpForm: the one place where write endpoints get their dialog. */
@Component({
  selector: 'app-op-dialog', standalone: true, changeDetection: ChangeDetectionStrategy.Default, imports: [ModalComponent, OpFormComponent, TranslateModule, UiPipe],
  template: `<app-modal [open]="open()" [title]="title() || op_().summary" [description]="description() ?? (op_().method + ' ' + op_().path)" [size]="size()" (closed)="closed.emit()">
    @if (open()) { <app-op-form [op]="op()" [path]="path()" [query]="query()" [initial]="initial()" [overrides]="overrides()" [queryOverrides]="queryOverrides()" [hideQuery]="hideQuery()"
      [invalidate]="invalidate()" [mapBody]="mapBody()" [successMessage]="successMessage()" [formId]="fid" (pending)="pending.set($event)" (done)="done.emit($event); closed.emit()" /> }
    <ng-container footer>
      <button type="button" class="btn-hr outline" (click)="closed.emit()">{{ 'common.cancel' | translate }}</button>
      <button type="submit" [attr.form]="fid" class="btn-hr ms-2" [class.danger]="op_().method === 'DELETE'" [class.primary]="op_().method !== 'DELETE'" [disabled]="pending()">
        @if (pending()) { <i class="pi pi-spin pi-spinner"></i> }{{ (submitLabel() || ('common.submit' | translate)) | ui }}</button></ng-container>
  </app-modal>`,
})
export class OpDialogComponent {
  fid = `opf-${++seq}`;
  open = input(false); op = input.required<string>(); title = input<string>(); description = input<string>(); size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  path = input<Record<string, string | number>>(); query = input<Record<string, unknown>>(); initial = input<Record<string, any>>(); overrides = input<Overrides>(); queryOverrides = input<Overrides>();
  hideQuery = input<string[]>([]); invalidate = input<string[]>(); mapBody = input<(b: any) => any>(); successMessage = input<string | false>(); submitLabel = input<string>();
  closed = output<void>(); done = output<any>(); pending = signal(false);
  op_ = computed(() => OPERATION_MAP[this.op()]);
}
