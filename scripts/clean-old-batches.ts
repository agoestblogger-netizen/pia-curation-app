import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '../lib/db';
import { curationBatches, curatorAssignments, curatorQuotaConfigs, assignmentHistory } from '../lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const oldBatches = await db.select().from(curationBatches).where(inArray(curationBatches.assignmentMode, ['manual_quota', 'equal', 'weighted', 'hybrid', 'category_based']));
  
  if (oldBatches.length > 0) {
    const ids = oldBatches.map(b => b.id);
    console.log('Deleting old batches:', ids);
    
    // delete dependencies
    await db.delete(assignmentHistory).where(inArray(assignmentHistory.assignmentId, db.select({ id: curatorAssignments.id }).from(curatorAssignments).where(inArray(curatorAssignments.batchId, ids))));
    await db.delete(curatorAssignments).where(inArray(curatorAssignments.batchId, ids));
    await db.delete(curatorQuotaConfigs).where(inArray(curatorQuotaConfigs.batchId, ids));
    
    // delete batches
    await db.delete(curationBatches).where(inArray(curationBatches.id, ids));
    console.log('Deleted successfully.');
  } else {
    console.log('No old batches found.');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
