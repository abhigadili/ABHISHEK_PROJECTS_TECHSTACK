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

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from '../config/env.config';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Human-readable format for development console output
const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, requestId }) => {
    const rid = requestId ? ` [${requestId}]` : '';
    return `${timestamp}${rid} [${level}]: ${stack || message}`;
  })
);

// JSON format for production — machine-parseable by log aggregators
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

// Rotate log files daily, keep 30 days
const fileTransport = (filename: string, level: string) =>
  new DailyRotateFile({
    filename: path.join('logs', `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    level,
    format: prodFormat,
  });

export const logger = winston.createLogger({
  level: config.logLevel,
  format: config.isDev ? devFormat : prodFormat,
  transports: [
    new winston.transports.Console(),
    fileTransport('app', 'info'),       // logs/app-YYYY-MM-DD.log
    fileTransport('error', 'error'),    // logs/error-YYYY-MM-DD.log
  ],
  // Don't crash on unhandled exceptions — log them instead
  exceptionHandlers: [fileTransport('exceptions', 'error')],
  rejectionHandlers: [fileTransport('rejections', 'error')],
});

// Morgan stream — redirects HTTP logs into Winston
export const morganStream = {
  write: (message: string) => logger.http(message.trim()),
};
