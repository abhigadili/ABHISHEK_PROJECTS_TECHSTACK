import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError, type ZodType } from 'zod';
import { AppError } from '@/server/utilities/errors';
import { requirePrincipal } from '@/server/auth/session';
import { assertCan } from '@/server/authorization/rbac';
import type { Principal } from '@/server/authorization/principal';
import type { PermissionKey } from '@/lib/constants/rbac';

/** Standard API envelope used by every Route Handler: { success, data?, meta?, error? } */
export interface ApiMeta { page?: number; size?: number; total?: number; totalPages?: number }
export type ApiResponse<T> = { success: true; data: T; meta?: ApiMeta } | { success: false; error: { code: string; message: string; fields?: Record<string, string> } };

export const ok = <T,>(data: T, meta?: ApiMeta, status = 200) => NextResponse.json<ApiResponse<T>>({ success: true, data, meta }, { status, headers: { 'Cache-Control': 'private, no-store' } });
export const created = <T,>(data: T) => ok(data, undefined, 201);
export const paged = <T,>(items: T[], total: number, page: number, size: number) => ok(items, { page, size, total, totalPages: Math.ceil(total / size) });

/** Central error mapping: AppError, Zod validation, Prisma constraint errors, anything else -> 500 (details stay in the server log). */
export function errorResponse(e: unknown) {
  let status = 500, code = 'INTERNAL_ERROR', message = 'Unexpected server error', fields: Record<string, string> | undefined;
  if (e instanceof AppError) ({ status, code, message, fields } = e);
  else if (e instanceof ZodError) { status = 400; code = 'VALIDATION_FAILED'; message = 'Validation failed'; fields = zodFields(e); }
  else if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') { status = 409; code = 'CONFLICT'; message = 'A record with the same unique value already exists'; }
    else if (e.code === 'P2025') { status = 404; code = 'NOT_FOUND'; message = 'Record not found'; }
    else if (e.code === 'P2003') { status = 409; code = 'CONFLICT'; message = 'The record is referenced by other data'; }
    else console.error('[api] prisma', e.code, e.message);
  } else console.error('[api]', e);
  return NextResponse.json<ApiResponse<never>>({ success: false, error: { code, message, fields } }, { status, headers: { 'Cache-Control': 'no-store' } });
}
/** field -> FIRST issue message (a field often violates several rules; the first is the most useful). */
export const zodFields = (e: ZodError): Record<string, string> => { const o: Record<string, string> = {}; for (const i of e.issues) { const k = i.path.join('.'); if (!(k in o)) o[k] = i.message; } return o; };

export interface Ctx { req: NextRequest; params: Record<string, string>; principal: Principal }
type Handler = (c: Ctx) => Promise<Response>;
/**
 * Thin Route Handler adapter: authenticates (verified access token), authorizes (permission), awaits params, and converts thrown
 * errors into the standard envelope. Business logic lives in services, never here.
 */
export function route(opts: { permission?: PermissionKey; public?: boolean }, fn: Handler) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const params = await ctx.params;
      const principal = opts.public ? (null as unknown as Principal) : await requirePrincipal();
      if (opts.permission) await assertCan(principal, opts.permission);
      return await fn({ req, params, principal });
    } catch (e) { return errorResponse(e); }
  };
}
export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const json = await req.json().catch(() => { throw new AppError(400, 'BAD_JSON', 'Request body must be valid JSON'); });
  return schema.parse(json);
}
export const query = <T,>(req: NextRequest, schema: ZodType<T>): T => schema.parse(Object.fromEntries(req.nextUrl.searchParams));
export const idOf = (v: string, what = 'id') => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw new AppError(400, 'BAD_REQUEST', `Invalid ${what}`); return n; };
/** Raw JSON body (services validate it with their Zod schema). */
export async function json(req: NextRequest): Promise<unknown> { return req.json().catch(() => { throw new AppError(400, 'BAD_JSON', 'Request body must be valid JSON'); }); }
