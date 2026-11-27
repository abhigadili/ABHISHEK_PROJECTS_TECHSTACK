import type { Router } from 'express';
import { config } from './config';
import { Db, getDb } from './db';
import { createServiceApp, listen, setServiceLogger } from './http';
import { ensureTopics, startConsumer, startOutboxRelay, closeKafka, EventHandler } from './kafka';
import { logger } from './logger';
import { closeRedis, redis } from './redis';

export interface ServiceDefinition {
  name: string;
  port: number;
  database: string;
  requiredTables: string[];
  mount: (router: Router, db: Db) => void;
  mountPublic?: (router: Router, db: Db) => void;
  /** Kafka handlers by topic; consumer group = hr-node-<name> */
  consumers?: (db: Db) => Record<string, EventHandler>;
  /** run once after DB is verified (seed data, bootstrap admin, schedulers) */
  onStart?: (db: Db) => Promise<void>;
  relayOutbox?: boolean;
}

export async function bootService(def: ServiceDefinition): Promise<{ db: Db }> {
  setServiceLogger(def.name);
  const db = getDb(def.database);
  await db.requireTables(def.requiredTables);
  redis(); // lazy connect, failures degrade to no-cache
  const app = createServiceApp({
    name: def.name,
    mount: (r) => def.mount(r, db),
    mountPublic: def.mountPublic ? (r) => def.mountPublic!(r, db) : undefined,
  });
  const stops: Array<() => void | Promise<void>> = [];
  await def.onStart?.(db);
  if (config.kafka.enabled) {
    void ensureTopics(def.name).then(async () => {
      const handlers = def.consumers?.(db);
      if (handlers && Object.keys(handlers).length) {
        const stop = await startConsumer({ service: def.name, groupId: `hr-node-${def.name}`, db, handlers });
        if (stop) stops.push(stop);
      }
    });
  }
  if (def.relayOutbox !== false) stops.push(startOutboxRelay(def.name, db));
  listen({
    name: def.name, port: def.port, app,
    onShutdown: async () => { for (const s of stops) await s(); await closeKafka(); await closeRedis(); await db.close(); },
  });
  logger.info({ database: def.database }, 'service started');
  return { db };
}
