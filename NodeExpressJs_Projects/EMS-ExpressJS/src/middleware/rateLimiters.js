const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const handler = (req, res) =>
  res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } });

const make = (windowMs, max) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, handler });

module.exports = {
  api: make(15 * 60 * 1000, env.rateLimit.apiMax),
  login: make(15 * 60 * 1000, env.isTest ? 100000 : env.rateLimit.loginMax),
  sensitive: make(15 * 60 * 1000, env.isTest ? 100000 : 20), // forgot/reset/change password
};
