import type { Request } from 'express';
import { Conn, exec } from './db';
import { clientIp } from './http';

export async function audit(
  req: Request | null, actorId: number | null, action: string, entityType: string,
  entityId: number | string | null, details: Record<string, unknown> | null = null, conn?: Conn,
) {
  await exec(
    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address) VALUES (?,?,?,?,?,?)',
    [actorId, action, entityType, entityId === null ? null : String(entityId),
      details ? JSON.stringify(details) : null, req ? clientIp(req) : null], conn);
}
