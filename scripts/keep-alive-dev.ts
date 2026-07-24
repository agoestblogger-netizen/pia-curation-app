import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const devUrl = process.env.DEV_DATABASE_URL;

if (!devUrl) {
  console.error('❌ DEV_DATABASE_URL is missing in .env.local');
  process.exit(1);
}

async function pingDev() {
  console.log('⏰ Executing Supabase Dev Keep-Alive Ping...');
  const sqlDev = postgres(devUrl!, { max: 1 });
  try {
    const startTime = Date.now();
    const result = await sqlDev`SELECT 1 as ping;`;
    const duration = Date.now() - startTime;
    console.log(`✅ Supabase Dev is ACTIVE (Ping duration: ${duration}ms, result: ${result[0].ping})`);
  } catch (err) {
    console.error('❌ Supabase Dev Keep-Alive Ping Failed:', err);
  } finally {
    await sqlDev.end();
  }
}

pingDev();
