"use strict";
// ============================================================
// WHAT: JWT authentication provider
// WHY:  Encapsulates all JWT-based auth logic in one place.
//       The auth factory selects this provider when AUTH_PROVIDER=jwt.
// When to use JWT: APIs consumed by SPAs, mobile apps, microservices.
// When NOT to use JWT: when you need server-side session control,
//                     instant token revocation without a blocklist.
// Interview Tip: JWT is not a session. It's a signed, self-contained claim.
//               The difference matters for logout and revocation design.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtProvider = void 0;
const connection_1 = require("../../database/connection");
const jwt_helper_1 = require("../../utils/jwt.helper");
const redis_client_1 = require("../../cache/redis.client");
const constants_1 = require("../../constants");
const exceptions_1 = require("../../exceptions");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
exports.jwtProvider = {
    async register(data) {
        const existing = await (0, connection_1.query)('SELECT id FROM users WHERE email=$1', [data.email.toLowerCase()]);
        if (existing.length > 0)
            throw new exceptions_1.ConflictError('Email already registered');
        const hashedPassword = await bcryptjs_1.default.hash(data.password, 12);
        const rows = await (0, connection_1.query)(`
      INSERT INTO users (first_name, last_name, email, password, role, provider)
      VALUES ($1, $2, $3, $4, $5, 'local') RETURNING id, email, role
    `, [data.firstName, data.lastName, data.email.toLowerCase(), hashedPassword, data.role ?? 'Employee']);
        return { userId: rows[0].id, email: rows[0].email, role: rows[0].role };
    },
    async login(email, password) {
        const rows = await (0, connection_1.query)('SELECT * FROM users WHERE email=$1 AND is_active=TRUE', [email.toLowerCase()]);
        const user = rows[0];
        if (!user || !user.password)
            throw new exceptions_1.UnauthorizedError('Invalid email or password');
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            throw new exceptions_1.UnauthorizedError('Invalid email or password');
        const permissions = constants_1.ROLE_PERMISSIONS[user.role] ?? [];
        const accessToken = (0, jwt_helper_1.signAccessToken)({ userId: user.id, email: user.email, role: user.role, permissions });
        const refreshToken = (0, jwt_helper_1.signRefreshToken)(user.id);
        return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
    },
    async refreshTokens(token) {
        const { userId } = (0, jwt_helper_1.verifyRefreshToken)(token);
        const rows = await (0, connection_1.query)('SELECT * FROM users WHERE id=$1 AND is_active=TRUE', [userId]);
        if (!rows[0])
            throw new exceptions_1.UnauthorizedError('User not found or inactive');
        const user = rows[0];
        const permissions = constants_1.ROLE_PERMISSIONS[user.role] ?? [];
        const accessToken = (0, jwt_helper_1.signAccessToken)({ userId: user.id, email: user.email, role: user.role, permissions });
        const refreshToken = (0, jwt_helper_1.signRefreshToken)(user.id);
        return { accessToken, refreshToken };
    },
    async logout(accessToken) {
        const ttl = (0, jwt_helper_1.getTokenTTL)(accessToken);
        if (ttl > 0)
            await (0, redis_client_1.blocklistToken)(accessToken, ttl);
    },
    async forgotPassword(email) {
        const rows = await (0, connection_1.query)('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
        if (!rows[0])
            return;
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const hashed = crypto_1.default.createHash('sha256').update(token).digest('hex');
        const expires = new Date(Date.now() + 10 * 60 * 1000);
        await (0, connection_1.query)(`UPDATE users SET password_reset_token=$1, password_reset_expires=$2 WHERE id=$3`, [hashed, expires, rows[0].id]);
        return token;
    },
    async resetPassword(token, newPassword) {
        const hashed = crypto_1.default.createHash('sha256').update(token).digest('hex');
        const rows = await (0, connection_1.query)(`
      SELECT id FROM users
      WHERE password_reset_token=$1 AND password_reset_expires > NOW()
    `, [hashed]);
        if (!rows[0])
            throw new exceptions_1.UnauthorizedError('Token is invalid or has expired');
        const hashedPwd = await bcryptjs_1.default.hash(newPassword, 12);
        await (0, connection_1.query)(`
      UPDATE users SET password=$1, password_reset_token=NULL, password_reset_expires=NULL, updated_at=NOW()
      WHERE id=$2
    `, [hashedPwd, rows[0].id]);
    },
    async changePassword(userId, currentPassword, newPassword) {
        const rows = await (0, connection_1.query)('SELECT id, password FROM users WHERE id=$1', [userId]);
        if (!rows[0])
            throw new exceptions_1.NotFoundError('User');
        const valid = await bcryptjs_1.default.compare(currentPassword, rows[0].password ?? '');
        if (!valid)
            throw new exceptions_1.UnauthorizedError('Current password is incorrect');
        const hashed = await bcryptjs_1.default.hash(newPassword, 12);
        await (0, connection_1.query)('UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2', [hashed, userId]);
    },
    async upsertOAuthUser(profile) {
        let rows = await (0, connection_1.query)('SELECT * FROM users WHERE email=$1', [profile.email.toLowerCase()]);
        let user = rows[0];
        if (!user) {
            const inserted = await (0, connection_1.query)(`
        INSERT INTO users (first_name, last_name, email, provider, provider_id, avatar)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [profile.firstName, profile.lastName, profile.email.toLowerCase(),
                profile.provider, profile.providerId, profile.avatar ?? null]);
            user = inserted[0];
        }
        const permissions = constants_1.ROLE_PERMISSIONS[user.role] ?? [];
        const accessToken = (0, jwt_helper_1.signAccessToken)({ userId: user.id, email: user.email, role: user.role, permissions });
        const refreshToken = (0, jwt_helper_1.signRefreshToken)(user.id);
        return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
    },
};
