import postgres from 'postgres';

async function main() {
  const prodUrl = "postgresql://postgres.iwkschhmztstndchtjpb:Masa90est!23@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
  const sql = postgres(prodUrl);

  console.log("=================================================");
  console.log("EKSEKUSI UPDATE DB PRODUCTION (iwkschhmztstndchtjpb) - CIDA 5534");
  console.log("=================================================");

  // 1. SELECT SEBELUM UPDATE
  const beforeP = await sql`
    SELECT id, external_id, external_sub_id, title, category, region_center, status
    FROM proposals
    WHERE id = 2545 AND external_sub_id = 5534;
  `;
  console.log("► Data Proposals Sebelum Update (Production):", beforeP[0]);

  const beforeCA = await sql`
    SELECT id, proposal_id, curator_id, category, status
    FROM curator_assignments
    WHERE proposal_id = 2545;
  `;
  console.log("► Data Curator Assignments Sebelum Update (Production):", beforeCA[0]);

  // 2. EKSEKUSI TRANSACTION UPDATE
  console.log("\n... Menjalankan Transaction UPDATE ...");
  await sql.begin(async (tx) => {
    const p = await tx`
      UPDATE proposals 
      SET 
        category = 'WILAYAH',
        region_center = 'Makasar',
        updated_at = NOW()
      WHERE id = 2545 AND external_sub_id = 5534
      RETURNING id, external_sub_id, title, category, region_center, status, updated_at;
    `;
    console.log("✓ Proposals Updated (Production):", p[0]);

    const ca = await tx`
      UPDATE curator_assignments 
      SET category = 'WILAYAH'
      WHERE proposal_id = 2545
      RETURNING id, proposal_id, curator_id, category, status;
    `;
    console.log("✓ Curator Assignments Updated (Production):", ca[0]);
  });

  // 3. SELECT SETELAH UPDATE
  console.log("\n=================================================");
  console.log("VERIFIKASI REAL-TIME SETELAH UPDATE (PRODUCTION):");
  console.log("=================================================");
  const afterP = await sql`
    SELECT p.id, p.external_id, p.external_sub_id, p.title, p.category, p.region_center, p.status, ca.category as curator_assignment_category
    FROM proposals p
    LEFT JOIN curator_assignments ca ON p.id = ca.proposal_id
    WHERE p.id = 2545 AND p.external_sub_id = 5534;
  `;
  console.log("Hasil Real-Time Production:", afterP[0]);

  const fv = await sql`SELECT count(*) as vote_count FROM fgd_votes WHERE proposal_id = 2545`;
  const fc = await sql`SELECT count(*) as comment_count FROM fgd_comments WHERE proposal_id = 2545`;
  console.log(`✓ Integritas Audit: FGD Votes = ${fv[0].vote_count} | FGD Comments = ${fc[0].comment_count}`);

  await sql.end();
}

main().catch(console.error);
