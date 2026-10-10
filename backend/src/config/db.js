import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  mongoose.connection.on('connected', () => {
    logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  if (env.mongoDnsServers.length) {
    dns.setServers(env.mongoDnsServers);
  }

  await mongoose.connect(env.mongoUri, {
    autoIndex: !env.isProd()
  });

  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
