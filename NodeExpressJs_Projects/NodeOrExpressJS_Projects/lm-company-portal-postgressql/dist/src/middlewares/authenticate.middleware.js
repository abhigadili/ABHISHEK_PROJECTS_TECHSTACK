"use strict";
// ============================================================
// WHAT: Authentication middleware — verifies the JWT access token
// WHY:  Every protected route must verify the caller's identity
//       before reaching the controller.
// HOW:  1. Extract Bearer token from Authorization header
//        2. Check blocklist (logout invalidation)
//        3. Verify signature and expiry
//        4. Attach decoded payload to req.user
//        5. Call next() so the request continues to the route handler
// Interview Tip: Middleware is the Express pattern for cross-cutting
//               concerns. It runs between the request and the route handler.
//               Order matters — authenticate BEFORE authorize.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthenticate = exports.authenticate = void 0;
const jwt_helper_1 = require("../utils/jwt.helper");
const redis_client_1 = require("../cache/redis.client");
const exceptions_1 = require("../exceptions");
const authenticate = async (req, _res, next) => {
    try {
        // Extract token from: Authorization: Bearer <token>
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new exceptions_1.UnauthorizedError('No token provided. Include "Authorization: Bearer <token>".');
        }
        const token = authHeader.split(' ')[1];
        // Check if token was blocklisted (user logged out)
        // WHY: JWTs are stateless — blocklisting is the only way to invalidate
        //      before their natural expiry.
        const blocked = await (0, redis_client_1.isTokenBlocklisted)(token);
        if (blocked)
            throw new exceptions_1.UnauthorizedError('Token has been revoked. Please login again.');
        // Verify signature + expiry. Throws UnauthorizedError on failure.
        const payload = (0, jwt_helper_1.verifyAccessToken)(token);
        // Attach user context to the request object
        // All downstream middleware and controllers can read req.user
        req.user = payload;
        next();
    }
    catch (err) {
        next(err); // pass to global error handler
    }
};
exports.authenticate = authenticate;
// Optional auth — doesn't throw if no token, but populates req.user if present
const optionalAuthenticate = async (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            req.user = (0, jwt_helper_1.verifyAccessToken)(token);
        }
        catch {
            // Ignore errors — treat as unauthenticated
        }
    }
    next();
};
exports.optionalAuthenticate = optionalAuthenticate;
