"use strict";
// ============================================================
// WHAT: Helpers for sending consistent API responses
// WHY:  A uniform response shape (success, message, data) makes
//       frontend integration predictable and simplifies error handling.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPaginationMeta = exports.sendError = exports.sendCreated = exports.sendSuccess = void 0;
const constants_1 = require("../constants");
const sendSuccess = (res, data, message = 'Success', statusCode = constants_1.HTTP_STATUS.OK, meta) => {
    const body = { success: true, message, data, ...(meta && { meta }) };
    return res.status(statusCode).json(body);
};
exports.sendSuccess = sendSuccess;
const sendCreated = (res, data, message = 'Created successfully') => {
    const body = { success: true, message, data };
    return res.status(constants_1.HTTP_STATUS.CREATED).json(body);
};
exports.sendCreated = sendCreated;
const sendError = (res, message, statusCode = constants_1.HTTP_STATUS.INTERNAL_ERROR, error) => {
    const body = { success: false, message, ...(error && { error }) };
    return res.status(statusCode).json(body);
};
exports.sendError = sendError;
const buildPaginationMeta = (total, page, pageSize) => ({
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
});
exports.buildPaginationMeta = buildPaginationMeta;
