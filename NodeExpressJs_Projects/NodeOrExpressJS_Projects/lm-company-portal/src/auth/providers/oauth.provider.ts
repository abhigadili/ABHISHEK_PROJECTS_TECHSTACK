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

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { config } from '../../config/env.config';
import { jwtProvider } from './jwt.provider';
import { logger } from '../../utils/logger';
import { OAuthProfile } from '../../types';

export const configureOAuth = (): void => {
  // ---- Google OAuth2 Strategy ----
  if (config.google.clientId && config.google.clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.google.clientId,
          clientSecret: config.google.clientSecret,
          callbackURL: config.google.callbackUrl,
          scope: ['profile', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const normalised: OAuthProfile = {
              provider: 'google',
              providerId: profile.id,
              email: profile.emails?.[0].value ?? '',
              firstName: profile.name?.givenName ?? '',
              lastName: profile.name?.familyName ?? '',
              avatar: profile.photos?.[0].value,
            };
            const result = await jwtProvider.upsertOAuthUser(normalised);
            done(null, result as any); // result passed to req.user in callback route
          } catch (err) {
            logger.error('Google OAuth error:', err);
            done(err as Error);
          }
        }
      )
    );
    logger.info('Google OAuth strategy configured');
  } else {
    logger.warn('Google OAuth not configured — GOOGLE_CLIENT_ID/SECRET missing');
  }

  // ---- GitHub OAuth2 Strategy ----
  if (config.github.clientId && config.github.clientSecret) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: config.github.clientId,
          clientSecret: config.github.clientSecret,
          callbackURL: config.github.callbackUrl,
          scope: ['user:email'],
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: Function) => {
          try {
            const email = profile.emails?.[0]?.value ?? `${profile.username}@github.com`;
            const names = (profile.displayName || profile.username || '').split(' ');
            const normalised: OAuthProfile = {
              provider: 'github',
              providerId: profile.id,
              email,
              firstName: names[0] ?? '',
              lastName: names[1] ?? '',
              avatar: profile.photos?.[0]?.value,
            };
            const result = await jwtProvider.upsertOAuthUser(normalised);
            done(null, result as any);
          } catch (err) {
            logger.error('GitHub OAuth error:', err);
            done(err);
          }
        }
      )
    );
    logger.info('GitHub OAuth strategy configured');
  } else {
    logger.warn('GitHub OAuth not configured — GITHUB_CLIENT_ID/SECRET missing');
  }
};
