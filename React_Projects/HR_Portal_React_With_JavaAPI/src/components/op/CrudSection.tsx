import type { ReactNode } from 'react';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/dialog';
import { OpView } from './OpView';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { OpButton } from './OpButton';
import { OpTable } from '@/components/tables/OpTable';
import type { Col } from '@/components/tables/DataTable';
import type { Overrides } from '@/components/forms/SchemaFields';

type Ctx = Record<string, string | number>;
export interface CrudSectionProps {
  title: ReactNode;
  list: { op: string; path?: Ctx; query?: Record<string, unknown> };
  create?: { op: string; path?: Ctx; initial?: Record<string, any>; overrides?: Overrides };
  update?: { op: string; path?: (row: any) => Ctx; overrides?: Overrides; initial?: (row: any) => Record<string, any> };
  remove?: { op: string; path: (row: any) => Ctx };
  /** a GET-by-id operation shown in a read-only detail modal */
  view?: { op: string; path: (row: any) => Ctx };
  columns?: Col[]; extraRowActions?: (row: any) => ReactNode; actions?: ReactNode; tableId?: string; pick?: (d: any) => any[]; searchParam?: string; bare?: boolean; dialogSize?: 'sm' | 'md' | 'lg' | 'xl';
}
/** List + create / edit / delete for one resource, entirely driven by backend operations. */
function ViewAction({ op, path }: { op: string; path: Ctx }) {
  const [open, setOpen] = useState(false);
  return (<>
    <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label="view"><Eye size={13} /></Button>
    <Modal open={open} onOpenChange={setOpen} title={op} size="lg">{open && <OpView op={op} path={path} bare />}</Modal>
  </>);
}
export function CrudSection({ title, list, create, update, remove, view, columns, extraRowActions, actions, tableId, pick, searchParam, bare, dialogSize }: CrudSectionProps) {
  const { t } = useTranslation();
  const table = (
    <OpTable op={list.op} path={list.path} query={list.query} columns={columns} tableId={tableId} pick={pick} searchParam={searchParam}
      rowActions={(row) => <>
        {extraRowActions?.(row)}
        {view && <ViewAction op={view.op} path={view.path(row)} />}
        {update && <OpButton op={update.op} path={update.path?.(row)} initial={update.initial ? update.initial(row) : row} overrides={update.overrides} icon={<Pencil size={13} />} label={t('common.edit')} variant="ghost" dialogSize={dialogSize} />}
        {remove && <OpButton op={remove.op} path={remove.path(row)} icon={<Trash2 size={13} />} label={t('common.delete')} variant="ghost" className="text-danger" />}
      </>} />
  );
  if (bare) return table;
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><div className="d-flex gap-2">{actions}{create && <OpButton op={create.op} path={create.path} initial={create.initial} overrides={create.overrides} icon={<Plus size={14} />} label={t('common.add')} variant="default" dialogSize={dialogSize} />}</div></CardHeader>
      <CardBody className="p-3">{table}</CardBody>
    </Card>
  );
}
