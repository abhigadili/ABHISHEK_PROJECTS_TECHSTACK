import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { protectedHandler } from '@/lib/server/handler';
import { ApiError } from '@/lib/server/api-client';
import { deactivateEmployee, getEmployee, patchEmployee, updateEmployee } from '@/lib/server/employees';
import { optText } from '@/schemas/forms';

const idOf = (p: { id: string }) => { const id = Number(p.id); if (!Number.isInteger(id) || id < 1) throw new ApiError(400, 'BAD_REQUEST', 'Employee id must be a positive integer'); return id; };
const after = (id: number) => { revalidateTag('departments', 'max'); revalidatePath(`/employees/${id}`, 'layout'); revalidatePath('/employees'); };
const patchSchema = z.object({ jobTitle: optText(120).optional(), workLocation: optText(100).optional(), phone: optText(30).optional() }).strict();

// GET — read one employee (JSON). The backend decides which fields the caller may see (salary is admin/self only).
export const GET = protectedHandler<{ id: string }>({}, async (_req, _u, p) => NextResponse.json(await getEmployee(idOf(p)), { headers: { 'Cache-Control': 'private, no-store' } }));

// PUT — replace/update with a full body. Admin-only; body validated as an object then forwarded (the backend validates field-level).
export const PUT = protectedHandler<{ id: string }>({ permission: 'employee:manage', mutating: true }, async (req, _u, p) => {
  const body = z.record(z.string(), z.unknown()).parse(await req.json().catch(() => ({})));
  const id = idOf(p); const saved = await updateEmployee(id, body); after(id);
  return NextResponse.json(saved);
});

// PATCH — partial update of a whitelisted subset (strict schema: unknown keys are rejected → no mass assignment).
export const PATCH = protectedHandler<{ id: string }>({ permission: 'employee:manage', mutating: true }, async (req, _u, p) => {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
  const id = idOf(p); const saved = await patchEmployee(id, parsed.data); after(id);
  return NextResponse.json(saved);
});

// DELETE — deactivates (soft delete; the backend never hard-deletes employees). 204 No Content on success.
export const DELETE = protectedHandler<{ id: string }>({ permission: 'employee:manage', mutating: true }, async (_req, _u, p) => {
  const id = idOf(p); await deactivateEmployee(id, 'Deactivated via API'); after(id);
  return new Response(null, { status: 204 });
});
