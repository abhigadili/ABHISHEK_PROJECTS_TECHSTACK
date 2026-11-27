"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const auth_controller_1 = require("../controllers/auth.controller");
const authenticate_middleware_1 = require("../middlewares/authenticate.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_validator_1 = require("../validators/auth.validator");
const env_config_1 = require("../config/env.config");
const router = (0, express_1.Router)();
const isOAuth = env_config_1.config.auth.enableOAuth2 || env_config_1.config.auth.provider === 'oauth2';
const isJwt = !isOAuth || env_config_1.config.auth.provider === 'jwt';
if (isJwt) {
    router.post('/register', (0, validate_middleware_1.validate)(auth_validator_1.registerSchema), auth_controller_1.authController.register);
    router.post('/login', (0, validate_middleware_1.validate)(auth_validator_1.loginSchema), auth_controller_1.authController.login);
    router.post('/forgot-password', (0, validate_middleware_1.validate)(auth_validator_1.forgotPasswordSchema), auth_controller_1.authController.forgotPassword);
    router.post('/reset-password', (0, validate_middleware_1.validate)(auth_validator_1.resetPasswordSchema), auth_controller_1.authController.resetPassword);
    router.post('/refresh-token', (0, validate_middleware_1.validate)(auth_validator_1.refreshTokenSchema), auth_controller_1.authController.refreshToken);
    router.post('/change-password', authenticate_middleware_1.authenticate, (0, validate_middleware_1.validate)(auth_validator_1.changePasswordSchema), auth_controller_1.authController.changePassword);
}
if (isOAuth) {
    router.get('/google', passport_1.default.authenticate('google', { session: false, scope: ['profile', 'email'] }));
    router.get('/google/callback', passport_1.default.authenticate('google', { session: false, failureRedirect: '/login-failed' }), auth_controller_1.authController.oauthCallback);
    router.get('/github', passport_1.default.authenticate('github', { session: false, scope: ['user:email'] }));
    router.get('/github/callback', passport_1.default.authenticate('github', { session: false, failureRedirect: '/login-failed' }), auth_controller_1.authController.oauthCallback);
}
router.post('/logout', authenticate_middleware_1.authenticate, auth_controller_1.authController.logout);
exports.default = router;
