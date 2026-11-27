import { createApp } from './app';
import { env } from './config/env';
import { closePool, getPool } from './lib/db';
import { startScheduler } from './jobs/maintenance';

async function main() {
  await getPool().query('SELECT 1'); // fail fast when MySQL is unreachable
  const app = createApp();
  const server = app.listen(env.PORT, () => console.log(`[api] listening on :${env.PORT} (${env.NODE_ENV}) -> MySQL ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`));
  if (env.JOBS_ENABLED) startScheduler();
  const stop = () => { server.close(() => closePool().then(() => process.exit(0))); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch((e) => { console.error('Failed to start:', e.message); process.exit(1); });
