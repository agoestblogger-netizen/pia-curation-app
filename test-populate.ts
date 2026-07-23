import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './lib/db/index';
import { proposals, auditLogs } from './lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  const p = await db.insert(auditLogs).values({
    action: 'mock',
    actorId: 1,
    actorName: 'mock',
    entity: 'test',
    entityId: '1'
  }).returning();
  console.log("Inserted audit log:", p[0].id);

  const before = await db.execute(sql`SELECT count(*) FROM audit_logs`);
  console.log("Before count:", before);
}
main();
