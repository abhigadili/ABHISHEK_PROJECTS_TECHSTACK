import { useField } from 'formik';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/utils/cn';

/**
 * Reusable Formik field components. `useField` wires value/onChange/onBlur and touched/error from the nearest <Formik>,
 * so form screens only declare *what* to render. Error text is shown after the field was touched or the form was submitted.
 */
interface BaseProps { name: string; label: string; hint?: string; className?: string }

function FieldShell({ name, label, hint, className, error, children }: BaseProps & { error?: string; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? <p role="alert" className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function FormikInput({ name, label, hint, className, ...rest }: BaseProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'>) {
  const [field, meta] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <FieldShell {...{ name, label, hint, className, error }}>
      <Input id={name} {...field} value={field.value ?? ''} aria-invalid={!!error} {...rest} />
    </FieldShell>
  );
}

export function FormikTextarea({ name, label, hint, className, ...rest }: BaseProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'>) {
  const [field, meta] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <FieldShell {...{ name, label, hint, className, error }}>
      <Textarea id={name} {...field} value={field.value ?? ''} aria-invalid={!!error} {...rest} />
    </FieldShell>
  );
}

export function FormikSelect({ name, label, hint, className, options, ...rest }: BaseProps & { options: Array<{ value: string | number; label: string }> } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'name'>) {
  const [field, meta] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;
  return (
    <FieldShell {...{ name, label, hint, className, error }}>
      <select id={name} {...field} aria-invalid={!!error} className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" {...rest}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldShell>
  );
}
