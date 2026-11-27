import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, updateTag } from 'next/cache';
import { backendResponse } from '@/lib/api/backend';
import { errorResponse, guard } from '@/lib/api/route-helpers';
import { ApiError } from '@/lib/utilities/api-error';
import { CACHE_TAGS } from '@/constants/cache';

const MAX = 5 * 1024 * 1024;
const TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
type Ctx = RouteContext<'/api/lab/requests/[requestId]/attachment'>;

/** File download: streams the backend binary to the browser with the original Content-Type / Content-Disposition. */
export async function GET(_r: NextRequest, ctx: Ctx) {
  const g = await guard('lab:read'); if ('response' in g) return g.response;
  const { requestId } = await ctx.params;
  try {
    const res = await backendResponse(`/api/lab/requests/${Number(requestId)}/report/attachment`, { cache: 'no-store' });
    if (!res.ok) throw ApiError.fromBody(res.status, await res.json().catch(() => null));
    return new NextResponse(res.body, { headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream', 'Content-Disposition': res.headers.get('content-disposition') ?? 'attachment', 'Cache-Control': 'private, no-store' } });
  } catch (e) { return errorResponse(e); }
}

/** File upload (multipart/form-data, field `file`): validated here (type + size) then forwarded to the Laboratory service. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await guard('lab:process'); if ('response' in g) return g.response;
  const { requestId } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ status: 400, message: 'Choose a file to upload' }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ status: 415, message: 'Only PDF, PNG or JPEG files are accepted' }, { status: 415 });
  if (file.size > MAX) return NextResponse.json({ status: 413, message: 'File is larger than 5 MB' }, { status: 413 });
  try {
    const out = new FormData(); out.append('file', file, file.name);
    const res = await backendResponse(`/api/lab/requests/${Number(requestId)}/report/attachment`, { method: 'POST', body: out, cache: 'no-store' });
    if (!res.ok) throw ApiError.fromBody(res.status, await res.json().catch(() => null));
    updateTag(CACHE_TAGS.labReports); revalidatePath(`/laboratory/${requestId}`);
    return NextResponse.json(await res.json(), { status: 201 });
  } catch (e) { return errorResponse(e); }
}
