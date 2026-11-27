import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './database/prisma';
import { releaseExpiredHolds } from './services/availability.service';

async function main() {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.PORT, () => console.log(`Train Ticket Booking API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`));
  const timer = setInterval(() => { releaseExpiredHolds().catch((e) => console.error('[holds]', e)); }, 60_000); // free seats of unpaid bookings
  const stop = async (sig: string) => { console.log(`${sig} received, shutting down`); clearInterval(timer); server.close(async () => { await disconnectDatabase(); process.exit(0); }); setTimeout(() => process.exit(1), 10_000).unref(); };
  process.on('SIGTERM', () => void stop('SIGTERM')); process.on('SIGINT', () => void stop('SIGINT'));
}
main().catch((e) => { console.error('Failed to start:', e); process.exit(1); });
