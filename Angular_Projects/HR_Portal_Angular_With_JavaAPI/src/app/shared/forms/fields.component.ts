import { ChangeDetectionStrategy, Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { AbstractControl, FormArray, FormGroup, NG_VALUE_ACCESSOR, ReactiveFormsModule, type ControlValueAccessor } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { SchemaDef } from '../../api/models/operation.model';
import { LanguageService } from '../../core/services/language.service';
import { FIELD_OPTIONS } from '../../core/constants/enums';
import { humanize } from '../pipes/format.pipes';
import { EmployeePickerComponent } from '../components/employee.components';
import { RichTextEditorComponent } from '../components/rich-text-editor.component';
import { RefService, refKindForField, type Option, type RefKind } from '../components/ref.service';
import { buildControl, errorKeyOf, isRequired } from './schema-form';
import { isoDate, parseDate } from '../utilities/date';

export interface FieldOverride { hidden?: boolean; label?: string; rich?: boolean; textarea?: boolean; options?: Option[]; readOnly?: boolean; help?: string; refKind?: RefKind | null }
export type Overrides = Record<string, FieldOverride>;
const TEXTAREA = /^(reason|comment|comments|notes?|description|remarks?|justification|feedback|summary|message|body)$/i;

/** Date picker (Angular Material) as a form control with a 'YYYY-MM-DD' string value. */
@Component({
  selector: 'app-date-field', standalone: true, imports: [MatDatepickerModule, MatInputModule, MatFormFieldModule], changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateFieldComponent), multi: true }],
  template: `<mat-form-field appearance="outline" subscriptSizing="dynamic"><input matInput [matDatepicker]="dp" [value]="date()" (dateChange)="change($event.value)" (blur)="touch()" [disabled]="disabled()" [attr.aria-label]="label()" />
    <mat-datepicker-toggle matIconSuffix [for]="dp" /><mat-datepicker #dp /></mat-form-field>`,
})
export class DateFieldComponent implements ControlValueAccessor {
  label = input('Date'); date = signal<Date | null>(null); disabled = signal(false);
  private onChange: (v: string | null) => void = () => {}; touch: () => void = () => {};
  change(d: Date | null) { this.date.set(d); this.onChange(d ? isoDate(d) : ''); }
  writeValue(v: string | null) { this.date.set(v ? parseDate(String(v).slice(0, 10)) : null); }
  registerOnChange(fn: (v: string | null) => void) { this.onChange = fn; }
  registerOnTouched(fn: () => void) { this.touch = fn; }
  setDisabledState(d: boolean) { this.disabled.set(d); }
}

/** List-of-strings control: multi-select when the options are known (roles, permissions, enums), free-text chips otherwise. */
@Component({
  selector: 'app-tags-input', standalone: true, imports: [MatChipsModule, MatSelectModule, MatFormFieldModule, MatInputModule], changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TagsInputComponent), multi: true }],
  template: `@if (options()) {
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-select multiple [value]="value()" (selectionChange)="set($event.value)" [disabled]="disabled()" [attr.aria-label]="label()">
        @for (o of options()!; track o.value) { <mat-option [value]="o.value">{{ o.label }}</mat-option> }</mat-select></mat-form-field>
    } @else {
      <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-chip-grid #g [attr.aria-label]="label()">@for (v of value(); track v) { <mat-chip-row (removed)="remove(v)">{{ v }}<button matChipRemove aria-label="remove"><i class="pi pi-times" style="font-size:10px"></i></button></mat-chip-row> }
        <input [matChipInputFor]="g" (matChipInputTokenEnd)="add($event.value); $event.chipInput!.clear()" placeholder="Type and press Enter" [disabled]="disabled()" /></mat-chip-grid></mat-form-field> }`,
})
export class TagsInputComponent implements ControlValueAccessor {
  options = input<Option[] | undefined>(); label = input('Values');
  value = signal<string[]>([]); disabled = signal(false);
  private onChange: (v: string[]) => void = () => {};
  set(v: string[]) { this.value.set(v); this.onChange(v); }
  add(t: string) { const s = (t ?? '').trim(); if (s && !this.value().includes(s)) this.set([...this.value(), s]); }
  remove(t: string) { this.set(this.value().filter((x) => x !== t)); }
  writeValue(v: string[] | null) { this.value.set(v ?? []); }
  registerOnChange(fn: (v: string[]) => void) { this.onChange = fn; }
  registerOnTouched(_: () => void) {}
  setDisabledState(d: boolean) { this.disabled.set(d); }
}

