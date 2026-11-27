import 'server-only';
import { errorResponse, zodFields } from './api';
import { requirePrincipal } from '@/server/auth/session';
import { AppError } from '@/server/utilities/errors';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import type { Principal } from '@/server/authorization/principal';

/** Structured result of every Server Action (serialisable across the server -> client boundary). */
export interface ActionState<T = unknown> { ok: boolean; message?: string; fieldErrors?: Record<string, string>; data?: T }
const isNextControlFlow = (e: unknown) => !!e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_');

function toFailure(e: unknown): ActionState<never> {
  if (isNextControlFlow(e)) throw e; // redirect() / notFound() must propagate
  if (e instanceof AppError) return { ok: false, message: e.message, fieldErrors: e.fields };
  if (e instanceof ZodError) return { ok: false, message: 'Please fix the highlighted fields', fieldErrors: zodFields(e) };
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false, message: 'A record with the same unique value already exists' };
  console.error('[action]', e);
  return { ok: false, message: 'Unexpected error - please try again' };
}
/** Authenticated action: resolves the principal, runs the service call, maps errors. Authorization happens INSIDE the service. */
export async function run<T>(fn: (p: Principal) => Promise<T>, message?: string): Promise<ActionState<T>> {
  try { const data = await fn(await requirePrincipal()); return { ok: true, message, data }; } catch (e) { return toFailure(e); }
}
export async function runPublic<T>(fn: () => Promise<T>, message?: string): Promise<ActionState<T>> {
  try { return { ok: true, message, data: await fn() }; } catch (e) { return toFailure(e); }
}
export { errorResponse };
