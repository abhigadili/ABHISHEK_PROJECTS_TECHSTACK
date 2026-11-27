import { Kafka, Producer, Consumer, logLevel, Admin } from 'kafkajs';
import { v4 as uuid } from 'uuid';
import type { PoolConnection } from 'mysql2/promise';
import { config } from './config';
import { requestContext } from './context';
import { Db } from './db';
import { logger } from './logger';

/** Topic catalogue (prompt section 14). Each also has `.retry` and `.DLT` companions. */
export const Topics = {
  EMPLOYEE_CREATED: 'employee.created',
  EMPLOYEE_UPDATED: 'employee.updated',
  EMPLOYEE_TERMINATED: 'employee.terminated',
  LEAVE_APPLIED: 'leave.applied',
  LEAVE_APPROVED: 'leave.approved',
  LEAVE_REJECTED: 'leave.rejected',
  LEAVE_CANCELLED: 'leave.cancelled',
  ATTENDANCE_CHECKED_IN: 'attendance.checked-in',
  ATTENDANCE_CHECKED_OUT: 'attendance.checked-out',
  ATTENDANCE_CORRECTED: 'attendance.corrected',
  PAYROLL_PROCESSED: 'payroll.processed',
  PAYSLIP_GENERATED: 'payslip.generated',
  TAX_DECLARATION_SUBMITTED: 'tax.declaration.submitted',
  PERFORMANCE_REVIEW_SUBMITTED: 'performance.review.submitted',
  TIMESHEET_SUBMITTED: 'timesheet.submitted',
  TIMESHEET_APPROVED: 'timesheet.approved',
  RESIGNATION_SUBMITTED: 'resignation.submitted',
  RESIGNATION_WITHDRAWN: 'resignation.withdrawn',
  EMPLOYEE_EXITED: 'employee.exited',
  NOTIFICATION_REQUESTED: 'notification.requested',
} as const;
export type Topic = (typeof Topics)[keyof typeof Topics];
export const ALL_TOPICS: string[] = Object.values(Topics);
export const PARTITIONS = 3;

export interface EventEnvelope<T = any> {
  eventId: string;
  eventType: string;
  version: number;
  timestamp: string;
  correlationId: string;
  source: string;
  employeeId?: string | null;
  payload: T;
}

export function buildEvent<T>(eventType: string, source: string, payload: T, employeeId?: string | null): EventEnvelope<T> {
  return {
    eventId: uuid(), eventType, version: 1, timestamp: new Date().toISOString(),
    correlationId: requestContext.correlationId() ?? uuid(), source, employeeId: employeeId ?? null, payload,
  };
}

let kafka: Kafka | undefined;
function kafkaClient(service: string): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: `${config.kafka.prefix}-${service}`, brokers: config.kafka.brokers, logLevel: logLevel.NOTHING,
      retry: { retries: 3, initialRetryTime: 300 }, connectionTimeout: 3000, requestTimeout: 8000,
    });
  }
  return kafka;
}

let producer: Producer | undefined;
async function getProducer(service: string): Promise<Producer> {
  if (!producer) {
    producer = kafkaClient(service).producer({ idempotent: true, maxInFlightRequests: 1, allowAutoTopicCreation: true });
    await producer.connect();
  }
  return producer;
}

export async function ensureTopics(service: string, extra: string[] = []): Promise<void> {
  if (!config.kafka.enabled) return;
  const admin: Admin = kafkaClient(service).admin();
  try {
    await admin.connect();
    const base = [...ALL_TOPICS, ...extra];
    const all = base.flatMap((t) => [t, `${t}.retry`, `${t}.DLT`]);
    await admin.createTopics({ waitForLeaders: true, topics: all.map((t) => ({ topic: t, numPartitions: PARTITIONS, replicationFactor: 1 })) });
  } catch (e: any) {
    logger.warn({ err: e.message }, 'topic creation skipped');
  } finally {
    await admin.disconnect().catch(() => undefined);
  }
}

export async function listTopics(service: string): Promise<{ name: string; partitions: number }[]> {
  if (!config.kafka.enabled) return ALL_TOPICS.map((name) => ({ name, partitions: 0 }));
  const admin = kafkaClient(service).admin();
  try {
    await admin.connect();
    const md = await admin.fetchTopicMetadata();
    return md.topics.filter((t) => !t.name.startsWith('__')).map((t) => ({ name: t.name, partitions: t.partitions.length })).sort((a, b) => a.name.localeCompare(b.name));
  } finally {
    await admin.disconnect().catch(() => undefined);
  }
}

/** Direct publish (used by the outbox relay and for non-critical events). Key = employeeId => per-employee ordering. */
export async function sendEvent(service: string, topic: string, event: EventEnvelope, key?: string): Promise<void> {
  const p = await getProducer(service);
  await p.send({
    topic, acks: -1,
    messages: [{ key: key ?? event.employeeId ?? event.eventId, value: JSON.stringify(event), headers: { eventId: event.eventId, correlationId: event.correlationId, source: event.source } }],
  });
  logger.info({ topic, eventId: event.eventId }, 'kafka event produced');
}

/**
 * Transactional outbox: write the event in the same DB transaction as the business change;
 * the relay publishes it afterwards (at-least-once, consumers are idempotent).
 */
