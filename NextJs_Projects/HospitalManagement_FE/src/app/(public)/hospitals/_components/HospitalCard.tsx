import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Phone } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
const BANNERS = ['/images/hospital-1.jpg', '/images/hospital-2.jpg', '/images/hospital-3.jpg'] as const;
export const banner = (id: number) => BANNERS[id % BANNERS.length];
/** PRIVATE FOLDER (`_components`): co-located, never routable, shared by the public hospital pages. */
export function HospitalCard({ h, priority = false }: { h: { id: number; name: string; slug: string; city: string | null; phone: string | null; _count: { departments: number } }; priority?: boolean }) {
  return <Link href={`/hospitals/${h.slug}`} className="group"><Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md"><div className="relative aspect-[16/6]"><Image src={banner(h.id)} alt={`${h.name} banner`} fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw" quality={60} priority={priority} className="object-cover" /></div><CardBody><h3 className="font-semibold">{h.name}</h3><ul className="mt-2 space-y-1 text-sm text-muted"><li className="flex gap-2"><MapPin className="size-4" />{h.city ?? '—'}</li>{h.phone && <li className="flex gap-2"><Phone className="size-4" />{h.phone}</li>}<li>{h._count.departments} departments</li></ul></CardBody></Card></Link>;
}
