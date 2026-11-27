import { Fragment, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/utils/cn';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Render prop for the cell. */
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  align?: 'left' | 'right';
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  /** Render prop: extra content rendered under a row (e.g. expanded details). */
  renderExpanded?: (row: T) => ReactNode;
  isExpanded?: (row: T) => boolean;
  rowClassName?: (row: T) => string | undefined;
  caption?: string;
}

/** Generic data table built on render props (cells, expanded rows) - Tailwind/shadcn flavoured. */
export function DataTable<T>({ columns, rows, rowKey, sortKey, sortDir, onSort, onRowClick, renderExpanded, isExpanded, rowClassName, caption }: Props<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <Table aria-label={caption}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn(c.align === 'right' && 'text-right', c.className)} aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                {c.sortable && onSort ? (
                  <button type="button" className="inline-flex cursor-pointer items-center gap-1 uppercase hover:text-fg" onClick={() => onSort(c.key)}>
                    {c.header}
                    {sortKey === c.key ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-50" />}
                  </button>
                ) : (
                  c.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <Fragment key={rowKey(row)}>
              <TableRow className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row))} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn(c.align === 'right' && 'text-right', c.className)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
              {renderExpanded && isExpanded?.(row) && (
                <TableRow className="bg-surface-alt/50 hover:bg-surface-alt/50">
                  <TableCell colSpan={columns.length}>{renderExpanded(row)}</TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
