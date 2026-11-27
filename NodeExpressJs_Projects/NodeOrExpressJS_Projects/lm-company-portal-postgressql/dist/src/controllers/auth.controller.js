"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const auth_factory_1 = require("../auth/auth.factory");
const response_helper_1 = require("../utils/response.helper");
const exceptions_1 = require("../exceptions");
exports.authController = {
    async register(req, res, next) {
        try {
            const result = await auth_factory_1.authProvider.register(req.body);
            (0, response_helper_1.sendCreated)(res, result, 'User registered successfully');
        }
        catch (err) {
            next(err);
        }
    },
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await auth_factory_1.authProvider.login(email, password);
            (0, response_helper_1.sendSuccess)(res, result, 'Login successful');
        }
        catch (err) {
            next(err);
        }
    },
    async logout(req, res, next) {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (token)
                await auth_factory_1.authProvider.logout(token);
            (0, response_helper_1.sendSuccess)(res, null, 'Logged out successfully');
        }
        catch (err) {
            next(err);
        }
    },
    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;
            const result = await auth_factory_1.authProvider.refreshTokens(refreshToken);
            (0, response_helper_1.sendSuccess)(res, result, 'Token refreshed');
        }
        catch (err) {
            next(err);
        }
    },
    async forgotPassword(req, res, next) {
        try {
            const token = await auth_factory_1.authProvider.forgotPassword(req.body.email);
            // In production: send email. For demo, return token.
            (0, response_helper_1.sendSuccess)(res, { resetToken: token }, 'Password reset instructions sent');
        }
        catch (err) {
            next(err);
        }
    },
    async resetPassword(req, res, next) {
        try {
            await auth_factory_1.authProvider.resetPassword(req.body.token, req.body.newPassword);
            (0, response_helper_1.sendSuccess)(res, null, 'Password reset successfully');
        }
        catch (err) {
            next(err);
        }
    },
    async changePassword(req, res, next) {
        try {
            if (!req.user)
                throw new exceptions_1.UnauthorizedError();
            await auth_factory_1.authProvider.changePassword(req.user.userId, req.body.currentPassword, req.body.newPassword);
            (0, response_helper_1.sendSuccess)(res, null, 'Password changed successfully');
        }
        catch (err) {
            next(err);
        }
    },
    // OAuth callback — Passport sets req.user to the result from the strategy
    oauthCallback(req, res) {
        const result = req.user;
        // Redirect to frontend with tokens (or send JSON for API clients)
        res.json({ success: true, data: result });
    },
};
