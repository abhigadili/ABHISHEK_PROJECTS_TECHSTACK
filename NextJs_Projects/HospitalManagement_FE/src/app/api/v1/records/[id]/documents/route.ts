import { route, created, idOf } from '@/server/http/api';
import { recordService } from '@/server/services/medical-record.service';
import { AppError } from '@/server/utilities/errors';

export const POST = route({}, async (c) => {
const f = (await c.req.formData()).get("file"); if (!(f instanceof File)) throw new AppError(400, "BAD_REQUEST", "Attach a file in the `file` field", { file: "Required" }); return created(await recordService.attach(c.principal, idOf(c.params.id), f));
});
