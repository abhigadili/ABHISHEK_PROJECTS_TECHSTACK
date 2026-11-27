import {
  Box,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import { memo, type ReactNode } from 'react';
import { EmptyState, ErrorMessage, TableSkeleton } from '@/components/common/Feedback';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortKey?: string;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  hideBelow?: 'sm' | 'md';
}
export interface SortState {
  field: string;
  dir: 'asc' | 'desc';
}
export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
  onLimit?: (limit: number) => void;
  limits?: number[];
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  sort?: SortState;
  onSort?: (field: string) => void;
  pagination?: PaginationState;
  onRowClick?: (row: T) => void;
  selectedIds?: (string | number)[];
  onToggleRow?: (id: number) => void;
  caption?: string;
}

interface RowProps<T> {
  row: T;
  columns: Column<T>[];
  id: string | number;
  onRowClick?: (row: T) => void;
  selected: boolean;
  selectable: boolean;
  onToggleRow?: (id: number) => void;
}

/** Memoised row: with stable props (see useCallback in callers) only the row whose data/selection changed re-renders. */
const DataRow = memo(function DataRow<T>({
  row,
  columns,
  id,
  onRowClick,
  selected,
  selectable,
  onToggleRow,
}: RowProps<T>) {
  return (
    <TableRow
      hover
      selected={selected}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      sx={{ cursor: onRowClick ? 'pointer' : undefined }}
    >
      {selectable && (
        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onChange={() => onToggleRow?.(Number(id))}
            inputProps={{ 'aria-label': `Select row ${id}` }}
          />
        </TableCell>
      )}
      {columns.map((c) => (
        <TableCell
          key={c.key}
          align={c.align}
          sx={{ display: c.hideBelow ? { xs: 'none', [c.hideBelow]: 'table-cell' } : undefined }}
        >
          {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
        </TableCell>
      ))}
    </TableRow>
  );
}) as <T>(props: RowProps<T>) => ReactNode;

/** Generic data table: `DataTable<Employee>` infers the row type from `rows`; columns are type-checked against it. */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading,
  error,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  sort,
  onSort,
  pagination,
  onRowClick,
  selectedIds,
  onToggleRow,
  caption,
}: Props<T>) {
  if (error) return <ErrorMessage message={error} onRetry={onRetry} />;
  if (loading && rows.length === 0) return <TableSkeleton />;
  const selectable = !!onToggleRow;
  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <TableContainer>
        <Table size="small" aria-label={caption} aria-busy={loading}>
          <TableHead>
            <TableRow>
              {selectable && <TableCell padding="checkbox" />}
              {columns.map((c) => (
                <TableCell
                  key={c.key}
                  align={c.align}
                  sx={{
                    fontWeight: 700,
                    width: c.width,
                    display: c.hideBelow ? { xs: 'none', [c.hideBelow]: 'table-cell' } : undefined,
                  }}
                  sortDirection={sort && sort.field === c.sortKey ? sort.dir : false}
                >
                  {c.sortKey && onSort ? (
                    <TableSortLabel
                      active={sort?.field === c.sortKey}
                      direction={sort?.field === c.sortKey ? sort.dir : 'asc'}
                      onClick={() => onSort(c.sortKey!)}
                    >
                      {c.header}
                    </TableSortLabel>
                  ) : (
                    c.header
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
            {rows.map((row) => {
              const id = getRowId(row);
              return (
                <DataRow
                  key={id}
                  row={row}
                  id={id}
                  columns={columns}
                  onRowClick={onRowClick}
                  selected={!!selectedIds?.includes(id)}
                  selectable={selectable}
                  onToggleRow={onToggleRow}
                />
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {rows.length === 0 && !loading && (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      )}
      {pagination && (
        <Box>
          <TablePagination
            component="div"
            count={pagination.total}
            page={Math.max(pagination.page - 1, 0)}
            rowsPerPage={pagination.limit}
            rowsPerPageOptions={pagination.limits ?? [5, 10, 25, 50]}
            onPageChange={(_, p) => pagination.onPage(p + 1)}
            onRowsPerPageChange={(e) => pagination.onLimit?.(Number(e.target.value))}
          />
        </Box>
      )}
    </Paper>
  );
}
