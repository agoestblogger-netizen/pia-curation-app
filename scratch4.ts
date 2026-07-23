import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const result = await db.execute(sql`
    SELECT 
      p.category, 
      p.region_center,
      COUNT(DISTINCT p.id) as total,
      COUNT(DISTINCT CASE WHEN ca.status = 'completed' THEN p.id ELSE NULL END) as curated
    FROM proposals p
    LEFT JOIN curator_assignments ca ON p.id = ca.proposal_id
    WHERE p.competition_id = 1
    GROUP BY p.category, p.region_center
  `);
  console.log(result);
  console.log("Is array?", Array.isArray(result));
}
main().catch(console.error).then(() => process.exit(0));
