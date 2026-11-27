"use strict";
// ============================================================
// WHAT: Assigns a unique ID to every incoming request
// WHY:  In production, thousands of requests are interleaved in logs.
//       A request ID lets you correlate all log lines for one request.
//       Also useful for distributed tracing across microservices.
// HOW:  Uses uuid v4 (universally unique). The ID is added to the
//       response header so clients can include it in bug reports.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = void 0;
const uuid_1 = require("uuid");
const requestIdMiddleware = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    req.requestId = requestId;
    // Echo the ID back so the client can reference it for support
    res.setHeader('x-request-id', requestId);
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
