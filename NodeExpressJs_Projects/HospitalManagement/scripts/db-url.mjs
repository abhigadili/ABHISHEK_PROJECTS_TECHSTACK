// prints the Prisma DATABASE_URL for a database name (password only from the environment)
import { databaseUrl } from '../shared/config/index.js';
process.stdout.write(databaseUrl(process.argv[2]));