/** One field, rendered from its OpenAPI schema (recursive for nested objects / arrays of objects). */
@Component({
  selector: 'app-schema-field', standalone: true, changeDetection: ChangeDetectionStrategy.Default,
  imports: [ReactiveFormsModule, MatCheckboxModule, TranslateModule, EmployeePickerComponent, RichTextEditorComponent, DateFieldComponent, TagsInputComponent, forwardRef(() => SchemaFieldsComponent)],
  template: `
  @if (!ov()?.hidden) {
    @if (nested()) {
      <fieldset class="col-12 rounded-3 p-3" style="border:1px solid var(--hr-border)"><legend class="float-none w-auto px-1 field-label m-0">{{ label() }}</legend>
        <app-schema-fields [schema]="schema()" [group]="$any(control())" [opId]="opId()" /></fieldset>
    } @else if (schema().type === 'array' && schema().items?.properties) {
      <div class="col-12"><div class="d-flex align-items-center justify-content-between mb-1"><span class="field-label m-0">{{ label() }}</span>
        <button type="button" class="btn-hr soft sm" (click)="addItem()"><i class="pi pi-plus"></i>{{ 'common.add' | translate }}</button></div>
        @for (g of arr().controls; track g; let i = $index) { <div class="rounded-3 p-3 mb-2" style="border:1px solid var(--hr-border)"><app-schema-fields [schema]="schema().items!" [group]="$any(g)" [opId]="opId()" />
          <div class="text-end mt-2"><button type="button" class="btn-hr ghost sm" (click)="arr().removeAt(i)"><i class="pi pi-trash"></i>{{ 'common.remove' | translate }}</button></div></div> }</div>
    } @else if (schema().type === 'array') {
      <div class="col-12"><label class="field-label">{{ label() }}@if (required()) { <span class="text-danger"> *</span> }</label>
        <app-tags-input [formControl]="$any(control())" [options]="tagOptions()" [label]="label()" />@if (err(); as e) { <div class="field-error" role="alert">{{ e }}</div> }</div>
    } @else if (schema().type === 'boolean') {
      <div class="col-12 col-md-6 d-flex align-items-end"><mat-checkbox [formControl]="$any(control())">{{ label() }}</mat-checkbox></div>
    } @else {
      <div [class]="col()"><label class="field-label" [attr.for]="fid">{{ label() }}@if (required()) { <span class="text-danger"> *</span> }@if (ov()?.help) { <span class="fw-normal"> — {{ ov()!.help }}</span> }</label>
        @switch (kind()) {
          @case ('employee') { <app-employee-picker [formControl]="$any(control())" [label]="label()" /> }
          @case ('select') { <select class="form-select" [id]="fid" [formControl]="$any(control())"><option value="">—</option>@for (o of selectOptions(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select> }
          @case ('rich') { <app-rich-text-editor [formControl]="$any(control())" /> }
          @case ('date') { <app-date-field [formControl]="$any(control())" [label]="label()" /> }
          @case ('textarea') { <textarea class="form-control" rows="3" [id]="fid" [attr.maxlength]="schema().maxLength" [formControl]="$any(control())"></textarea> }
          @default { <input class="form-control" [id]="fid" [type]="inputType()" [attr.step]="isNum() ? 'any' : null" [attr.autocomplete]="inputType() === 'password' ? 'new-password' : 'off'" [formControl]="$any(control())" /> }
        }
        @if (err(); as e) { <div class="field-error" role="alert">{{ e }}</div> }</div>
    }
  }`,
})
export class SchemaFieldComponent {
  private refs = inject(RefService); private tr = inject(TranslateService); private lang = inject(LanguageService);
  schema = input.required<SchemaDef>(); name = input.required<string>(); control = input.required<AbstractControl>(); requiredIn = input(false);
  ov = input<FieldOverride | undefined>(); opId = input('');
  fid = 'f' + Math.random().toString(36).slice(2, 8);
  leaf = computed(() => this.name().split('.').pop()!);
  required = computed(() => isRequired(this.schema(), this.requiredIn()));
  nested = computed(() => !!this.schema().properties && this.schema().type !== 'array');
  arr = () => this.control() as FormArray;
  label = computed(() => { this.lang.lang(); const o = this.ov()?.label; if (o) return o; const k = `fields.${this.leaf()}`; const t = this.tr.instant(k); return t === k ? humanize(this.leaf()) : t; });
  private enumFallback = computed(() => (!this.schema().enum && !this.ov()?.options && this.schema().type === 'string' ? FIELD_OPTIONS[`${this.opId()}:${this.leaf()}`] ?? FIELD_OPTIONS[this.leaf()] : undefined));
  private refKind = computed(() => { const o = this.ov(); if (o?.refKind !== undefined) return o.refKind; return this.schema().type === 'string' && !this.schema().enum ? refKindForField(this.leaf()) : null; });
  tagOptions = computed<Option[] | undefined>(() => {
    const o = this.ov()?.options; if (o) return o; const it = this.schema().items;
    if (it?.enum) return it.enum.map((v) => ({ value: String(v), label: String(v) }));
    const l = this.leaf(); if (l === 'roles') return this.refs.options('role')(); if (l === 'permissions') return this.refs.options('permission')();
    return undefined;
  });
  kind = computed(() => {
    const s = this.schema(), o = this.ov();
    if (this.refKind() === 'employee') return 'employee';
    if (this.refKind() || o?.options || this.enumFallback() || s.enum) return 'select';
    if (o?.rich) return 'rich';
    if (s.format === 'date') return 'date';
    if (o?.textarea || TEXTAREA.test(this.leaf()) || (s.maxLength ?? 0) >= 250) return s.type === 'string' ? 'textarea' : 'input';
    return 'input';
  });
  selectOptions = computed<Option[]>(() => {
    const o = this.ov(); if (o?.options) return o.options; if (this.enumFallback()) return this.enumFallback()!;
    const s = this.schema(); if (s.enum && !this.refKind()) return s.enum.map((v) => ({ value: String(v), label: this.statusLabel(String(v)) }));
    return this.refs.options(this.refKind()!)();
  });
  private statusLabel(v: string) { this.lang.lang(); const k = `hr.statuses.${v}`; const t = this.tr.instant(k); return t === k ? v.replace(/_/g, ' ') : t; }
  isNum = computed(() => this.schema().type === 'integer' || this.schema().type === 'number');
  inputType = computed(() => { const s = this.schema(); return s.format === 'date-time' ? 'datetime-local' : this.isNum() ? 'number' : /password/i.test(this.leaf()) ? 'password' : /email/i.test(this.leaf()) ? 'email' : 'text'; });
  col = computed(() => { const o = this.ov(); const s = this.schema(); return o?.rich || o?.textarea || TEXTAREA.test(this.leaf()) || (s.maxLength ?? 0) >= 250 ? 'col-12' : 'col-12 col-md-6'; });
  addItem() { this.arr().push(buildControl(this.schema().items!, false)); }
  err() {
    const c = this.control(); if (!(c.touched || c.dirty) && !c.errors?.['server']) return null;
    const e = errorKeyOf(c); if (!e) return null;
    if (e.key === 'server') return String(e.params);
    return this.tr.instant(`common.validation.${e.key}`, e.params ?? {});
  }
}

/** Renders every property of an object schema as fields (a Bootstrap row). */
@Component({
  selector: 'app-schema-fields', standalone: true, imports: [SchemaFieldComponent], changeDetection: ChangeDetectionStrategy.Default,
  template: `<div class="row g-3">@for (k of keys(); track k) { <app-schema-field [schema]="schema().properties![k]" [name]="k" [control]="group().controls[k]" [requiredIn]="req().has(k)" [ov]="overrides()?.[k]" [opId]="opId()" /> }</div>`,
})
export class SchemaFieldsComponent {
  schema = input.required<SchemaDef>(); group = input.required<FormGroup>(); overrides = input<Overrides | undefined>(); skip = input<string[]>([]); opId = input('');
  keys = computed(() => Object.keys(this.schema().properties ?? {}).filter((k) => !this.skip().includes(k) && this.group().controls[k]));
  req = computed(() => new Set(this.schema().required ?? []));
}
