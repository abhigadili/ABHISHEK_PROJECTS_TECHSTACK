import { ChangeDetectionStrategy, Component, TemplateRef, computed, input, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CardComponent } from '../components/ui.components';
import { ModalComponent } from '../components/modal.component';
import { OpTableComponent } from '../tables/op-table.component';
import type { Col } from '../tables/data-table.component';
import { OpButtonComponent } from './op-button.component';
import { OpViewComponent } from './op-view.component';
import type { Overrides } from '../forms/fields.component';

type Ctx = Record<string, string | number>;
/** List + create / edit / delete / view for one resource, entirely driven by backend operations. */
@Component({
  selector: 'app-crud-section', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [CardComponent, OpTableComponent, OpButtonComponent, OpViewComponent, ModalComponent, TranslateModule, NgTemplateOutlet],
  template: `
  @if (bare()) { <ng-container [ngTemplateOutlet]="tableTpl" /> }
  @else { <app-card [title]="title()"><span actions class="d-flex gap-2"><ng-content select="[actions]" />
      @if (create(); as c) { <app-op-button [op]="c.op" [path]="c.path" [initial]="c.initial" [overrides]="c.overrides" icon="pi-plus" [label]="'common.add' | translate" variant="primary" [dialogSize]="dialogSize()" /> }</span>
    <ng-container [ngTemplateOutlet]="tableTpl" /></app-card> }
  <ng-template #tableTpl>
    <app-op-table [op]="list().op" [path]="list().path" [query]="list().query" [columns]="columns()" [tableId]="tableId()" [pick]="pick()" [searchParam]="searchParam()" [rowActions]="actionsTpl" [emptyHint]="emptyHint()" />
  </ng-template>
  <ng-template #actionsTpl let-row>
    @if (extraRowActions(); as x) { <ng-container [ngTemplateOutlet]="x" [ngTemplateOutletContext]="{ $implicit: row }" /> }
    @if (view(); as v) { <button type="button" class="btn-hr ghost sm icon" (click)="viewing.set(v.path(row))" aria-label="view"><i class="pi pi-eye"></i></button> }
    @if (update(); as u) { <app-op-button [op]="u.op" [path]="u.path ? u.path(row) : undefined" [initial]="u.initial ? u.initial(row) : row" [overrides]="u.overrides" icon="pi-pencil" [label]="'common.edit' | translate" variant="ghost" [dialogSize]="dialogSize()" /> }
    @if (remove(); as r) { <app-op-button [op]="r.op" [path]="r.path(row)" icon="pi-trash" [label]="'common.delete' | translate" variant="danger-ghost" /> }
  </ng-template>
  @if (view(); as v) { <app-modal [open]="!!viewing()" [title]="v.op" size="lg" (closed)="viewing.set(null)">@if (viewing()) { <app-op-view [op]="v.op" [path]="viewing()!" [bare]="true" /> }</app-modal> }`,
})
export class CrudSectionComponent {
  title = input.required<string>();
  list = input.required<{ op: string; path?: Ctx; query?: Record<string, unknown> }>();
  create = input<{ op: string; path?: Ctx; initial?: Record<string, any>; overrides?: Overrides }>();
  update = input<{ op: string; path?: (row: any) => Ctx; overrides?: Overrides; initial?: (row: any) => Record<string, any> }>();
  remove = input<{ op: string; path: (row: any) => Ctx }>();
  /** a GET-by-id operation shown in a read-only detail modal */
  view = input<{ op: string; path: (row: any) => Ctx }>();
  columns = input<Col[] | undefined>(); extraRowActions = input<TemplateRef<any> | undefined>(); tableId = input(''); pick = input<((d: any) => any[]) | undefined>(); searchParam = input(''); bare = input(false);
  dialogSize = input<'sm' | 'md' | 'lg' | 'xl'>('md'); emptyHint = input('');
  viewing = signal<Ctx | null>(null);
  void0 = computed(() => 0);
}
void viewChild;
