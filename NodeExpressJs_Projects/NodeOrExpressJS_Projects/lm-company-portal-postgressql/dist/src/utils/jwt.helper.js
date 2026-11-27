"use strict";
// ============================================================
// WHAT: JWT utility — sign, verify, decode tokens
// WHY:  JSON Web Tokens allow stateless authentication.
//       The server doesn't need to store sessions; the token
//       itself carries the user identity and is cryptographically signed.
// HOW:  Access token (short-lived, 15m) is sent with every API request.
//       Refresh token (long-lived, 7d) is used ONLY to get a new access token.
//       Both are signed with different secrets so a compromised refresh
//       secret doesn't automatically compromise access tokens.
// Bearer Token: client sends "Authorization: Bearer <access_token>"
// Interview Tip: JWT header.payload is base64, NOT encrypted.
//               Don't put sensitive data in the payload.
// When to use JWT: stateless APIs, microservices, mobile apps.
// When NOT to use: when you need instant revocation (use sessions instead).
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenTTL = exports.decodeToken = exports.verifyRefreshToken = exports.verifyAccessToken = exports.signRefreshToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_config_1 = require("../config/env.config");
const exceptions_1 = require("../exceptions");
// Sign an access token (short-lived)
const signAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, env_config_1.config.jwt.secret, {
        expiresIn: env_config_1.config.jwt.expiresIn,
        algorithm: 'HS256',
    });
};
exports.signAccessToken = signAccessToken;
// Sign a refresh token (long-lived, stored in DB)
const signRefreshToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, env_config_1.config.jwt.refreshSecret, {
        expiresIn: env_config_1.config.jwt.refreshExpiresIn,
    });
};
exports.signRefreshToken = signRefreshToken;
// Verify and decode an access token — throws if invalid or expired
const verifyAccessToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, env_config_1.config.jwt.secret);
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new exceptions_1.UnauthorizedError('Access token expired. Please refresh.');
        }
        throw new exceptions_1.UnauthorizedError('Invalid access token.');
    }
};
exports.verifyAccessToken = verifyAccessToken;
// Verify refresh token
const verifyRefreshToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, env_config_1.config.jwt.refreshSecret);
    }
    catch {
        throw new exceptions_1.UnauthorizedError('Invalid or expired refresh token. Please login again.');
    }
};
exports.verifyRefreshToken = verifyRefreshToken;
// Decode without verification (useful for reading expiry without throwing)
const decodeToken = (token) => {
    return jsonwebtoken_1.default.decode(token);
};
exports.decodeToken = decodeToken;
// Calculate remaining TTL in seconds (for Redis blocklist)
const getTokenTTL = (token) => {
    const decoded = (0, exports.decodeToken)(token);
    if (!decoded?.exp)
        return 0;
    return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
};
exports.getTokenTTL = getTokenTTL;
