'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@mui/material';
import { deleteHospitalAction } from '@/features/hospitals/actions';
import { emitToast } from '@/components/ui/toast';
export function DeleteHospitalButton({ id, name }: { id: number; name: string }) { const r = useRouter(); return <Button size="small" color="error" onClick={async () => { if (confirm(`Remove ${name}? (soft delete)`)) { const x = await deleteHospitalAction(id); emitToast({ kind: x.ok ? 'success' : 'error', text: x.message ?? '' }); r.refresh(); } }}>Remove</Button>; }
