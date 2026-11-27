import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { getPublicHospitals } from '@/server/cache';
import { Card, CardBody } from '@/components/ui/card';
export const revalidate = 300;
export const metadata: Metadata = { title: 'Contact', description: 'How to reach our hospitals.' };
export default async function Contact() {
  const hs = await getPublicHospitals().catch(() => []);
  return <><h1 className="mb-6 text-3xl font-bold">Contact us</h1><div className="grid gap-4 sm:grid-cols-2">{hs.map((h) => <Card key={h.id}><CardBody className="space-y-2 text-sm"><h2 className="font-semibold">{h.name}</h2><p className="flex gap-2"><MapPin className="size-4 text-primary" />{h.city}</p>{h.phone && <p className="flex gap-2"><Phone className="size-4 text-primary" />{h.phone}</p>}<p className="flex gap-2"><Mail className="size-4 text-primary" />Via the hospital page</p></CardBody></Card>)}</div></>;
}
