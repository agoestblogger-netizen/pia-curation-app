require('dotenv').config({ path: '.env.local' });
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function run() {
  await sql`UPDATE competitions SET name = 'Pegadaian Innovation Award 2026' WHERE name = 'Pelindo Innovation Award 2026'`;
  console.log("DB updated!");
  process.exit(0);
}
run();
