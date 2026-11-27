import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { Autocomplete, TextField, Checkbox, FormControlLabel, Chip } from '@mui/material';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { SchemaDef } from '@/api/operationTypes';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/editors/RichTextEditor';
import { EmployeePicker } from '@/components/op/employees';
import { refKindForField, useRefOptions, type Option } from '@/components/op/refs';
import { FIELD_OPTIONS } from '@/constants/enums';
import { useOpContext } from '@/components/op/opContext';

export interface FieldOverride { hidden?: boolean; label?: string; rich?: boolean; textarea?: boolean; options?: Option[]; readOnly?: boolean; help?: string; refKind?: Parameters<typeof useRefOptions>[0]; }
export type Overrides = Record<string, FieldOverride>;

export const humanize = (n: string) => n.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/Id$/, '').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const errAt = (errors: any, name: string) => name.split('.').reduce((a, k) => a?.[k], errors)?.message as string | undefined;

function Label({ name, label, required, help }: { name: string; label?: string; required?: boolean; help?: string }) {
  const { t } = useTranslation();
  const leaf = name.split('.').pop()!.replace(/\d+/, '');
  return <label className="field-label" htmlFor={name}>{label ?? t(`fields.${leaf}`, { defaultValue: humanize(leaf) })}{required ? <span className="text-danger"> *</span> : null}{help ? <span className="ml-1 font-normal">— {help}</span> : null}</label>;
}

function RefSelect({ name, kind, value, onChange, disabled, id, optionsOverride }: { name: string; kind: NonNullable<Parameters<typeof useRefOptions>[0]>; value: any; onChange: (v: string) => void; disabled?: boolean; id: string; optionsOverride?: Option[] }) {
  const { options } = useRefOptions(optionsOverride ? null : kind);
  const list = optionsOverride ?? options;
  return (
    <NativeSelect id={id} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={name}>
      <option value="">—</option>
      {list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </NativeSelect>
  );
}

const TEXTAREA = /^(reason|comment|comments|notes?|description|remarks?|justification|feedback|summary|message|body)$/i;

export function SchemaField({ schema, name, required: requiredIn, ov, depth = 0 }: { schema: SchemaDef; name: string; required: boolean; ov?: FieldOverride; depth?: number }) {
  const required = requiredIn || (schema.type === 'string' && !schema.enum && schema.minLength === 1);
  const { control, register, formState: { errors } } = useFormContext();
  const { t } = useTranslation();
  const opId = useOpContext();
  const leaf = name.split('.').pop()!.replace(/^\d+$/, 'item');
  const error = errAt(errors, name);
  if (ov?.hidden) return null;
  const enumFallback = !schema.enum && !ov?.options ? FIELD_OPTIONS[`${opId}:${leaf}`] ?? FIELD_OPTIONS[leaf] : undefined;
  if (enumFallback && schema.type === 'string') ov = { ...ov, options: enumFallback };
  const err = error ? <div className="field-error" role="alert">{error}</div> : null;
  const dis = ov?.readOnly;

  // ---- nested object
  if (schema.properties && schema.type !== 'array') {
    const req = new Set(schema.required ?? []);
    return (
      <fieldset className="col-12 rounded-md border border-border p-3">
        <legend className="float-none w-auto px-1 text-xs font-semibold text-muted">{ov?.label ?? t(`fields.${leaf}`, { defaultValue: humanize(leaf) })}</legend>
        <SchemaFields schema={schema} prefix={name} requiredSet={req} depth={depth + 1} />
      </fieldset>
    );
  }
  // ---- arrays
  if (schema.type === 'array') {
    const it = schema.items ?? {};
    if (it.properties) return <ObjectArray schema={schema} name={name} ov={ov} depth={depth} />;
    const enumOpts: Option[] | undefined = ov?.options ?? (it.enum ? it.enum.map((v) => ({ value: String(v), label: String(v) })) : undefined);
    const rk = !enumOpts ? (leaf === 'roles' ? 'role' : leaf === 'permissions' ? 'permission' : null) : null;
    return (
      <div className="col-12">
        <Label name={name} label={ov?.label} required={required} help={ov?.help} />
        <Controller control={control} name={name} render={({ field }) => (
          <TagsInput value={field.value ?? []} onChange={field.onChange} options={enumOpts} refKind={rk as any} disabled={dis} />
        )} />
        {err}
      </div>
    );
  }
  // ---- boolean
  if (schema.type === 'boolean') {
    return (
      <div className="col-12 col-md-6 d-flex align-items-end">
        <Controller control={control} name={name} render={({ field }) => (
          <FormControlLabel control={<Checkbox size="small" checked={!!field.value} disabled={dis} onChange={(e) => field.onChange(e.target.checked)} />}
            label={<span className="text-[13px]">{ov?.label ?? t(`fields.${leaf}`, { defaultValue: humanize(leaf) })}</span>} />
        )} />
      </div>
    );
  }
  const kind = ov?.refKind !== undefined ? ov.refKind : (schema.type === 'string' && !schema.enum ? refKindForField(leaf) : null);
  const wide = ov?.rich || ov?.textarea || TEXTAREA.test(leaf) || (schema.maxLength ?? 0) >= 250;
  const col = wide ? 'col-12' : 'col-12 col-md-6';
  // ---- reference pickers
  if (kind === 'employee') {
    return (
      <div className={col}><Label name={name} label={ov?.label} required={required} help={ov?.help} />
        <Controller control={control} name={name} render={({ field }) => <EmployeePicker value={field.value} onChange={(v) => field.onChange(v ?? '')} disabled={dis} />} />{err}</div>
    );
  }
  if (kind || ov?.options) {
    return (
      <div className={col}><Label name={name} label={ov?.label} required={required} help={ov?.help} />
        <Controller control={control} name={name} render={({ field }) => <RefSelect id={name} name={name} kind={(kind ?? 'department') as any} optionsOverride={ov?.options} value={field.value} onChange={field.onChange} disabled={dis} />} />{err}</div>
    );
  }
  // ---- enum
  if (schema.enum) {
    return (
      <div className={col}><Label name={name} label={ov?.label} required={required} help={ov?.help} />
        <NativeSelect id={name} disabled={dis} {...register(name)}>
          <option value="">—</option>
          {schema.enum.map((v) => <option key={String(v)} value={String(v)}>{t(`hr.statuses.${v}`, { defaultValue: String(v).replace(/_/g, ' ') })}</option>)}
        </NativeSelect>{err}</div>
    );
  }
  // ---- rich text
  if (ov?.rich) {
    return (
      <div className="col-12"><Label name={name} label={ov?.label} required={required} help={ov?.help} />
        <Controller control={control} name={name} render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />} />{err}</div>
    );
  }
  // ---- primitives
  const isNum = schema.type === 'integer' || schema.type === 'number';
  const type = schema.format === 'date' ? 'date' : schema.format === 'date-time' ? 'datetime-local' : isNum ? 'number' : /password/i.test(leaf) ? 'password' : /email/i.test(leaf) ? 'email' : 'text';
  return (
    <div className={col}><Label name={name} label={ov?.label} required={required} help={ov?.help} />
      {wide && type === 'text' ? <Textarea id={name} disabled={dis} maxLength={schema.maxLength} {...register(name)} />
        : <Input id={name} type={type} step={isNum ? 'any' : undefined} disabled={dis} autoComplete={type === 'password' ? 'new-password' : 'off'} {...register(name)} />}
      {err}</div>
  );
}

