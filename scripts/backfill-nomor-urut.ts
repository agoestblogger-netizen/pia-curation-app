import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function backfill() {
  console.log('Starting backfill for nomor_urut...');
  
  await db.execute(sql`
    UPDATE proposals p
    SET nomor_urut = sub.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY category, region_center ORDER BY id ASC) as rn
      FROM proposals
    ) sub
    WHERE p.id = sub.id;
  `);

  console.log('Backfill complete!');
  process.exit(0);
}

backfill().catch(err => {
  console.error(err);
  process.exit(1);
});
