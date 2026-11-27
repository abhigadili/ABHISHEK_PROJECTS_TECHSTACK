const env = require('./env');

module.exports = {
  accessSecret: () => env.jwt.accessSecret,
  accessTtl: env.jwt.accessTtl,
  refreshTtlDays: env.jwt.refreshTtlDays,
  passwordResetTtlMinutes: 30,
  bcryptRounds: env.bcryptRounds,
};
