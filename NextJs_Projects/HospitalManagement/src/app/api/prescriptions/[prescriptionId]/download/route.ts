import { NextRequest, NextResponse } from 'next/server';
import { prescriptionService } from '@/services/backend/prescriptions';
import { errorResponse, guard } from '@/lib/api/route-helpers';
import { formatDate } from '@/lib/utilities/format';

const esc = (s: string | null | undefined) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** File download generated server-side: a printable HTML prescription (the backend has no PDF endpoint). Content-Type + Content-Disposition set explicitly. */
export async function GET(_r: NextRequest, ctx: RouteContext<'/api/prescriptions/[prescriptionId]/download'>) {
  const g = await guard('prescriptions:read'); if ('response' in g) return g.response;
  try {
    const rx = await prescriptionService.get(Number((await ctx.params).prescriptionId));
    const rows = rx.items.map((i) => `<tr><td>${esc(i.medicineName)}</td><td>${esc(i.dosage)}</td><td>${esc(i.frequency)}</td><td>${i.durationDays} d</td><td>${i.quantity}</td><td>${esc(i.instructions)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Prescription #${rx.id}</title><style>body{font-family:system-ui;margin:40px;color:#111}h1{margin:0}table{border-collapse:collapse;width:100%;margin-top:16px}td,th{border:1px solid #bbb;padding:6px 8px;text-align:left;font-size:14px}.m{color:#555}</style></head><body><h1>Prescription #${rx.id}</h1><p class="m">Issued ${formatDate(rx.issuedAt)} · valid until ${formatDate(rx.validUntil)} · status ${esc(rx.status)}</p><p><b>Patient:</b> ${esc(rx.patientName)} &nbsp; <b>Doctor:</b> ${esc(rx.doctorName)}</p><p><b>Diagnosis:</b> ${esc(rx.diagnosis)}</p><table><thead><tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Instructions</th></tr></thead><tbody>${rows}</tbody></table><p class="m">${esc(rx.notes)}</p></body></html>`;
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="prescription-${rx.id}.html"`, 'Cache-Control': 'private, no-store' } });
  } catch (e) { return errorResponse(e); }
}
