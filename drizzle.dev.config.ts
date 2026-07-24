import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const devUrl = process.env.DEV_DATABASE_URL;

if (!devUrl) {
  throw new Error('❌ DEV_DATABASE_URL is required in .env.local for drizzle-kit push.\nPlease add DEV_DATABASE_URL to .env.local first.');
}

if (process.env.DATABASE_URL && devUrl === process.env.DATABASE_URL) {
  throw new Error('❌ SAFETY FAILURE: DEV_DATABASE_URL is identical to DATABASE_URL (production)! Aborting.');
}

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: devUrl,
  },
} satisfies Config;
