import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const prodUrl = process.env.DATABASE_URL;
const devUrl = process.env.DEV_DATABASE_URL;

if (!prodUrl) {
  console.error('❌ ERROR: DATABASE_URL (Production) is missing in .env.local!');
  process.exit(1);
}

if (!devUrl) {
  console.error('❌ ERROR: DEV_DATABASE_URL (Dev) is missing in .env.local!');
  process.exit(1);
}

if (prodUrl === devUrl) {
  console.error('❌ CRITICAL ERROR: DEV_DATABASE_URL is IDENTICAL to DATABASE_URL (Production)! Aborting.');
  process.exit(1);
}

const TABLES = [
  'competitions',
  'users',
  'scoring_criteria',
  'curation_batches',
  'quota_factor_configs',
  'curator_quota_configs',
  'proposals',
  'proposal_ai_analyses',
  'potential_duplicates',
  'fgd_additional_documents',
  'curator_assignments',
  'assignment_history',
  'screening_results',
  'promoter_assignments',
  'promoter_selections',
  'sponsor_scores',
  'fgd_sessions',
  'fgd_votes',
  'fgd_comments',
  'regional_final_sessions',
  'regional_final_pics',
  'regional_final_judges',
  'regional_final_assessments',
  'regional_final_results',
  'grand_final_selections',
  'grand_final_assessments',
  'grand_final_sponsors',
  'final_results',
  'audit_logs',
  'pdf_exports',
  'scoring_snapshots',
];

async function main() {
  console.log('🚀 Memulai Proses Copy Data dari Production ke Supabase Dev...\n');

  const sqlProd = postgres(prodUrl!, { max: 2 });
  const sqlDev = postgres(devUrl!, { max: 2 });

  try {
    // Disable triggers / foreign key constraints on Dev temporarily
    console.log('🔒 Nonaktifkan foreign key constraints sementara di Supabase Dev...');
    await sqlDev`SET session_replication_role = 'replica';`;

    // Truncate tables on Dev in reverse order
    console.log('🧹 Mengosongkan data lama di Supabase Dev...');
    for (const table of [...TABLES].reverse()) {
      await sqlDev`TRUNCATE TABLE ${sqlDev(table)} CASCADE;`;
    }

    console.log('\n📦 Menyalin Data Per Tabel:');
    console.log('--------------------------------------------------');

    for (const table of TABLES) {
      process.stdout.write(`⏳ Copying "${table}"... `);

      // Read rows from Production (READ-ONLY)
      const rows = await sqlProd`SELECT * FROM ${sqlProd(table)};`;

      if (rows.length > 0) {
        // Insert into Dev in batches of 200
        const batchSize = 200;
        for (let i = 0; i < rows.length; i += batchSize) {
          const chunk = rows.slice(i, i + batchSize);
          await sqlDev`INSERT INTO ${sqlDev(table)} ${sqlDev(chunk)}`;
        }

        // Reset primary key sequence if table has 'id'
        try {
          await sqlDev`SELECT setval(pg_get_serial_sequence(${table}, 'id'), COALESCE((SELECT MAX(id) FROM ${sqlDev(table)}), 1));`;
        } catch {
          // Table might not have an 'id' sequence, safe to ignore
        }

        console.log(`✅ ${rows.length} baris disalin.`);
      } else {
        console.log(`⚪ 0 baris (kosong).`);
      }
    }

    // Re-enable triggers / foreign key constraints on Dev
    console.log('\n🔓 Mengaktifkan kembali foreign key constraints di Supabase Dev...');
    await sqlDev`SET session_replication_role = 'origin';`;

    console.log('\n==================================================');
    console.log('📊 VERIFIKASI JUMLAH BARIS (PRODUCTION vs DEV)');
    console.log('==================================================');

    let allMatched = true;
    const summary: Array<{ Table: string; Production: number; Dev: number; Match: string }> = [];

    for (const table of TABLES) {
      const [{ count: pCount }] = await sqlProd`SELECT COUNT(*)::int as count FROM ${sqlProd(table)};`;
      const [{ count: dCount }] = await sqlDev`SELECT COUNT(*)::int as count FROM ${sqlDev(table)};`;

      const isMatch = pCount === dCount;
      if (!isMatch) allMatched = false;

      summary.push({
        Table: table,
        Production: pCount,
        Dev: dCount,
        Match: isMatch ? '✅ MATCH' : '❌ MISMATCH',
      });
    }

    console.table(summary);

    if (allMatched) {
      console.log('\n🎉 SUKSES 100%! Seluruh data Production telah tercopy sempurna ke Supabase Dev.');
    } else {
      console.log('\n⚠️ PERINGATAN: Terdapat ketidakcocokan jumlah baris di beberapa tabel!');
    }
  } catch (err) {
    console.error('\n❌ Gagal menyalin data:', err);
  } finally {
    await sqlProd.end();
    await sqlDev.end();
  }
}

main();
