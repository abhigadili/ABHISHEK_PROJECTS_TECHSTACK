import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { doctorService } from '@/services/backend/doctors';
import { load } from '@/lib/api/guards';
import { PageHeader } from '@/components/common/PageHeader';
import { DoctorsBoard } from '@/features/doctors/DoctorsBoard';
import { Button } from '@/components/ui/button';
import { can } from '@/constants/permissions';

export const metadata: Metadata = { title: 'Doctors' };
/** Server Component: fetches the (cached, tagged) specialization list and passes it as props; the interactive board is a Client Component. */
export default async function DoctorsPage() {
  const s = await getSession();
  const specs = await load(doctorService.specializations());
  return (
    <>
      <PageHeader title="Doctors" description="Search, filter and sort the doctor directory." actions={can(s?.role, 'doctors:manage') ? <Button asChild><Link href="/doctors/new"><Plus className="size-4" />Add doctor</Link></Button> : undefined} />
      <DoctorsBoard initialSpecializations={specs} />
    </>
  );
}
