import { Kafka, logLevel, CompressionTypes } from 'kafkajs';
import { buildEvent, parseEvent } from '../contracts/events.js';
import { ALL_TOPICS, dlt } from '../constants/index.js';
import { currentContext, context, newCorrelationId } from '../logging/index.js';

/** Reusable KafkaJS client factory (KafkaJS' own log output is routed through pino). */
export function createKafka(config, logger, clientId) {
  const toPino = () => ({ namespace, level, label, log }) => {
    const { message, ...extra } = log;
    const lvl = level === logLevel.ERROR ? 'warn' : level === logLevel.WARN ? 'warn' : 'debug';
    logger[lvl]({ kafka: namespace, ...extra }, `kafkajs ${label}: ${message}`);
  };
  return new Kafka({ clientId, brokers: config.kafka.brokers, logLevel: logLevel.WARN, logCreator: toPino, retry: { retries: 4, initialRetryTime: 300 }, connectionTimeout: 3000, requestTimeout: 8000 });
}

/** Creates every topic and its .DLT (idempotent; failures are logged, not fatal). */
export async function ensureTopics(kafka, logger, topics = ALL_TOPICS) {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const existing = new Set(await admin.listTopics());
    const wanted = topics.flatMap((t) => [t, dlt(t)]).filter((t) => !existing.has(t));
    if (wanted.length) {
      await admin.createTopics({ waitForLeaders: true, topics: wanted.map((topic) => ({ topic, numPartitions: 3, replicationFactor: 1 })) });
      logger.info({ count: wanted.length }, 'Kafka topics created');
    }
  } catch (e) { logger.warn({ err: e.message }, 'Kafka topic initialisation skipped'); } finally { await admin.disconnect().catch(() => {}); }
}

/**
 * OUTBOX: stage an event INSIDE the business transaction (tx = Prisma transaction client). The event row commits (or rolls back)
 * together with the business change, so an event is never published for a change that did not commit.
 */
export async function stageEvent(tx, type, key, payload) {
  const { topic, event } = buildEvent(type, payload, currentContext().correlationId);
  await tx.outboxEvent.create({ data: { topic, key: String(key), payload: JSON.stringify(event), correlationId: event.correlationId } });
}

/** Relay: ships committed outbox rows to Kafka in id order (at-least-once; consumers are idempotent). Stops the batch at the first failure to keep ordering. */
export function startOutboxRelay({ prisma, kafka, logger, intervalMs = 1000, batch = 50 }) {
  const producer = kafka.producer({ idempotent: true, maxInFlightRequests: 1 });
  let connected = false; let timer; let running = false; let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      if (!connected) { await producer.connect(); connected = true; logger.info('Kafka producer connected (outbox relay)'); }
      const rows = await prisma.outboxEvent.findMany({ where: { sentAt: null }, orderBy: { id: 'asc' }, take: batch });
      for (const row of rows) {
        try {
          const headers = { eventType: JSON.parse(row.payload).type, ...(row.correlationId ? { 'x-correlation-id': row.correlationId } : {}) };
          const [meta] = await producer.send({ topic: row.topic, acks: -1, compression: CompressionTypes.None, messages: [{ key: row.key, value: row.payload, headers }] });
          await prisma.outboxEvent.update({ where: { id: row.id }, data: { sentAt: new Date(), attempts: { increment: 1 } } });
          logger.info({ topic: row.topic, partition: meta.partition, offset: meta.baseOffset, key: row.key, outboxId: row.id }, 'Kafka PRODUCED event');
        } catch (e) {
          await prisma.outboxEvent.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }).catch(() => {});
          logger.warn({ outboxId: row.id, topic: row.topic, err: e.message }, 'Kafka produce failed; will retry on the next tick');
          connected = false; await producer.disconnect().catch(() => {});
          break;
        }
      }
    } catch (e) { connected = false; logger.warn({ err: e.message }, 'Outbox relay iteration failed'); } finally { running = false; }
  };
  timer = setInterval(tick, intervalMs);
  return { producer, async stop() { stopped = true; clearInterval(timer); await producer.disconnect().catch(() => {}); } };
}

/**
 * Consumer with INBOX idempotency, retries with exponential back-off and a dead-letter topic.
 * handlers: { [topic]: async (payload, { tx, event }) => void } - each handler runs in a Prisma transaction together with the
 * inbox row (eventId, consumer), so the effect and the "processed" record commit atomically.
 */
export async function startConsumer({ kafka, groupId, prisma, logger, handlers, maxAttempts = 3, retryBaseMs = 500 }) {
  const consumer = kafka.consumer({ groupId, sessionTimeout: 15000, allowAutoTopicCreation: true });
  const dltProducer = kafka.producer();
  await consumer.connect();
  await dltProducer.connect();
  const topics = Object.keys(handlers);
  for (const topic of topics) await consumer.subscribe({ topic, fromBeginning: true });
  logger.info({ groupId, topics }, 'Kafka consumer subscribed');

  const toDlt = async (topic, message, err) => {
    logger.error({ topic, offset: message.offset, err: err.message }, 'Giving up on message -> dead-letter topic');
    await dltProducer.send({ topic: dlt(topic), messages: [{ key: message.key, value: message.value, headers: { error: String(err.message).slice(0, 200) } }] })
      .catch((e) => logger.error({ err: e.message }, 'Could not write to the dead-letter topic'));
  };

  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ topic, partition, message }) => {
      const raw = message.value?.toString() ?? '';
      let event;
      try { event = parseEvent(raw); } catch (e) { return toDlt(topic, message, e); }       // poison message: no retries
      const correlationId = event.correlationId ?? message.headers?.['x-correlation-id']?.toString() ?? newCorrelationId();
      const consumerName = `${groupId}:${topic}`;
      return context.run({ correlationId }, async () => {
        let last;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            await prisma.$transaction(async (tx) => {
              const dup = await tx.processedEvent.findUnique({ where: { eventId_consumer: { eventId: event.eventId, consumer: consumerName } } });
              if (dup) { logger.info({ eventId: event.eventId, consumer: consumerName }, 'Duplicate event ignored'); return; }
              logger.info({ type: event.type, eventId: event.eventId, topic, partition, offset: message.offset }, 'Kafka CONSUMED event');
              await handlers[topic](event.payload, { tx, event });
              await tx.processedEvent.create({ data: { eventId: event.eventId, consumer: consumerName } });
            }, { timeout: 20000, maxWait: 10000 });
            return;
          } catch (e) {
            last = e;
            logger.warn({ topic, offset: message.offset, attempt, maxAttempts, err: e.message }, 'Kafka handler failed');
            if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, retryBaseMs * 2 ** (attempt - 1)));
          }
        }
        await toDlt(topic, message, last);
      });
    },
  });
  return { async stop() { await consumer.disconnect().catch(() => {}); await dltProducer.disconnect().catch(() => {}); } };
}
