import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { appointmentService } from '@/services/backend/appointments';
import { errorResponse, guard } from '@/lib/api/route-helpers';

/**
 * Thin REST adaptation of the backend's verb-style endpoints (PUT /{id}/cancel, /reschedule, /complete) to resource semantics:
 *   GET /api/appointments/:id             -> appointment
 *   PATCH /api/appointments/:id {date,startTime}  -> reschedule
 *   PUT /api/appointments/:id {notes?}    -> complete
 *   DELETE /api/appointments/:id?reason=  -> cancel
 * Used by the TanStack Query optimistic-cancel mutation in the appointment list.
 */
type Ctx = RouteContext<'/api/appointments/[appointmentId]'>;
const idOf = async (ctx: Ctx) => Number((await ctx.params).appointmentId);

export async function GET(_r: NextRequest, ctx: Ctx) {
  const g = await guard(); if ('response' in g) return g.response;
  try { return NextResponse.json(await appointmentService.get(await idOf(ctx))); } catch (e) { return errorResponse(e); }
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const g = await guard('appointments:manage'); if ('response' in g) return g.response;
  const p = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^\d{2}:\d{2}$/) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ status: 400, message: 'Validation failed', details: p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
  try { return NextResponse.json(await appointmentService.reschedule(await idOf(ctx), p.data)); } catch (e) { return errorResponse(e); }
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  const g = await guard('appointments:complete'); if ('response' in g) return g.response;
  const body = (await req.json().catch(() => ({}))) as { notes?: string };
  try { return NextResponse.json(await appointmentService.complete(await idOf(ctx), body.notes)); } catch (e) { return errorResponse(e); }
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const g = await guard('appointments:manage'); if ('response' in g) return g.response;
  try { return NextResponse.json(await appointmentService.cancel(await idOf(ctx), req.nextUrl.searchParams.get('reason') ?? undefined)); } catch (e) { return errorResponse(e); }
}
