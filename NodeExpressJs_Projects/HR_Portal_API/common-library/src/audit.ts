import type { PoolConnection } from 'mysql2/promise';
import { v4 as uuid } from 'uuid';
import { requestContext } from './context';
import type { Db } from './db';

/** Append-only business audit trail (audit_history exists in every service database). */
export async function audit(db: Db, conn: PoolConnection | undefined, entityType: string, entityId: string, action: string,
  previous?: unknown, next?: unknown): Promise<void> {
  const ctx = requestContext.get();
  await db.exec(
    'INSERT INTO audit_history (id, action, correlation_id, created_at, entity_id, entity_type, new_value, previous_value, user_id) VALUES (?,?,?,?,?,?,?,?,?)',
    [uuid(), action, ctx?.correlationId ?? null, new Date(), entityId, entityType,
      next === undefined ? null : JSON.stringify(redactForAudit(next)), previous === undefined ? null : JSON.stringify(redactForAudit(previous)),
      ctx?.user?.userId ?? null], conn);
}

const SENSITIVE = /password|account_?number|pan_?number|national_?id|token|secret/i;
function redactForAudit(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(redactForAudit);
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = SENSITIVE.test(k) ? '[MASKED]' : redactForAudit(val);
  return out;
}

export async function auditTrail(db: Db, entityType: string | undefined, entityId: string | undefined, limit = 100) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (entityType) { where.push('entity_type = ?'); params.push(entityType); }
  if (entityId) { where.push('entity_id = ?'); params.push(entityId); }
  return db.query(`SELECT * FROM audit_history ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`, [...params, Math.min(limit, 500)]);
}
