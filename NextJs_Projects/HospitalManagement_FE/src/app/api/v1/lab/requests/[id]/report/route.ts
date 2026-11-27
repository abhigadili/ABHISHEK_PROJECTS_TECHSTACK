import { route, ok, idOf } from '@/server/http/api';
import { labService } from '@/server/services/laboratory.service';

export const PUT = route({}, async (c) => {
const fd = await c.req.formData(); const raw = { resultSummary: fd.get("resultSummary") ?? "", resultDetails: fd.get("resultDetails") ?? "", referenceRange: fd.get("referenceRange") ?? "", abnormal: fd.get("abnormal") === "true", publish: fd.get("publish") !== "false" }; const f = fd.get("file"); await labService.enterReport(c.principal, idOf(c.params.id), raw, f instanceof File ? f : null); return ok(null);
});
export const GET = route({}, async (c) => {
const r = await labService.downloadReport(c.principal, idOf(c.params.id)); return new Response(new Uint8Array(r.data), { headers: { "Content-Type": r.type, "Content-Disposition": `attachment; filename="${r.name}"`, "Cache-Control": "private, no-store" } });
});
