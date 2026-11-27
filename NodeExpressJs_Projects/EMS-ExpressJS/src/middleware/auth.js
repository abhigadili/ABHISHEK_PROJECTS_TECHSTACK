const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const userRepo = require('../repositories/userRepository');
const { ADMINS } = require('../constants');

/** Verifies the Bearer access token and loads the live account (so deactivation takes effect immediately). */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, authConfig.accessSecret(), { algorithms: ['HS256'] });
  } catch (e) {
    throw ApiError.unauthorized(e.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token', 'INVALID_TOKEN');
  }
  const user = await userRepo.findAuthContext(payload.sub);
  if (!user || !user.is_active) throw ApiError.unauthorized('Account is disabled or no longer exists', 'ACCOUNT_DISABLED');
  req.user = { id: user.id, employeeId: user.employee_id, role: user.role, email: user.email };
  next();
});

/** Role gate. Usage: authorize(ROLES.HR_ADMIN, ROLES.SUPER_ADMIN) or authorize(ADMINS). */
const authorize = (...roles) => {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowed.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
};

const isAdmin = (user) => ADMINS.includes(user.role);

module.exports = { authenticate, authorize, isAdmin };
