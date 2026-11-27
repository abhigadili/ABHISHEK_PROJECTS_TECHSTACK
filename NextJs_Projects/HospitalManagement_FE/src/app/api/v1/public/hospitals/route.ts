import { NextResponse } from 'next/server';
import { hospitalService } from '@/server/services/hospital.service';

/** Public, non-personal data: the Route Handler response itself is cacheable (ISR for 5 minutes + CDN headers). */
export const revalidate = 300;
export async function GET() {
  const { items } = await hospitalService.listPublic();
  return NextResponse.json({ success: true, data: items.map((h) => ({ id: h.id, name: h.name, slug: h.slug, city: h.city, phone: h.phone, departments: h._count.departments })) }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
}
