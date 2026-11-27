import { z, type ZodTypeAny } from 'zod';
import type { TFunction } from 'i18next';
import type { SchemaDef } from '@/api/operationTypes';

const blank = (v: unknown) => v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v));

/** Builds a Zod schema from the backend's OpenAPI (Bean Validation) constraints, so client rules = server rules. */
export function zodFromSchema(s: SchemaDef, requiredIn: boolean, t: TFunction, name = ''): ZodTypeAny {
  // Bean Validation @NotBlank / @NotEmpty surface in OpenAPI as minLength === 1 (not in `required`) - enforce them like the server does
  const required = requiredIn || (s.type === 'string' && !s.enum && s.minLength === 1);
  if (s.type === 'array') {
    let a = z.array(s.items ? zodFromSchema(s.items, true, t) : z.any());
    if (s.minItems) a = a.min(s.minItems, t('common.validation.minItems', { n: s.minItems }));
    if (s.maxItems) a = a.max(s.maxItems, t('common.validation.maxItems', { n: s.maxItems }));
    return required && s.minItems ? a : z.preprocess((v) => (v == null ? [] : v), a);
  }
  if (s.type === 'object' || s.properties) {
    const req = new Set(s.required ?? []);
    const shape: Record<string, ZodTypeAny> = {};
    Object.entries(s.properties ?? {}).forEach(([k, v]) => { shape[k] = zodFromSchema(v, req.has(k), t, k); });
    const o = z.object(shape).passthrough();
    return required ? o : z.preprocess((v) => (v == null ? undefined : v), o.optional());
  }
  if (s.type === 'integer' || s.type === 'number') {
    let n = z.number({ invalid_type_error: t('common.validation.number'), required_error: t('common.validation.required') });
    if (s.type === 'integer') n = n.int(t('common.validation.number'));
    if (s.minimum !== undefined) n = n.min(s.minimum, t('common.validation.min', { n: s.minimum }));
    if (s.maximum !== undefined) n = n.max(s.maximum, t('common.validation.max', { n: s.maximum }));
    const pre = (v: unknown) => (blank(v) ? undefined : Number(v));
    return z.preprocess(pre, required ? n : n.optional());
  }
  if (s.type === 'boolean') return z.boolean().optional();
  // strings
  let st = z.string();
  if (s.enum) {
    const e = z.enum(s.enum.map(String) as [string, ...string[]]);
    return required ? z.preprocess((v) => (v === '' ? undefined : v), e, { required_error: t('common.validation.required') } as any) : z.preprocess((v) => (v === '' ? undefined : v), e.optional());
  }
  if (s.format === 'email' || /email/i.test(name) && !s.pattern) st = st.email(t('common.validation.email'));
  if (s.minLength && s.minLength > 0 && (required || s.minLength > 1)) st = st.min(s.minLength, t('common.validation.minLength', { n: s.minLength }));
  if (s.maxLength) st = st.max(s.maxLength, t('common.validation.maxLength', { n: s.maxLength }));
  if (s.pattern) { try { st = st.regex(new RegExp(s.pattern), t('common.validation.pattern')); } catch { /* java-only regex syntax: leave to the server */ } }
  if (required) return z.string({ required_error: t('common.validation.required') }).min(1, t('common.validation.required')).pipe(st);
  return z.preprocess((v) => (blank(v) ? undefined : v), st.optional());
}

/** Removes blanks, converts datetime-local values to ISO instants - produces the JSON body the API expects. */
export function cleanBody(v: any, s?: SchemaDef): any {
  if (Array.isArray(v)) return v.map((x) => cleanBody(x, s?.items)).filter((x) => x !== undefined);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    Object.entries(v).forEach(([k, x]) => { const c = cleanBody(x, s?.properties?.[k]); if (c !== undefined) o[k] = c; });
    return Object.keys(o).length || !s ? o : undefined;
  }
  if (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) return undefined;
  if (s?.format === 'date-time' && typeof v === 'string' && v.length === 16) return new Date(v).toISOString();
  return v;
}
