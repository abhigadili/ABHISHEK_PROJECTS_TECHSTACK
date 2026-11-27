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

import { config } from '../config/env.config';
import { jwtProvider } from './providers/jwt.provider';
import { configureOAuth } from './providers/oauth.provider';
import { logger } from '../utils/logger';

export const initAuth = (): void => {
  const { provider, enableOAuth2 } = config.auth;

  logger.info(`Auth provider: ${provider} | OAuth2 enabled: ${enableOAuth2}`);

  if (enableOAuth2 || provider === 'oauth2') {
    // Configure Passport strategies — Google, GitHub
    configureOAuth();
  }
};

// The single auth provider interface used everywhere else
// This abstraction means controllers/services don't import providers directly
export const authProvider = jwtProvider;
