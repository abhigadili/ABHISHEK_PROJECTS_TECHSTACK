import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { hospitalService } from '@/services/backend/hospitals';
import { load } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { HospitalsBrowser } from '@/features/hospitals/HospitalsBrowser';
import { Button } from '@/components/ui/button';
import { can } from '@/constants/permissions';

export const metadata: Metadata = { title: 'Hospitals' };
export default async function HospitalsPage() {
  const s = await requireSession();
  const hospitals = await load(hospitalService.list()); // cached 60 s per session, tag "hospitals"
  return <><PageHeader title="Hospitals" description="Locations, departments and contact details." actions={can(s.role, 'hospitals:manage') ? <Button asChild><Link href="/hospitals/new"><Plus className="size-4" />Add hospital</Link></Button> : undefined} /><HospitalsBrowser hospitals={hospitals} /></>;
}
