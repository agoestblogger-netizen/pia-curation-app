import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ── Startup Validation ────────────────────────────────────────────────────────
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    '[DB] DATABASE_URL tidak di-set.\n' +
    'Tambahkan DATABASE_URL ke .env.local:\n' +
    'DATABASE_URL=postgresql://postgres:[password]@[host].supabase.co:5432/postgres'
  );
}

if (
  url.startsWith('file:') ||
  url.endsWith('.db') ||
  url.includes('.sqlite') ||
  url.startsWith('./')
) {
  throw new Error(
    '[DB] DATABASE_URL masih menunjuk ke SQLite!\n' +
    'Ganti dengan PostgreSQL connection string dari Supabase.\n' +
    `Current value: ${url}`
  );
}

if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
  throw new Error(
    '[DB] DATABASE_URL harus berupa PostgreSQL connection string.\n' +
    'Format: postgresql://user:password@host:5432/dbname\n' +
    `Current value starts with: ${url.substring(0, 20)}...`
  );
}

// ── Connection ────────────────────────────────────────────────────────────────
// postgres-js handles connection pooling automatically.
// In serverless environments, use max:1 to avoid connection exhaustion.
const isProduction = process.env.NODE_ENV === 'production';

const client = postgres(url, {
  max: isProduction ? 1 : 10,     // Serverless: 1 | Dev: pool of 10
  idle_timeout: 20,               // Close idle connections after 20s
  connect_timeout: 10,            // Fail fast if cannot connect in 10s
  ssl: url.includes('supabase.co') ? 'require' : undefined,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
