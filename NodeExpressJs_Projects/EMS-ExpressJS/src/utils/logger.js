const env = require('../config/env');

function log(level, msg, meta = {}) {
  if (env.isTest && level !== 'error') return;
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta })}\n`);
}
module.exports = {
  info: (m, x) => log('info', m, x),
  warn: (m, x) => log('warn', m, x),
  error: (m, x) => log('error', m, x),
};
