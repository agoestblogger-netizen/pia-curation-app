require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  await sql`UPDATE competitions SET name = 'Pegadaian Innovation Award' WHERE id = 1`;
  console.log("DB updated!");
  process.exit(0);
}
run();
