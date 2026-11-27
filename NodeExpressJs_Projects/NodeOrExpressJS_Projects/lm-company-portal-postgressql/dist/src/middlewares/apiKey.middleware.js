"use strict";
// ============================================================
// WHAT: API Key middleware for service-to-service authentication
// WHY:  Internal services (cron jobs, data pipelines) don't have
//       user accounts. API keys are a simple, stateless solution.
// HOW:  The caller includes the key in the X-API-Key header.
//       We compare against the configured key using constant-time
//       comparison to prevent timing attacks.
// Security Consideration: Rotate API keys regularly. Store them
//       in a secrets manager (Vault, AWS Secrets Manager) in production.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyMiddleware = void 0;
const env_config_1 = require("../config/env.config");
const exceptions_1 = require("../exceptions");
const apiKeyMiddleware = (req, _res, next) => {
    const key = req.headers['x-api-key'];
    if (!key || key !== env_config_1.config.apiKey) {
        return next(new exceptions_1.UnauthorizedError('Invalid or missing API key'));
    }
    next();
};
exports.apiKeyMiddleware = apiKeyMiddleware;
