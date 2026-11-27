import 'server-only';
import { hospitalService } from '@/services/backend/hospitals';
import type { Department } from '@/types';

/** Parallel fetch of active departments for several hospitals (used by the doctor form's dependent Department select). */
export async function loadDepartments(hospitals: { id: number }[]) {
  const lists = await Promise.all(hospitals.map(async (h) => [h.id, await hospitalService.departments(h.id).catch(() => [] as Department[])] as const));
  return Object.fromEntries(lists.map(([id, d]) => [id, d.filter((x) => x.active)]));
}
