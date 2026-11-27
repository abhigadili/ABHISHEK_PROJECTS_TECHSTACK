"use strict";
// ============================================================
// WHAT: Winston logger — structured application logging
// WHY:  console.log is not production-ready. Winston supports
//       log levels, file rotation, structured JSON output, and
//       can ship logs to external services (Datadog, CloudWatch).
// HOW:  Morgan (HTTP request logger) pipes through Winston so all
//       logs land in the same destination.
// Levels: error > warn > info > http > debug
// Interview Tip: Always log request IDs to correlate logs for a
//               single request across microservices.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.morganStream = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const env_config_1 = require("../config/env.config");
const { combine, timestamp, printf, colorize, errors, json } = winston_1.default.format;
// Human-readable format for development console output
const devFormat = combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), printf(({ timestamp, level, message, stack, requestId }) => {
    const rid = requestId ? ` [${requestId}]` : '';
    return `${timestamp}${rid} [${level}]: ${stack || message}`;
}));
// JSON format for production — machine-parseable by log aggregators
const prodFormat = combine(timestamp(), errors({ stack: true }), json());
// Rotate log files daily, keep 30 days
const fileTransport = (filename, level) => new winston_daily_rotate_file_1.default({
    filename: path_1.default.join('logs', `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    level,
    format: prodFormat,
});
exports.logger = winston_1.default.createLogger({
    level: env_config_1.config.logLevel,
    format: env_config_1.config.isDev ? devFormat : prodFormat,
    transports: [
        new winston_1.default.transports.Console(),
        fileTransport('app', 'info'), // logs/app-YYYY-MM-DD.log
        fileTransport('error', 'error'), // logs/error-YYYY-MM-DD.log
    ],
    // Don't crash on unhandled exceptions — log them instead
    exceptionHandlers: [fileTransport('exceptions', 'error')],
    rejectionHandlers: [fileTransport('rejections', 'error')],
});
// Morgan stream — redirects HTTP logs into Winston
exports.morganStream = {
    write: (message) => exports.logger.http(message.trim()),
};
