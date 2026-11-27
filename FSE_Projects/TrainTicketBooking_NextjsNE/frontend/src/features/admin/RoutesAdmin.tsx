'use client';
import type { GridColDef } from '@mui/x-data-grid';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { LazyDataTable } from '@/components/tables/LazyDataTable';
import { useAuth } from '@/hooks';
import { useAdminList } from '@/hooks/useAdminList';
import { get } from '@/services/api-client';

interface RouteRow { id: number; trainId: number; name: string; stops: { seq: number; departureTime: string | null; arrivalTime: string | null; station: { code: string; name: string } }[] }
/** Routes overview: every train's ordered stops. Route editing happens in the train form (the backend stores one route per train). */
export function RoutesAdmin() {
  const { isAdmin } = useAuth(); const l = useAdminList<RouteRow>('routes', async (p) => { const r = await get<RouteRow[]>('/routes', p as Record<string, string | number>); return { data: r.data, meta: r.meta! }; });
  const columns: GridColDef<RouteRow>[] = [
    { field: 'name', headerName: 'Route', width: 180 }, { field: 'stops', headerName: 'Stops (in order)', flex: 1, minWidth: 380, sortable: false, valueGetter: (_v, r) => r.stops.map((s) => s.station.code).join(' → ') },
    { field: 'count', headerName: 'Stops', width: 90, valueGetter: (_v, r) => r.stops.length }, { field: 'dep', headerName: 'First departure', width: 140, valueGetter: (_v, r) => r.stops[0]?.departureTime ?? '—' },
    ...(isAdmin ? [{ field: 'actions', headerName: '', width: 80, sortable: false, renderCell: (p: { row: RouteRow }) => <Button size="icon" variant="ghost" asChild aria-label={`Edit route ${p.row.name}`}><Link href={`/admin/trains/${p.row.trainId}/edit`}><Pencil size={16} /></Link></Button> } as GridColDef<RouteRow>] : []),
  ];
  return <LazyDataTable rows={l.rows} columns={columns} meta={l.meta} loading={l.isFetching} page={l.page} onPage={(m) => l.setPage(m.page)} />;
}
