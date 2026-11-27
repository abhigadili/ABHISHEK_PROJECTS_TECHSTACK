import { useEffect, useMemo, useId } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { OPERATION_MAP } from '@/api/client/call';
import type { SchemaDef } from '@/api/operationTypes';
import { SchemaFields, SchemaField, humanize, type Overrides } from '@/components/forms/SchemaFields';
import { zodFromSchema, cleanBody } from '@/components/forms/schemaZod';
import { useOpMutation } from './useOp';
import { Input } from '@/components/ui/input';
import { OpContext } from './opContext';

export interface OpFormProps {
  op: string;
  path?: Record<string, string | number>;           // known path params (hidden)
  query?: Record<string, unknown>;                  // known / fixed query params (hidden)
  initial?: Record<string, any>;                    // default body values
  overrides?: Overrides;                            // per-body-field tweaks (hide, rich text, options ...)
  queryOverrides?: Overrides;
  hideQuery?: string[];
  submitLabel?: string;
  successMessage?: string | false;
  invalidate?: string[];
  onDone?: (data: any) => void;
  onPending?: (p: boolean) => void;
  formId?: string;
  /** transform the cleaned body just before sending (e.g. add computed fields) */
  mapBody?: (b: any) => any;
}

/**
 * Schema-driven form for ANY backend write operation: fields, requiredness and constraints come from the OpenAPI schema
 * (generated from the Java DTOs). Server `fieldErrors` are mapped back onto the matching inputs.
 */
export function OpForm({ op: opId, path, query, initial, overrides, queryOverrides, hideQuery, submitLabel, successMessage, invalidate, onDone, onPending, formId, mapBody }: OpFormProps) {
  const op = OPERATION_MAP[opId];
  const { t } = useTranslation();
  const autoId = useId();
  const id = formId ?? autoId;
  const bodySchema: SchemaDef | null = op.multipart ? null : op.bodySchema;
  const openPath = op.pathParams.filter((p) => path?.[p] === undefined);
  const openQuery = op.query.filter((q) => (query?.[q.name] === undefined) && !(hideQuery ?? []).includes(q.name) && !['page', 'size', 'sort'].includes(q.name));
  const fileField = op.multipart;

  const schema = useMemo(() => {
    const pathShape = Object.fromEntries(openPath.map((p) => [p, z.string().min(1, t('common.validation.required'))]));
    const qShape = Object.fromEntries(openQuery.map((q) => [q.name, zodFromSchema(q.schema, q.required, t, q.name)]));
    return z.object({ path: z.object(pathShape).passthrough(), query: z.object(qShape).passthrough(), body: bodySchema ? zodFromSchema(bodySchema, true, t) : z.any(), file: z.any().optional() });
  }, [opId, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const form = useForm<any>({ resolver: zodResolver(schema) as any, defaultValues: { path: {}, query: {}, body: initial ?? {} }, mode: 'onTouched' });
  useEffect(() => { form.reset({ path: {}, query: Object.fromEntries(openQuery.filter((q) => q.schema.default !== undefined).map((q) => [q.name, q.schema.default])), body: initial ?? {} }); }, [opId, JSON.stringify(initial)]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = useOpMutation(opId, { successMessage, invalidate, silentError: true, onSuccess: onDone });
  useEffect(() => { onPending?.(m.isPending); }, [m.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = form.handleSubmit(async (v) => {
    const ctxPath = { ...(path ?? {}), ...v.path };
    const ctxQuery = { ...(query ?? {}), ...cleanBody(v.query) };
    let body: any = bodySchema ? cleanBody(v.body, bodySchema) ?? {} : undefined;
    if (body && mapBody) body = mapBody(body);
    if (fileField) {
      const f = (form.getValues('file') as FileList | undefined)?.[0];
      if (!f) { form.setError('file', { message: t('common.validation.required') }); return; }
      const fd = new FormData(); fd.append('file', f); body = fd;
    }
    try { await m.mutateAsync({ path: ctxPath, query: ctxQuery, body }); }
    catch (e: any) {
      if (e.fieldErrors?.length) {
        e.fieldErrors.forEach((fe: any) => form.setError((bodySchema ? `body.${fe.field}` : `query.${fe.field}`) as any, { message: fe.message }));
        toast.error(t('common.validationFailed'), { toastId: 'vf' });
      } else toast.error(e.message, { toastId: `e-${opId}` });
    }
  }, () => toast.error(t('common.validationFailed'), { toastId: 'vf' }));

  const topError = m.error && !m.error.fieldErrors?.length ? m.error.message : null;
  return (
    <OpContext.Provider value={opId}><FormProvider {...form}>
      <form id={id} onSubmit={submit} noValidate>
        {topError && <div role="alert" className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{topError}</div>}
        <div className="row g-3">
          {openPath.map((p) => (
            <div className="col-12 col-md-6" key={p}><label className="field-label">{humanize(p)} <span className="text-danger">*</span></label><Input {...form.register(`path.${p}`)} />{(form.formState.errors as any)?.path?.[p] && <div className="field-error">{(form.formState.errors as any).path[p].message}</div>}</div>
          ))}
          {openQuery.map((q) => <SchemaField key={q.name} schema={q.schema} name={`query.${q.name}`} required={q.required} ov={queryOverrides?.[q.name]} />)}
        </div>
        {fileField && (
          <div className="mt-3"><label className="field-label">{t('fields.file')} <span className="text-danger">*</span></label>
            <input type="file" className="form-control" {...form.register('file')} />
            {(form.formState.errors as any).file && <div className="field-error">{(form.formState.errors as any).file.message}</div>}</div>
        )}
        {bodySchema?.properties && <div className={openPath.length + openQuery.length ? 'mt-3' : ''}><SchemaFields schema={bodySchema} prefix="body" overrides={overrides} /></div>}
        <button type="submit" hidden aria-hidden>{submitLabel ?? t('common.submit')}</button>
      </form>
    </FormProvider></OpContext.Provider>
  );
}

/** true when the operation needs user input (otherwise OpButton just asks for confirmation) */
export function opNeedsInput(opId: string, path?: Record<string, unknown>, query?: Record<string, unknown>) {
  const op = OPERATION_MAP[opId];
  if (op.multipart) return true;
  if (op.bodySchema?.properties && Object.keys(op.bodySchema.properties).length) return true;
  if (op.pathParams.some((p) => path?.[p] === undefined)) return true;
  return op.query.some((q) => q.required && query?.[q.name] === undefined);
}
