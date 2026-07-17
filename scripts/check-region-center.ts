import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const result = await db.execute(sql`
    SELECT DISTINCT region_center, COUNT(*) 
    FROM proposals 
    WHERE category = 'WILAYAH' 
    GROUP BY region_center 
    ORDER BY region_center
  `);
  console.log(result);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
