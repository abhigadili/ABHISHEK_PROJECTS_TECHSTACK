'use client';
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid';
import type { PageMeta } from '@/types';

/** Server-side paginated MUI DataGrid (page/size come from the API's `meta`). Loaded lazily via LazyDataTable - it is ~700 kB. */
export default function DataTable<T extends { id: number | string }>({ rows, columns, meta, loading, page, onPage, height = 540 }: { rows: T[]; columns: GridColDef<T>[]; meta?: PageMeta; loading?: boolean; page: number; onPage: (m: GridPaginationModel) => void; height?: number }) {
  return (
    <div style={{ height, width: '100%' }} className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <DataGrid rows={rows} columns={columns} loading={loading} rowCount={meta?.total ?? 0} paginationMode="server" paginationModel={{ page, pageSize: meta?.size ?? 10 }} onPaginationModelChange={onPage}
        pageSizeOptions={[meta?.size ?? 10]} disableRowSelectionOnClick disableColumnMenu sx={{ border: 0 }} getRowHeight={() => 'auto'} slotProps={{ loadingOverlay: { variant: 'linear-progress' } }} />
    </div>
  );
}
