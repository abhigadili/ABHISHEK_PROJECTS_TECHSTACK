"use strict";
// ============================================================
// WHAT: OAuth2 provider configuration using Passport.js
// WHY:  OAuth2 lets users log in with Google/GitHub — no password
//       to manage, fewer security liabilities, better UX.
// HOW:  1. User visits /api/auth/google → redirected to Google
//        2. Google redirects back with an auth code
//        3. Passport exchanges code for user profile
//        4. We upsert user and issue our own JWT (app still uses JWT
//           internally, OAuth is just the identity verification layer)
// When to use OAuth: consumer apps, enterprise SSO (SAML/OIDC).
// When NOT to use: API-only backends called by scripts/services.
// Interview Tip: OAuth2 is an AUTHORIZATION protocol repurposed for
//               authentication via OpenID Connect (OIDC). Technically,
//               OAuth2 alone doesn't tell you WHO the user is — OIDC does.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureOAuth = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_github2_1 = require("passport-github2");
const env_config_1 = require("../../config/env.config");
const jwt_provider_1 = require("./jwt.provider");
const logger_1 = require("../../utils/logger");
const configureOAuth = () => {
    // ---- Google OAuth2 Strategy ----
    if (env_config_1.config.google.clientId && env_config_1.config.google.clientSecret) {
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID: env_config_1.config.google.clientId,
            clientSecret: env_config_1.config.google.clientSecret,
            callbackURL: env_config_1.config.google.callbackUrl,
            scope: ['profile', 'email'],
        }, async (_accessToken, _refreshToken, profile, done) => {
            try {
                const normalised = {
                    provider: 'google',
                    providerId: profile.id,
                    email: profile.emails?.[0].value ?? '',
                    firstName: profile.name?.givenName ?? '',
                    lastName: profile.name?.familyName ?? '',
                    avatar: profile.photos?.[0].value,
                };
                const result = await jwt_provider_1.jwtProvider.upsertOAuthUser(normalised);
                done(null, result); // result passed to req.user in callback route
            }
            catch (err) {
                logger_1.logger.error('Google OAuth error:', err);
                done(err);
            }
        }));
        logger_1.logger.info('Google OAuth strategy configured');
    }
    else {
        logger_1.logger.warn('Google OAuth not configured — GOOGLE_CLIENT_ID/SECRET missing');
    }
    // ---- GitHub OAuth2 Strategy ----
    if (env_config_1.config.github.clientId && env_config_1.config.github.clientSecret) {
        passport_1.default.use(new passport_github2_1.Strategy({
            clientID: env_config_1.config.github.clientId,
            clientSecret: env_config_1.config.github.clientSecret,
            callbackURL: env_config_1.config.github.callbackUrl,
            scope: ['user:email'],
        }, async (_accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value ?? `${profile.username}@github.com`;
                const names = (profile.displayName || profile.username || '').split(' ');
                const normalised = {
                    provider: 'github',
                    providerId: profile.id,
                    email,
                    firstName: names[0] ?? '',
                    lastName: names[1] ?? '',
                    avatar: profile.photos?.[0]?.value,
                };
                const result = await jwt_provider_1.jwtProvider.upsertOAuthUser(normalised);
                done(null, result);
            }
            catch (err) {
                logger_1.logger.error('GitHub OAuth error:', err);
                done(err);
            }
        }));
        logger_1.logger.info('GitHub OAuth strategy configured');
    }
    else {
        logger_1.logger.warn('GitHub OAuth not configured — GITHUB_CLIENT_ID/SECRET missing');
    }
};
exports.configureOAuth = configureOAuth;