export async function enqueueOutbox(db: Db, conn: PoolConnection | undefined, topic: string, event: EventEnvelope): Promise<void> {
  await db.exec(
    'INSERT INTO outbox_events (topic, event_key, payload, attempts, created_at) VALUES (?,?,?,0,?)',
    [topic, event.employeeId ?? event.eventId, JSON.stringify(event), new Date()], conn);
}

export function startOutboxRelay(service: string, db: Db, intervalMs = 1500): () => void {
  let stopped = false;
  let busy = false;
  const tick = async (): Promise<void> => {
    if (busy || stopped) return;
    busy = true;
    try {
      await db.tx(async (conn) => {
        const rows = await db.query<any>(
          'SELECT id, topic, event_key, payload, attempts FROM outbox_events WHERE sent_at IS NULL AND attempts < 10 ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED', [], conn);
        for (const r of rows) {
          try {
            const ev = JSON.parse(r.payload) as EventEnvelope;
            if (config.kafka.enabled) await sendEvent(service, r.topic, ev, r.event_key ?? undefined);
            await db.exec('UPDATE outbox_events SET sent_at = ?, attempts = attempts + 1 WHERE id = ?', [new Date(), r.id], conn);
          } catch (e: any) {
            logger.warn({ id: r.id, err: e.message }, 'outbox publish failed');
            await db.exec('UPDATE outbox_events SET attempts = attempts + 1 WHERE id = ?', [r.id], conn);
          }
        }
      });
    } catch (e: any) {
      logger.warn({ err: e.message }, 'outbox relay tick failed');
    } finally {
      busy = false;
    }
  };
  const t = setInterval(() => void tick(), intervalMs);
  t.unref();
  return () => { stopped = true; clearInterval(t); };
}

export type EventHandler = (event: EventEnvelope, conn: PoolConnection, meta: { topic: string; partition: number; offset: string }) => Promise<void>;

export interface ConsumerOptions {
  service: string;
  groupId: string;
  db: Db;
  handlers: Record<string, EventHandler>;
  maxAttempts?: number;
}

/**
 * Consumer with consumer group, idempotent processing (processed_events), retry topics and DLT.
 * The idempotency claim and the handler run in ONE transaction, so a failed handler leaves no marker.
 */
export async function startConsumer(opts: ConsumerOptions): Promise<(() => Promise<void>) | undefined> {
  if (!config.kafka.enabled) return undefined;
  const { service, groupId, db, handlers } = opts;
  const maxAttempts = opts.maxAttempts ?? 3;
  const topics = Object.keys(handlers);
  const consumer: Consumer = kafkaClient(service).consumer({ groupId, sessionTimeout: 30000, allowAutoTopicCreation: true });
  try {
    await consumer.connect();
    for (const t of topics) await consumer.subscribe({ topic: t, fromBeginning: true });
    for (const t of topics) await consumer.subscribe({ topic: `${t}.retry`, fromBeginning: true });
  } catch (e: any) {
    logger.warn({ err: e.message }, 'kafka consumer could not start');
    return undefined;
  }
  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ topic, partition, message }) => {
      const base = topic.replace(/\.retry$/, '');
      const handler = handlers[base];
      const raw = message.value?.toString();
      if (!handler || !raw) return;
      const attempt = Number(message.headers?.attempt?.toString() ?? '0');
      const notBefore = Number(message.headers?.notBefore?.toString() ?? '0');
      if (notBefore > Date.now()) await new Promise((r) => setTimeout(r, Math.min(notBefore - Date.now(), 10000)));
      let event: EventEnvelope;
      try { event = JSON.parse(raw) as EventEnvelope; } catch {
        await sendRaw(service, `${base}.DLT`, raw, { reason: 'unparseable' });
        return;
      }
      await requestContext.run({ correlationId: event.correlationId }, async () => {
        try {
          await db.tx(async (conn) => {
            const claim = await db.exec('INSERT IGNORE INTO processed_events (consumer, event_id, processed_at) VALUES (?,?,?)', [groupId, event.eventId, new Date()], conn);
            if (claim.affectedRows === 0) { logger.info({ eventId: event.eventId, topic }, 'duplicate event skipped'); return; }
            await handler(event, conn, { topic, partition, offset: message.offset });
          });
          logger.info({ topic, eventId: event.eventId }, 'kafka event consumed');
        } catch (e: any) {
          logger.error({ topic, eventId: event.eventId, attempt, err: e.message }, 'event handler failed');
          if (attempt + 1 >= maxAttempts) await sendRaw(service, `${base}.DLT`, raw, { reason: String(e.message).slice(0, 200), attempt: String(attempt + 1) });
          else await sendRaw(service, `${base}.retry`, raw, { attempt: String(attempt + 1), notBefore: String(Date.now() + 2000 * (attempt + 1)) });
        }
      });
    },
  });
  logger.info({ groupId, topics }, 'kafka consumer running');
  return async () => { await consumer.disconnect().catch(() => undefined); };
}

async function sendRaw(service: string, topic: string, value: string, headers: Record<string, string>): Promise<void> {
  const p = await getProducer(service);
  await p.send({ topic, messages: [{ value, headers }] });
}

export async function closeKafka(): Promise<void> {
  if (producer) { await producer.disconnect().catch(() => undefined); producer = undefined; }
}
