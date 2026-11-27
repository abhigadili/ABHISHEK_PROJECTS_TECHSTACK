import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { OPERATION_MAP } from '../../api/client/api-client.service';
import { injectOpMutation } from '../../api/mutations/op-mutation';
import type { SchemaDef } from '../../api/models/operation.model';
import { ToastService } from '../../core/services/toast.service';
import { buildControl, cleanBody, patchTree, validatorsFor, errorKeyOf } from '../forms/schema-form';
import { SchemaFieldComponent, SchemaFieldsComponent, type Overrides } from '../forms/fields.component';
import { humanize } from '../pipes/format.pipes';
import { Validators } from '@angular/forms';

export interface OpFormConfig {
  op: string; path?: Record<string, string | number>; query?: Record<string, unknown>; initial?: Record<string, any>; overrides?: Overrides; queryOverrides?: Overrides;
  hideQuery?: string[]; successMessage?: string | false; invalidate?: string[]; mapBody?: (b: any) => any;
}
/** true when the operation needs user input (otherwise OpButton just asks for confirmation) */
export function opNeedsInput(opId: string, path?: Record<string, unknown>, query?: Record<string, unknown>) {
  const op = OPERATION_MAP[opId];
  if (op.multipart) return true;
  if (op.bodySchema?.properties && Object.keys(op.bodySchema.properties).length) return true;
  if (op.pathParams.some((p) => path?.[p] === undefined)) return true;
  return op.query.some((q) => q.required && query?.[q.name] === undefined);
}

/**
 * Schema-driven Reactive Form for ANY backend write operation: fields, requiredness and constraints come from the OpenAPI schema
 * (generated from the Java DTOs). Server `fieldErrors` are mapped back onto the matching inputs.
 */
@Component({
  selector: 'app-op-form', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [ReactiveFormsModule, TranslateModule, SchemaFieldComponent, SchemaFieldsComponent],
  template: `
  <form [formGroup]="form()" [id]="formId()" (ngSubmit)="submit()" novalidate>
    @if (topError()) { <div role="alert" class="mb-3 rounded-2 px-3 py-2" style="font-size:12px;background:rgb(var(--hr-danger-rgb)/.1);color:var(--hr-danger);border:1px solid rgb(var(--hr-danger-rgb)/.4)">{{ topError() }}</div> }
    <div class="row g-3">
      @for (p of openPath(); track p) { <div class="col-12 col-md-6"><label class="field-label">{{ humanize(p) }} <span class="text-danger">*</span></label><input class="form-control" [formControl]="$any(form().get('path')!.get(p))" />
        @if (showErr(form().get('path')!.get(p)!)) { <div class="field-error">{{ 'common.validation.required' | translate }}</div> }</div> }
      @for (q of openQuery(); track q.name) { <app-schema-field [schema]="q.schema" [name]="q.name" [control]="form().get('query')!.get(q.name)!" [requiredIn]="q.required" [ov]="queryOverrides()?.[q.name]" [opId]="op()" /> }
    </div>
    @if (op_().multipart) { <div class="mt-3"><label class="field-label">{{ 'fields.file' | translate }} <span class="text-danger">*</span></label>
      <input type="file" class="form-control" (change)="onFile($event)" />@if (fileError()) { <div class="field-error">{{ 'common.validation.required' | translate }}</div> }</div> }
    @if (bodySchema()?.properties) { <div [class.mt-3]="openPath().length + openQuery().length"><app-schema-fields [schema]="bodySchema()!" [group]="$any(form().get('body'))" [overrides]="overrides()" [opId]="op()" /></div> }
    <button type="submit" hidden aria-hidden="true"></button>
  </form>`,
})
export class OpFormComponent {
  private tr = inject(TranslateService); private toast = inject(ToastService);
  op = input.required<string>(); path = input<Record<string, string | number>>(); query = input<Record<string, unknown>>(); initial = input<Record<string, any>>();
  overrides = input<Overrides>(); queryOverrides = input<Overrides>(); hideQuery = input<string[]>([]); successMessage = input<string | false>(); invalidate = input<string[]>();
  mapBody = input<(b: any) => any>(); formId = input('op-form');
  done = output<any>(); pending = output<boolean>();
  humanize = humanize;

  op_ = computed(() => OPERATION_MAP[this.op()]);
  bodySchema = computed<SchemaDef | null>(() => (this.op_().multipart ? null : this.op_().bodySchema));
  openPath = computed(() => this.op_().pathParams.filter((p) => this.path()?.[p] === undefined));
  openQuery = computed(() => this.op_().query.filter((q) => this.query()?.[q.name] === undefined && !this.hideQuery().includes(q.name) && !['page', 'size', 'sort'].includes(q.name)));
  private file: File | null = null; fileError = computed(() => false);
  private fileMissing = false;

  /** the whole Reactive-Forms tree: { path: {...}, query: {...}, body: ... } - rebuilt when the operation changes */
  form = computed(() => {
    const op = this.op_(); const initial = untracked(() => this.initial());
    const path = new FormGroup(Object.fromEntries(this.openPath().map((p) => [p, new FormControl('', [Validators.required])])));
    const query = new FormGroup(Object.fromEntries(this.openQuery().map((q) => { const c = buildControl(q.schema, q.required, q.name); if (q.schema.default !== undefined) patchTree(c, q.schema, q.schema.default); return [q.name, c]; })));
    const body = this.bodySchema() ? buildControl(this.bodySchema()!, true) : new FormControl(null);
    if (this.bodySchema() && initial) patchTree(body, this.bodySchema()!, initial);
    void op;
    return new FormGroup({ path, query, body });
  });
  constructor() {
    effect(() => { const i = this.initial(); untracked(() => { const s = this.bodySchema(); if (s && i) patchTree(this.form().get('body')!, s, i); }); });
  }

  m = injectOpMutation<any>(() => this.op(), () => ({ successMessage: this.successMessage(), invalidate: this.invalidate(), silentError: true, onSuccess: (d: any) => this.done.emit(d) }));
  topError = computed(() => { const e = this.m.error(); return e && !e.fieldErrors?.length ? e.message : null; });
  showErr = (c: AbstractControl) => c.invalid && (c.touched || c.dirty);
  onFile(e: Event) { this.file = (e.target as HTMLInputElement).files?.[0] ?? null; }

  submit() {
    const f = this.form(); f.markAllAsTouched();
    if (f.invalid) { this.toast.error('common.validationFailed'); return; }
    const v = f.getRawValue() as any; const bs = this.bodySchema();
    let body: any = bs ? cleanBody(v.body, bs) ?? {} : undefined;
    if (body && this.mapBody()) body = this.mapBody()!(body);
    if (this.op_().multipart) { if (!this.file) { this.toast.error('common.validationFailed'); return; } const fd = new FormData(); fd.append('file', this.file); body = fd; }
    const q = { ...(this.query() ?? {}), ...cleanBody(v.query) };
    this.pending.emit(true);
    this.m.mutate({ path: { ...(this.path() ?? {}), ...v.path }, query: q, body }, {
      onSettled: () => this.pending.emit(false),
      onError: (e) => {
        if (e.fieldErrors?.length) {
          e.fieldErrors.forEach((fe) => { const c = f.get(bs ? `body.${fe.field}` : `query.${fe.field}`); c?.setErrors({ server: fe.message }); c?.markAsTouched(); });
          this.toast.error('common.validationFailed');
        } else this.toast.error(e.message);
      },
    });
  }
}
void errorKeyOf; void validatorsFor; void (null as unknown as TranslateService);
