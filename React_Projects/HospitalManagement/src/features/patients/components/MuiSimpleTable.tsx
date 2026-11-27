import type { ReactNode } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';

export interface MuiColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
}

/** Small MUI table used inside the patient/doctor tabs. `cell` is a render prop. */
export function MuiSimpleTable<T>({ columns, rows, rowKey, onRowClick, label }: { columns: MuiColumn<T>[]; rows: T[]; rowKey: (r: T) => string | number; onRowClick?: (r: T) => void; label: string }) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow>{columns.map((c) => <TableCell key={c.key} align={c.align} sx={{ fontWeight: 700 }}>{c.header}</TableCell>)}</TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={rowKey(r)} hover={!!onRowClick} sx={{ cursor: onRowClick ? 'pointer' : undefined }} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => <TableCell key={c.key} align={c.align}>{c.cell(r)}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
