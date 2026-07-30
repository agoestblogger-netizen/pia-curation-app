import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { SuratPenetapanRegionalReport } from '@/lib/pdf/templates/surat-penetapan';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { proposals, competitions, users } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import React from 'react';
import { audit } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ regionCenter: string }> }
) {
  const session = await getSession();
  if (!session || !session.roles.includes('coordinator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { regionCenter } = await params;
  const decodedRegion = decodeURIComponent(regionCenter);

  // Cari kompetisi aktif
  const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);
  if (!activeComp) {
    return NextResponse.json({ error: 'Tidak ada kompetisi aktif' }, { status: 404 });
  }

  // Tentukan kriteria pencarian berdasarkan region yang diminta
  const categoryFilter = decodedRegion === 'Kantor Pusat' ? 'PUSAT' : 'WILAYAH';
  const regionCenterFilter = decodedRegion === 'Kantor Pusat' ? null : decodedRegion;

  // Get proposals status = regional_finalist
  const filters = [
    eq(proposals.competitionId, activeComp.id),
    eq(proposals.category, categoryFilter),
    eq(proposals.status, 'regional_finalist')
  ];
  
  if (regionCenterFilter) {
    filters.push(eq(proposals.regionCenter, regionCenterFilter));
  }

  // Mengambil row_number untuk setiap proposal agar match dengan UI (computed on the fly untuk kompetisi ini)
  const rankedProposals = await db.execute(sql`
    WITH Ranked AS (
      SELECT id, title, proposer_name, proposer_unit_kerja, regional_finalist_rank, regional_finalized_by, regional_finalized_at, status, category, region_center,
             ROW_NUMBER() OVER (PARTITION BY category, region_center ORDER BY id ASC) as row_number
      FROM proposals
      WHERE competition_id = ${activeComp.id}
    )
    SELECT * FROM Ranked 
    WHERE status = 'regional_finalist' 
      AND category = ${categoryFilter}
      ${regionCenterFilter ? sql`AND region_center = ${regionCenterFilter}` : sql``}
    ORDER BY regional_finalist_rank ASC
  `);

  const finalists = rankedProposals as unknown as any[];

  if (finalists.length === 0) {
    return NextResponse.json({ error: 'Belum ada finalis yang ditetapkan untuk region ini' }, { status: 400 });
  }

  // Ambil nama kurator yang mengunci (dari regional_finalized_by proposal pertama)
  const lockedBy = finalists[0].regional_finalized_by;
  const lockedAt = finalists[0].regional_finalized_at;
  
  let curatorName = 'Tidak Diketahui';
  if (lockedBy) {
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, lockedBy)).limit(1);
    if (u) curatorName = u.name;
  }

  const generatedAt = lockedAt ? new Date(lockedAt).toLocaleString('id-ID') : new Date().toLocaleString('id-ID');
  const generatedBy = session.name;
  
  const displayRegion = decodedRegion === 'Kantor Pusat' ? 'Kantor Pusat' : `Kanwil ${decodedRegion}`;
  let filename = `Surat_Penetapan_${displayRegion.replace(/\s+/g, '_')}.pdf`;

  // @ts-ignore
  const stream = await renderToStream(
    // @ts-ignore
    React.createElement(SuratPenetapanRegionalReport, {
      competitionName: `${activeComp.name} ${activeComp.year}`,
      regionName: displayRegion,
      generatedAt,
      generatedBy,
      curatorName,
      proposals: finalists.map(f => ({
        id: f.id,
        title: f.title,
        proposerName: f.proposer_name,
        proposerUnitKerja: f.proposer_unit_kerja || null,
        proposerNik: null,
        rowNumber: f.row_number,
      })),
    })
  );

  await audit.pdfExport('surat_penetapan_regional', activeComp.id);

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
