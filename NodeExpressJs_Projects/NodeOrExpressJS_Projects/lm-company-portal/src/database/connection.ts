// ============================================================
// WHAT: MongoDB connection manager using Mongoose
// WHY:  Mongoose provides schema validation, middleware hooks
//       (pre/post save), and a nice query API on top of the
//       native MongoDB driver.
// HOW:  connectDB() is called once at server startup. Mongoose
//       maintains an internal connection pool (default: 5).
// Interview Tip: Connection pooling is why you call connect()
//               once — each request reuses an existing connection
//               rather than opening a new TCP socket.
// Best Practice: Listen to Mongoose events and log them so you
//               know immediately if the DB drops in production.
// ============================================================

import mongoose from 'mongoose';
import { config } from '../config/env.config';
import { logger } from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  try {
    // Mongoose 7+ no longer needs useNewUrlParser / useUnifiedTopology
    const conn = await mongoose.connect(config.mongo.uri, {
      // Pool size: how many simultaneous connections Mongoose keeps open.
      // Performance Consideration: tune based on MongoDB Atlas tier or server RAM.
      maxPoolSize: 10,
    });

    logger.info(`MongoDB connected: ${conn.connection.host} — db: ${conn.connection.name}`);

    // The database is created automatically by MongoDB on the first write.
    // No CREATE DATABASE command needed (unlike SQL databases).
    logger.info('Collections will be created automatically on first document insert.');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    // Exit process — app cannot function without DB
    process.exit(1);
  }

  // Monitor connection health in production
  mongoose.connection.on('disconnected', () =>
    logger.warn('MongoDB disconnected — attempting reconnect...')
  );
  mongoose.connection.on('reconnected', () =>
    logger.info('MongoDB reconnected')
  );
  mongoose.connection.on('error', (err) =>
    logger.error('MongoDB error:', err)
  );
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
};
