import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { resetDataAction } from './app/actions/reset-data';
import { sql } from 'drizzle-orm';

jest.mock('./lib/auth/helpers', () => ({
  requireRole: async () => ({ userId: 1, name: 'Admin' })
}));

async function main() {
  // Let's call the action manually by overriding the internal requireRole
  // But wait, it's compiled so jest.mock won't work easily here with tsx.
}
