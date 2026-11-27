const svc = require('../services/authService');
const audit = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

const reg = require('../services/registrationService');
const { created } = require('../utils/response');

module.exports = {
  register: asyncHandler(async (req, res) => {
    const data = await reg.register(req.body, req.file);
    await audit.log({ ...req, user: { id: data.id } }, 'USER_REGISTER', 'user', data.id, { employeeCode: data.employeeCode, hasPicture: !!req.file });
    created(res, data, 'Registration successful. You can now sign in.');
  }),
  registrationOptions: asyncHandler(async (req, res) => ok(res, await reg.options(), 'Registration options retrieved')),
  usernameAvailable: asyncHandler(async (req, res) => ok(res, { available: !(await reg.usernameTaken(req.query.username)) }, 'Username checked')),
  login: asyncHandler(async (req, res) => {
    const data = await svc.login({ email: req.body.email, username: req.body.username }, req.body.password);
    await audit.log({ ...req, user: { id: data.user.id } }, 'LOGIN', 'user', data.user.id);
    ok(res, data, 'Login successful');
  }),
  refresh: asyncHandler(async (req, res) => ok(res, await svc.refresh(req.body.refreshToken), 'Token refreshed')),
  logout: asyncHandler(async (req, res) => { await svc.logout(req.body.refreshToken); ok(res, null, 'Logged out'); }),
  logoutAll: asyncHandler(async (req, res) => { await svc.logoutAll(req.user.id); ok(res, null, 'All sessions revoked'); }),
  me: asyncHandler(async (req, res) => ok(res, await svc.me(req.user), 'Current user retrieved')),
  forgot: asyncHandler(async (req, res) => {
    const r = await svc.forgotPassword(req.body.email);
    ok(res, r.resetToken ? { resetToken: r.resetToken } : null, r.message);
  }),
  reset: asyncHandler(async (req, res) => {
    await svc.resetPassword(req.body.token, req.body.newPassword);
    ok(res, null, 'Password has been reset');
  }),
  change: asyncHandler(async (req, res) => {
    await svc.changePassword(req.user, req.body.currentPassword, req.body.newPassword);
    await audit.log(req, 'PASSWORD_CHANGE', 'user', req.user.id);
    ok(res, null, 'Password changed; please log in again');
  }),
};
