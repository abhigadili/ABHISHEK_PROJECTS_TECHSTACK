import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { authProvider } from '../auth/auth.factory';
import { sendSuccess, sendCreated } from '../utils/response.helper';
import { UnauthorizedError } from '../exceptions';

export const authController = {

  async register(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await authProvider.register(req.body);
      sendCreated(res, result, 'User registered successfully');
    } catch (err) { next(err); }
  },

  async login(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authProvider.login(email, password);
      sendSuccess(res, result, 'Login successful');
    } catch (err) { next(err); }
  },

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) await authProvider.logout(token);
      sendSuccess(res, null, 'Logged out successfully');
    } catch (err) { next(err); }
  },

  async refreshToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await authProvider.refreshTokens(refreshToken);
      sendSuccess(res, result, 'Token refreshed');
    } catch (err) { next(err); }
  },

  async forgotPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const token = await authProvider.forgotPassword(req.body.email);
      // In production: send email. For demo, return token.
      sendSuccess(res, { resetToken: token }, 'Password reset instructions sent');
    } catch (err) { next(err); }
  },

  async resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await authProvider.resetPassword(req.body.token, req.body.newPassword);
      sendSuccess(res, null, 'Password reset successfully');
    } catch (err) { next(err); }
  },

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      await authProvider.changePassword(req.user.userId, req.body.currentPassword, req.body.newPassword);
      sendSuccess(res, null, 'Password changed successfully');
    } catch (err) { next(err); }
  },

  // OAuth callback — Passport sets req.user to the result from the strategy
  oauthCallback(req: AuthRequest, res: Response) {
    const result = req.user as any;
    // Redirect to frontend with tokens (or send JSON for API clients)
    res.json({ success: true, data: result });
  },
};