function TagsInput({ value, onChange, options, refKind, disabled }: { value: string[]; onChange: (v: string[]) => void; options?: Option[]; refKind?: 'role' | 'permission' | null; disabled?: boolean }) {
  const ref = useRefOptions(refKind ?? null, !!refKind);
  const list = options ?? (refKind ? ref.options : undefined);
  return (
    <Autocomplete multiple size="small" freeSolo={!list} disabled={disabled} options={list?.map((o) => o.value) ?? []} value={value}
      getOptionLabel={(o) => list?.find((x) => x.value === o)?.label ?? String(o)} onChange={(_, v) => onChange(v as string[])}
      renderTags={(v, getProps) => v.map((o, i) => { const { key, ...rest } = getProps({ index: i }); return <Chip key={key} size="small" label={list?.find((x) => x.value === o)?.label ?? o} {...rest} />; })}
      renderInput={(p) => <TextField {...p} placeholder={list ? '' : 'Type and press Enter'} />} />
  );
}

function ObjectArray({ schema, name, ov, depth }: { schema: SchemaDef; name: string; ov?: FieldOverride; depth: number }) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });
  const { t } = useTranslation();
  const leaf = name.split('.').pop()!;
  const req = new Set(schema.items?.required ?? []);
  return (
    <div className="col-12">
      <div className="mb-1 flex items-center justify-between"><span className="field-label m-0">{ov?.label ?? t(`fields.${leaf}`, { defaultValue: humanize(leaf) })}</span>
        <Button size="sm" variant="soft" onClick={() => append({})}><Plus size={14} />{t('common.add')}</Button></div>
      {fields.map((f, i) => (
        <div key={f.id} className="mb-2 rounded-md border border-border p-3">
          <div className="row g-2"><SchemaFields schema={schema.items!} prefix={`${name}.${i}`} requiredSet={req} depth={depth + 1} /></div>
          <div className="mt-2 text-right"><Button size="sm" variant="ghost" onClick={() => remove(i)}><Trash2 size={14} />{t('common.remove')}</Button></div>
        </div>
      ))}
    </div>
  );
}

export function SchemaFields({ schema, prefix = '', requiredSet, overrides, depth = 0, skip }: { schema: SchemaDef; prefix?: string; requiredSet?: Set<string>; overrides?: Overrides; depth?: number; skip?: string[] }): ReactNode {
  const req = requiredSet ?? new Set(schema.required ?? []);
  return (
    <div className="row g-3">
      {Object.entries(schema.properties ?? {}).filter(([k]) => !skip?.includes(k)).map(([k, v]) => (
        <SchemaField key={k} schema={v} name={prefix ? `${prefix}.${k}` : k} required={req.has(k)} ov={overrides?.[k]} depth={depth} />
      ))}
    </div>
  );
}
