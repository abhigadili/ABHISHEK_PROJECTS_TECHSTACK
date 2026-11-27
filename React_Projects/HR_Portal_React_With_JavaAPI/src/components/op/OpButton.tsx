import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { OPERATION_MAP } from '@/api/client/call';
import { Button, type ButtonProps } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { OpDialog } from './OpDialog';
import { opNeedsInput, type OpFormProps } from './OpForm';
import { useOpMutation } from './useOp';
import { useUi } from '@/hooks/useUi';

export interface OpButtonProps extends Pick<OpFormProps, 'path' | 'query' | 'initial' | 'overrides' | 'queryOverrides' | 'hideQuery' | 'invalidate' | 'mapBody' | 'successMessage'> {
  op: string;
  label?: ReactNode;
  icon?: ReactNode;
  title?: ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  confirm?: string | false;
  dialogSize?: 'sm' | 'md' | 'lg' | 'xl';
  onDone?: (d: any) => void;
  /** show the button disabled instead of hiding it when the user lacks the backend permission */
  showWhenForbidden?: boolean;
}
/**
 * The workhorse of endpoint integration: a button bound to one backend operation.
 *  - hidden (or disabled) when the user does not satisfy the backend's @PreAuthorize rule,
 *  - needs input  -> opens a schema-driven dialog (OpDialog),
 *  - no input     -> asks for confirmation and calls the endpoint.
 */
export function OpButton({ op: opId, label, icon, title, variant, size = 'sm', className, confirm, dialogSize, onDone, showWhenForbidden, ...ctx }: OpButtonProps) {
  const { t } = useTranslation(); const ui = useUi();
  const { canCall } = usePermissions();
  const op = OPERATION_MAP[opId];
  const [open, setOpen] = useState(false);
  const needs = opNeedsInput(opId, ctx.path, ctx.query);
  const m = useOpMutation(opId, { successMessage: ctx.successMessage, invalidate: ctx.invalidate, onSuccess: (d) => { setOpen(false); onDone?.(d); } });
  if (!op) return null;
  const allowed = canCall(opId);
  if (!allowed && !showWhenForbidden) return null;
  const v = variant ?? (op.method === 'DELETE' ? 'danger' : 'outline');
  const text = typeof label === 'string' ? ui(label) : label ?? ui(op.summary.split(/[(.:]/)[0].slice(0, 40));
  return (
    <>
      <Button variant={v} size={size} className={className} disabled={!allowed} title={title as string ?? `${op.method} ${op.path}`} onClick={() => (!needs && confirm === false ? m.mutate({ path: ctx.path as any, query: ctx.query }) : setOpen(true))} loading={m.isPending}>{icon}{text}</Button>
      {needs ? (
        <OpDialog open={open} onClose={() => setOpen(false)} op={opId} title={typeof title === 'string' ? ui(title) : typeof label === 'string' ? ui(label) : undefined} size={dialogSize} onDone={onDone} {...ctx} />
      ) : (
        <ConfirmDialog open={open} onClose={() => setOpen(false)} danger={op.method === 'DELETE'} loading={m.isPending}
          title={typeof text === 'string' ? text : undefined} message={confirm === false ? undefined : confirm ? ui(confirm) : (op.method === 'DELETE' ? t('common.confirmDelete') : op.summary)}
          onConfirm={() => m.mutate({ path: ctx.path as any, query: ctx.query })} />
      )}
    </>
  );
}
