"use strict";
// ============================================================
// WHAT: Authentication factory — selects provider at startup
// WHY:  The factory pattern decouples the rest of the app from
//       knowing which auth provider is active. Business logic (
//       company CRUD, employee management) doesn't change whether
//       you use JWT or OAuth2.
// HOW:  Reads AUTH_PROVIDER env var. Returns the configured provider.
//       Routes call authFactory.getProvider() to get the right impl.
// Enterprise Use Case: This is how enterprise apps support multiple
//       tenants with different auth requirements (some use SSO, some
//       use passwords) without duplicating the rest of the codebase.
// Benefits of config-driven auth:
//   1. No code changes to switch auth method
//   2. Same test suite covers both paths
//   3. Rollback is a config change, not a deploy
// Interview Tip: The Factory pattern is one of the Gang of Four (GoF)
//               creational design patterns. Know when to use it.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.authProvider = exports.initAuth = void 0;
const env_config_1 = require("../config/env.config");
const jwt_provider_1 = require("./providers/jwt.provider");
const oauth_provider_1 = require("./providers/oauth.provider");
const logger_1 = require("../utils/logger");
const initAuth = () => {
    const { provider, enableOAuth2 } = env_config_1.config.auth;
    logger_1.logger.info(`Auth provider: ${provider} | OAuth2 enabled: ${enableOAuth2}`);
    if (enableOAuth2 || provider === 'oauth2') {
        // Configure Passport strategies — Google, GitHub
        (0, oauth_provider_1.configureOAuth)();
    }
};
exports.initAuth = initAuth;
// The single auth provider interface used everywhere else
// This abstraction means controllers/services don't import providers directly
exports.authProvider = jwt_provider_1.jwtProvider;
