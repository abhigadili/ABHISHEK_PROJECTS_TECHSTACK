import { PrismaClient, Prisma } from '@prisma/client';
import { env } from '../config/env';
/** One PrismaClient (and its connection pool) per process. */
export const prisma = new PrismaClient({ log: env.isProd ? ['error'] : ['warn', 'error'] });
export type Tx = Prisma.TransactionClient;
export { Prisma };
export async function connectDatabase() { await prisma.$connect(); await prisma.$queryRaw`SELECT 1`; }
export async function disconnectDatabase() { await prisma.$disconnect(); }
