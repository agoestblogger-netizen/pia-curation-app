import { db } from '../lib/db';
import { competitions } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  await db.update(competitions).set({ name: 'Pegadaian Innovation Award 2026' }).where(eq(competitions.name, 'Pelindo Innovation Award 2026'));
  console.log("DB updated!");
}
run();
