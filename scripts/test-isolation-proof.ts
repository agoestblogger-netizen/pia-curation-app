import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const devUrl = process.env.DEV_DATABASE_URL;
const prodUrl = process.env.DATABASE_URL;

async function testIsolation() {
  if (!devUrl || !prodUrl) {
    console.error('Missing URLs');
    process.exit(1);
  }

  const sqlDev = postgres(devUrl, { max: 1 });
  const sqlProd = postgres(prodUrl, { max: 1 });

  console.log('🧪 Testing Database Isolation Proof...');

  try {
    const testNote = `DEV_ONLY_TEST_LOG_${Date.now()}`;
    
    // Insert test audit log into Dev DB ONLY
    await sqlDev`
      INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, reason, created_at)
      VALUES (1, 'DEV_TEST_BOT', 'DEV_ISOLATION_TEST', 'test_entity', ${testNote}, ${testNote}, NOW());
    `;
    console.log(`✅ Inserted test log into Supabase Dev DB: "${testNote}"`);

    // Check if test log exists in Dev DB
    const devCheck = await sqlDev`
      SELECT id, reason FROM audit_logs WHERE reason = ${testNote};
    `;
    console.log(`📊 Dev DB Query Result: Found ${devCheck.length} record(s).`);

    // Check if test log exists in Prod DB (MUST BE ZERO!)
    const prodCheck = await sqlProd`
      SELECT id, reason FROM audit_logs WHERE reason = ${testNote};
    `;
    console.log(`🔒 Production DB Query Result: Found ${prodCheck.length} record(s) in Production.`);

    if (devCheck.length === 1 && prodCheck.length === 0) {
      console.log('\n🎉 PROOF VERIFIED 100%: Changes in Dev/Preview DB do NOT affect Production DB at all!');
    } else {
      console.error('❌ WARNING: Isolation test failed!');
    }
  } finally {
    await sqlDev.end();
    await sqlProd.end();
  }
}

testIsolation();
