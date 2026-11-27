import express from 'express';
import helmet from 'helmet';
import cron from 'node-cron';
import { loadConfig } from './config/index.js';
import { createLogger, httpLogger, context, newCorrelationId } from './logging/index.js';
import { configureAuth, createCache, errorHandler, notFoundHandler } from './utils/index.js';
import { createKafka, ensureTopics, startConsumer, startOutboxRelay } from './kafka/index.js';
import { startGrpcServer } from './grpc/index.js';
import { defineApi, mountDocs } from './docs/openapi.js';

/**
 * Starts one microservice with everything wired the same way:
 * config -> logger -> Prisma (connectivity verified) -> Redis (fail-open) -> Kafka (outbox relay + consumer) -> gRPC server -> Express -> cron jobs,
 * and a graceful shutdown that closes them all in reverse order.
 *
 * build(ctx) returns { registerRoutes(api), grpc?: [{service, impl, roles?}], handlers?: { topic: fn }, jobs?: [{name, schedule, run}] }
 */
export async function startService({ service, dbName, defaultPort, grpcPort, PrismaClient, apiTitle, build, outbox = true }) {
  const config = loadConfig(service, { dbName, defaultPort, grpcPort });
  const logger = await createLogger(service, config.log);
  const closers = [];
  try {
    // ---- database
    const prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } }, log: [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }] });
    prisma.$on('warn', (e) => logger.warn({ prisma: e.message }, 'Prisma warning'));
    prisma.$on('error', (e) => logger.error({ prisma: e.message }, 'Prisma error'));
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info({ database: dbName }, 'Database connection verified');
    closers.push(['prisma', () => prisma.$disconnect()]);

    // ---- redis (never blocks start-up; fail-open)
    const cache = createCache({ url: config.redis.url, service, logger });
    cache.connect();
    closers.push(['redis', () => cache.close()]);

    const kafka = createKafka(config, logger, service);
    const ctx = { service, config, logger, prisma, cache, kafka };
    const parts = await build(ctx);

    // ---- kafka: topics, outbox relay, consumer
    if (outbox || parts.handlers) await ensureTopics(kafka, logger);
    if (outbox) { const relay = startOutboxRelay({ prisma, kafka, logger, intervalMs: config.kafka.outboxIntervalMs }); closers.push(['outbox-relay', () => relay.stop()]); }
    if (parts.handlers) {
      startConsumer({ kafka, groupId: service, prisma, logger, handlers: parts.handlers, maxAttempts: config.kafka.maxAttempts, retryBaseMs: config.kafka.retryBaseMs })
        .then((c) => closers.push(['kafka-consumer', () => c.stop()]))
        .catch((e) => logger.error({ err: e.message }, 'Kafka consumer could not start'));
    }

    // ---- gRPC server
    if (parts.grpc?.length && config.grpcPort) {
      const g = await startGrpcServer({ port: config.grpcPort, services: parts.grpc, logger });
      closers.push(['grpc', () => g.stop()]);
    }

    // ---- express
    const app = express();
    app.disable('x-powered-by');
    app.use(helmet());
    app.use(httpLogger(logger));
    app.use((req, res, next) => context.run({ correlationId: req.id, authorization: req.headers.authorization }, next));
    app.use(express.json({ limit: '1mb' }));
    app.use(configureAuth(config.jwt));
    app.get('/ping', (req, res) => res.json({ service, status: 'UP' }));
    const router = express.Router();
    const registry = [];
    parts.registerRoutes(defineApi(router, registry));
    app.use(router);
    mountDocs(app, { title: apiTitle ?? service, registry });
    app.use(notFoundHandler);
    app.use(errorHandler(logger));

    const server = await new Promise((resolve, reject) => { const s = app.listen(config.port, () => resolve(s)); s.on('error', reject); });
    logger.info({ port: config.port, grpcPort: config.grpcPort }, `${service} listening`);
    closers.push(['http-server', () => new Promise((r) => { server.close(() => r()); server.closeIdleConnections?.(); setTimeout(() => { server.closeAllConnections?.(); }, 3000).unref(); })]);

    // ---- scheduled jobs (node-cron; schedules come from configuration)
    if (!config.jobs.disabled) {
      for (const job of parts.jobs ?? []) {
        if (!cron.validate(job.schedule)) { logger.error({ job: job.name, schedule: job.schedule }, 'Invalid cron expression - job not scheduled'); continue; }
        let busy = false;
        const task = cron.schedule(job.schedule, () => {
          if (busy) return;
          busy = true;
          context.run({ correlationId: newCorrelationId() }, async () => {
            try { await job.run(); } catch (e) { logger.error({ err: e, job: job.name }, 'Scheduled job failed'); } finally { busy = false; }
          });
        });
        closers.push([`cron:${job.name}`, () => task.stop()]);
        logger.info({ job: job.name, schedule: job.schedule }, 'Scheduled job registered');
      }
    }

    // ---- graceful shutdown
    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ signal }, 'Shutting down gracefully');
      const force = setTimeout(() => { logger.error('Forced exit after shutdown timeout'); process.exit(1); }, 15000);
      force.unref();
      for (const [name, close] of closers.reverse()) {
        try { await close(); logger.info({ component: name }, 'closed'); } catch (e) { logger.warn({ component: name, err: e.message }, 'close failed'); }
      }
      logger.flush?.();
      setTimeout(() => process.exit(0), 300);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('unhandledRejection', (e) => logger.error({ err: e }, 'Unhandled promise rejection'));
    return ctx;
  } catch (e) {
    logger.fatal({ err: e }, 'Service failed to start');
    logger.flush?.();
    setTimeout(() => process.exit(1), 500);
    throw e;
  }
}
