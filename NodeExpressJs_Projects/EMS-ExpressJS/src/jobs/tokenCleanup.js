// Housekeeping: purge long-expired refresh / password-reset tokens once an hour.
const tokenRepo = require('../repositories/authTokenRepository');
const logger = require('../utils/logger');

let timer;
const run = () => Promise.all([tokenRepo.purgeExpiredRefresh(), tokenRepo.purgeExpiredResets()]).catch((e) => logger.error('job.tokenCleanup.failed', { error: e.message }));
module.exports = {
  run,
  start: () => { timer = setInterval(run, 60 * 60 * 1000); timer.unref(); },
  stop: () => clearInterval(timer),
};
