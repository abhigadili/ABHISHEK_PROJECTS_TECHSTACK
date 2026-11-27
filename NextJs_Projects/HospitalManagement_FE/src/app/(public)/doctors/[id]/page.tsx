import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Award, Briefcase, Building2, IndianRupee } from 'lucide-react';
import { getPublicDoctor, getPublicDoctors } from '@/server/cache';
import { Avatar } from '@/components/common/Avatar';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fmtMoney } from '@/lib/utilities/format';
export const revalidate = 300; export const dynamicParams = true;
export async function generateStaticParams() { try { return (await getPublicDoctors()).map((d) => ({ id: String(d.id) })); } catch { return []; } }
export async function generateMetadata({ params }: PageProps<'/doctors/[id]'>): Promise<Metadata> {
  const d = await getPublicDoctor(Number((await params).id)).catch(() => null); if (!d) return { title: 'Doctor not found', robots: { index: false } };
  const n = `Dr. ${d.user.firstName} ${d.user.lastName}`;
  return { title: `${n} - ${d.specialization.name}`, description: `${n}, ${d.specialization.name}${d.qualifications ? ` (${d.qualifications})` : ''}, ${d.experienceYears} years of experience.`, alternates: { canonical: `/doctors/${d.id}` } };
}
export default async function DoctorPage({ params }: PageProps<'/doctors/[id]'>) {
  const id = Number((await params).id); if (!Number.isInteger(id)) notFound();
  const d = await getPublicDoctor(id).catch(() => null); if (!d) notFound();
  const name = `Dr. ${d.user.firstName} ${d.user.lastName}`;
  return <Card className="mx-auto max-w-3xl"><CardBody className="flex flex-col gap-6 sm:flex-row"><Avatar name={name} size={160} priority /><div className="flex-1"><h1 className="text-3xl font-bold">{name}</h1><p className="text-lg text-primary">{d.specialization.name}</p><ul className="mt-4 space-y-2 text-sm">{d.qualifications && <li className="flex gap-2"><Award className="size-4 text-primary" />{d.qualifications}</li>}<li className="flex gap-2"><Briefcase className="size-4 text-primary" />{d.experienceYears} years of experience</li><li className="flex gap-2"><IndianRupee className="size-4 text-primary" />Consultation fee {fmtMoney(Number(d.consultationFee))}</li>{d.assignments.map((a) => <li key={a.hospitalId} className="flex gap-2"><Building2 className="size-4 text-primary" /><Link className="hover:underline" href={`/hospitals/${a.hospital.slug}`}>{a.hospital.name}</Link>{a.department && <span className="text-muted">· {a.department.name}</span>}</li>)}</ul>{d.bio && <p className="mt-4 text-sm text-muted">{d.bio}</p>}<Button asChild className="mt-6"><Link href="/patient/book">Book an appointment</Link></Button></div></CardBody></Card>;
}
