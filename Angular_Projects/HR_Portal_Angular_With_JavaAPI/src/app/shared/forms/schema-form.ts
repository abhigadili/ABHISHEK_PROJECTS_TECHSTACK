import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import type { SchemaDef } from '../../api/models/operation.model';

const blank = (v: unknown) => v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v));

/** Bean Validation @NotBlank / @NotEmpty surface in OpenAPI as minLength === 1 (not in `required`) - enforce them like the server does. */
export const isRequired = (s: SchemaDef, requiredIn: boolean) => requiredIn || (s.type === 'string' && !s.enum && s.minLength === 1);

/** Validators derived from the backend's OpenAPI (Bean Validation) constraints, so client rules = server rules. */
export function validatorsFor(s: SchemaDef, requiredIn: boolean, name = ''): ValidatorFn[] {
  const v: ValidatorFn[] = [];
  const req = isRequired(s, requiredIn);
  if (s.type === 'boolean') return v;
  if (s.type === 'array') {
    if (req && s.minItems) v.push((c) => ((c.value?.length ?? 0) < s.minItems! ? { minItems: { n: s.minItems } } : null));
    if (s.maxItems) v.push((c) => ((c.value?.length ?? 0) > s.maxItems! ? { maxItems: { n: s.maxItems } } : null));
    return v;
  }
  if (req) v.push((c) => (blank(c.value) ? { required: true } : null));
  if (s.type === 'integer' || s.type === 'number') {
    if (s.type === 'integer') v.push((c) => (!blank(c.value) && !Number.isInteger(Number(c.value)) ? { number: true } : null));
    if (s.minimum !== undefined) v.push((c) => (!blank(c.value) && Number(c.value) < s.minimum! ? { min: { n: s.minimum } } : null));
    if (s.maximum !== undefined) v.push((c) => (!blank(c.value) && Number(c.value) > s.maximum! ? { max: { n: s.maximum } } : null));
    return v;
  }
  if (s.enum) return v;
  if (s.format === 'email' || (/email/i.test(name) && !s.pattern)) v.push((c) => (blank(c.value) || Validators.email(c) === null ? null : { email: true }));
  if (s.minLength && s.minLength > 0 && (req || s.minLength > 1)) v.push((c) => (!blank(c.value) && String(c.value).length < s.minLength! ? { minLength: { n: s.minLength } } : null));
  if (s.maxLength) v.push((c) => (!blank(c.value) && String(c.value).length > s.maxLength! ? { maxLength: { n: s.maxLength } } : null));
  if (s.pattern) { try { const re = new RegExp(s.pattern); v.push((c) => (blank(c.value) || re.test(String(c.value)) ? null : { pattern: true })); } catch { /* java-only regex syntax: leave to the server */ } }
  return v;
}

/** Builds the Reactive-Forms control tree (FormGroup / FormArray / FormControl) for an OpenAPI schema. */
export function buildControl(s: SchemaDef, requiredIn: boolean, name = ''): AbstractControl {
  if (s.type === 'array') {
    if (s.items?.properties) return new FormArray<AbstractControl>([], validatorsFor(s, requiredIn, name));
    return new FormControl<string[]>([], { nonNullable: true, validators: validatorsFor(s, requiredIn, name) });
  }
  if (s.type === 'object' || s.properties) {
    const req = new Set(s.required ?? []);
    const g: Record<string, AbstractControl> = {};
    Object.entries(s.properties ?? {}).forEach(([k, v]) => { g[k] = buildControl(v, req.has(k), k); });
    return new FormGroup(g);
  }
  if (s.type === 'boolean') return new FormControl<boolean>(false, { nonNullable: true });
  return new FormControl<any>('', { validators: validatorsFor(s, requiredIn, name) });
}

/** Sets a (possibly partial) value on a control tree, growing FormArrays as needed. */
export function patchTree(c: AbstractControl, s: SchemaDef | undefined, value: any) {
  if (value === undefined || value === null) return;
  if (c instanceof FormGroup) { Object.entries(value).forEach(([k, v]) => { const ch = c.get(k); if (ch) patchTree(ch, s?.properties?.[k], v); }); return; }
  if (c instanceof FormArray) {
    c.clear();
    (value as any[]).forEach((item) => { const g = buildControl(s!.items!, false); patchTree(g, s!.items, item); c.push(g); });
    return;
  }
  c.setValue(value);
}

/** Removes blanks, converts datetime-local values to ISO instants - produces the JSON body the API expects. */
export function cleanBody(v: any, s?: SchemaDef): any {
  if (Array.isArray(v)) return v.map((x) => cleanBody(x, s?.items)).filter((x) => x !== undefined);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    Object.entries(v).forEach(([k, x]) => { const c = cleanBody(x, s?.properties?.[k]); if (c !== undefined) o[k] = c; });
    return Object.keys(o).length || !s ? o : undefined;
  }
  if (blank(v)) return undefined;
  if ((s?.type === 'integer' || s?.type === 'number') && typeof v === 'string') return Number(v);
  if (s?.format === 'date-time' && typeof v === 'string' && v.length === 16) return new Date(v).toISOString();
  return v;
}

export const errorKeyOf = (c: AbstractControl): { key: string; params?: any } | null => {
  const e: ValidationErrors | null = c.errors; if (!e) return null;
  if (e['server']) return { key: 'server', params: e['server'] };
  const order = ['required', 'email', 'number', 'minLength', 'maxLength', 'min', 'max', 'pattern', 'minItems', 'maxItems'];
  const k = order.find((x) => e[x]); return k ? { key: k, params: e[k] } : null;
};
