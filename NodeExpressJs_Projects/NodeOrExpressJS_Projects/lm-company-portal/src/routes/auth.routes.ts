import { Router, RequestHandler } from 'express';
import passport from 'passport';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  registerSchema, loginSchema, forgotPasswordSchema,
  resetPasswordSchema, changePasswordSchema, refreshTokenSchema,
} from '../validators/auth.validator';
import { config } from '../config/env.config';

const router = Router();

const isOAuth = config.auth.enableOAuth2 || config.auth.provider === 'oauth2';
const isJwt   = !isOAuth || config.auth.provider === 'jwt';

if (isJwt) {
  router.post('/register',        validate(registerSchema) as RequestHandler,       authController.register as RequestHandler);
  router.post('/login',           validate(loginSchema) as RequestHandler,          authController.login as RequestHandler);
  router.post('/forgot-password', validate(forgotPasswordSchema) as RequestHandler, authController.forgotPassword as RequestHandler);
  router.post('/reset-password',  validate(resetPasswordSchema) as RequestHandler,  authController.resetPassword as RequestHandler);
  router.post('/refresh-token',   validate(refreshTokenSchema) as RequestHandler,   authController.refreshToken as RequestHandler);
  router.post('/change-password',
    authenticate as RequestHandler,
    validate(changePasswordSchema) as RequestHandler,
    authController.changePassword as RequestHandler
  );
}

if (isOAuth) {
  router.get('/google', passport.authenticate('google', { session: false, scope: ['profile', 'email'] }));
  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login-failed' }),
    authController.oauthCallback as RequestHandler
  );
  router.get('/github', passport.authenticate('github', { session: false, scope: ['user:email'] }));
  router.get('/github/callback',
    passport.authenticate('github', { session: false, failureRedirect: '/login-failed' }),
    authController.oauthCallback as RequestHandler
  );
}

router.post('/logout', authenticate as RequestHandler, authController.logout as RequestHandler);

export default router;
