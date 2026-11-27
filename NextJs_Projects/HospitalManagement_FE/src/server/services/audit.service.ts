import "server-only";
import { db } from "@/server/db";
import type { Principal } from "@/server/authorization/principal";

/** Append-only audit trail (sign-ins, clinical access, role/permission changes, refunds ...). Never throws into the caller. */
export async function audit(
    p: Principal | { userId: number } | null,
    action: string,
    entity?: string,
    entityId?: number | string,
    detail?: Record<string, unknown>,
    ip?: string,
) {
    try {
        await db.auditLog.create({
            data: {
                userId: p?.userId ?? null,
                action,
                entity,
                entityId: entityId === undefined ? undefined : String(entityId),
                detail: detail as never,
                ip,
            },
        });
    } catch (e) {
        console.error("[audit]", e);
    }
}
