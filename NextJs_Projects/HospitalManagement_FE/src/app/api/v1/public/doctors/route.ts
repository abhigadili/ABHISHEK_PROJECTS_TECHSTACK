import { NextResponse } from 'next/server';
import { doctorService } from '@/server/services/doctor.service';
export const revalidate = 300;
export async function GET() {
  const items = await doctorService.listPublic();
  return NextResponse.json({ success: true, data: items.map((d) => ({ id: d.id, name: `Dr. ${d.user.firstName} ${d.user.lastName}`, specialization: d.specialization.name, experienceYears: d.experienceYears })) }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
}
