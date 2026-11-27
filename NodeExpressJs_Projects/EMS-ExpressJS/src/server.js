const env = require('./config/env');
env.assertConfigured();
const { createApp } = require('./app');
const db = require('./config/database');
const logger = require('./utils/logger');
const jobs = require('./jobs/tokenCleanup');

const server = createApp().listen(env.port, () => logger.info('server.started', { port: env.port, env: env.nodeEnv, api: env.apiPrefix, docs: '/api-docs' }));
jobs.start();

async function shutdown(signal) {
  logger.info('server.stopping', { signal });
  jobs.stop();
  server.close(async () => { await db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
