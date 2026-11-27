import { route, ok, created, json, idOf } from '@/server/http/api';
import { doctorService } from '@/server/services/doctor.service';

export const POST = route({}, async (c) => {
return created(await doctorService.addTimeOff(c.principal, idOf(c.params.id), await json(c.req)));
});
export const DELETE = route({}, async (c) => {
await doctorService.removeTimeOff(c.principal, idOf(c.params.id), idOf(c.req.nextUrl.searchParams.get("timeOffId") ?? "")); return ok(null);
});
