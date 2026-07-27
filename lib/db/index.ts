import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ── Startup Validation ────────────────────────────────────────────────────────
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING;

const isBuildPhase = process.env.npm_lifecycle_event === 'build' || process.env.NEXT_PHASE === 'phase-production-build' || (process.env.VERCEL_ENV === 'preview' && !url);

if (!url) {
  if (isBuildPhase) {
    console.warn(
      '[DB] WARNING: DATABASE_URL / POSTGRES_URL tidak di-set saat proses build/preview. Akan diabaikan sementara.'
    );
  } else {
    throw new Error(
      '[DB] DATABASE_URL / POSTGRES_URL tidak di-set.\n' +
      'Tambahkan DATABASE_URL atau POSTGRES_URL ke .env.local:\n' +
      'DATABASE_URL=postgresql://postgres:[password]@[host].supabase.co:5432/postgres'
    );
  }
}

if (
  url && (
    url.startsWith('file:') ||
    url.endsWith('.db') ||
    url.includes('.sqlite') ||
    url.startsWith('./')
  )
) {
  throw new Error(
    '[DB] DATABASE_URL masih menunjuk ke SQLite!\n' +
    'Ganti dengan PostgreSQL connection string dari Supabase.\n' +
    `Current value: ${url}`
  );
}

if (url && !url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
  throw new Error(
    '[DB] DATABASE_URL harus berupa PostgreSQL connection string.\n' +
    'Format: postgresql://user:password@host:5432/dbname\n' +
    `Current value starts with: ${url.substring(0, 20)}...`
  );
}

// ── Connection ────────────────────────────────────────────────────────────────
// postgres-js handles connection pooling automatically.
// In serverless environments, use max:5 to avoid connection exhaustion.
// MUST set prepare: false when using Supabase pgBouncer Transaction Pooler (port 6543)
const safeUrl = url || 'postgres://postgres:postgres@localhost:5432/postgres';

const client = postgres(safeUrl, {
  max: 10,                        // Serverless & Dev pool
  idle_timeout: 20,               // Close idle connections after 20s
  connect_timeout: 10,            // Fail fast if cannot connect in 10s
  ssl: safeUrl.includes('supabase') ? 'require' : undefined,
  prepare: false,                 // CRITICAL: Disable prepared statements for Supabase pgBouncer Transaction Pooler
});

export const db = drizzle(client, { schema });
export type Db = typeof db;

