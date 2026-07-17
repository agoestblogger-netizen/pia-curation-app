require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  const comps = await sql`SELECT id, name, is_active FROM competitions`;
  console.log("Competitions:");
  console.log(comps);
  process.exit(0);
}
run();
