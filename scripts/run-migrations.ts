import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error('DATABASE_URL is required');
}

const migrationClient = postgres(dbUrl, { max: 1 });
const db = drizzle(migrationClient);

async function main() {
  console.log('Running migrations...');
  try {
    await migrate(db, { migrationsFolder: './lib/db/migrations' });
    console.log('Migrations complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await migrationClient.end();
  }
}

main();
