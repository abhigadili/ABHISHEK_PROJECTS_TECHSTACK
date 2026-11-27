import { memo } from 'react';
import { Pin, PinOff, PackagePlus, Pencil } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StockBadge } from './StockBadge';
import { stockLevel } from '../utils/stock';
import { formatCurrency, formatNumber } from '@/utils/format';
import type { Medicine } from '@/types';

/** React.memo table row: stock changes of one medicine re-render one row. Handlers are stable (useCallback in the page). */
export const MedicineRow = memo(function MedicineRow({ medicine: m, pinned, canManage, onOpen, onPin, onRestock, onEdit }: { medicine: Medicine; pinned: boolean; canManage: boolean; onOpen: (id: number) => void; onPin: (id: number) => void; onRestock: (m: Medicine) => void; onEdit: (m: Medicine) => void }) {
  return (
    <TableRow className="cursor-pointer" onClick={() => onOpen(m.id)}>
      <TableCell><div className="font-semibold">{m.name}</div><div className="text-xs text-muted">{m.genericName ?? '—'} · {m.sku}</div></TableCell>
      <TableCell className="text-right">{formatCurrency(m.unitPrice)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(m.stockQuantity)}<div className="text-xs text-muted">reorder at {m.reorderLevel}</div></TableCell>
      <TableCell><StockBadge level={stockLevel(m)} /></TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" aria-label={pinned ? `Unpin ${m.name}` : `Pin ${m.name}`} onClick={() => onPin(m.id)}>{pinned ? <PinOff className="h-4 w-4 text-brand-600" /> : <Pin className="h-4 w-4" />}</Button>
          {canManage && <Button size="icon" variant="ghost" aria-label={`Restock ${m.name}`} onClick={() => onRestock(m)}><PackagePlus className="h-4 w-4" /></Button>}
          {canManage && <Button size="icon" variant="ghost" aria-label={`Edit ${m.name}`} onClick={() => onEdit(m)}><Pencil className="h-4 w-4" /></Button>}
        </div>
      </TableCell>
    </TableRow>
  );
});
