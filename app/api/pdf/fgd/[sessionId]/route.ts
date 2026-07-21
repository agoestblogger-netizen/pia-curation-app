import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { FgdBeritaAcaraReport } from '@/lib/pdf/templates/fgd-berita-acara';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { 
  fgdSessions, fgdComments, fgdVotes, proposals, competitions, users, auditLogs 
} from '@/lib/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import React from 'react';
import { audit } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await params;
  const sId = parseInt(sessionId, 10);

  // Get FGD Session
  const [fgd] = await db.select().from(fgdSessions).where(eq(fgdSessions.id, sId)).limit(1);
  if (!fgd) {
    return NextResponse.json({ error: 'Sesi FGD tidak ditemukan' }, { status: 404 });
  }
  if (fgd.status !== 'locked') {
    return NextResponse.json({ error: 'Sesi FGD belum ditetapkan (belum dikunci)' }, { status: 400 });
  }

  const [activeComp] = await db.select().from(competitions).where(eq(competitions.id, fgd.competitionId)).limit(1);

  // Get proposals that are in the audit log for lock_fgd_session, 
  // OR since the status is changed, we can just look at proposals that were voted "nominate" highest? 
  // Wait! The established proposals are the ones we need to show. How do we know which ones were established?
  // We didn't save the established array in a separate table, but we saved it in audit_logs!
  // Let's get the audit log for lock_fgd_session for this session.
  const logs = await db.select().from(auditLogs).where(
    eq(auditLogs.entityId, sId.toString())
  );
  const lockLog = logs.find(l => l.action === 'lock_fgd_session');
  let finalProposalIds: number[] = [];
  if (lockLog && lockLog.afterJson) {
    const after = lockLog.afterJson as any;
    finalProposalIds = after.selectedProposalIds || [];
  }

  let finalProposals: any[] = [];
  if (finalProposalIds.length > 0) {
    finalProposals = await db.select({
      id: proposals.id,
      subId: proposals.externalSubId,
      title: proposals.title,
      proposerUnitKerja: proposals.proposerUnitKerja,
      proposerName: proposals.proposerName,
      category: proposals.category,
    }).from(proposals).where(inArray(proposals.id, finalProposalIds));
  }

  // Get participants (anyone who voted or commented, plus the one who created/locked)
  const votes = await db.select({ curatorId: fgdVotes.curatorId }).from(fgdVotes).where(eq(fgdVotes.sessionId, sId));
  const comments = await db.select({ curatorId: fgdComments.curatorId }).from(fgdComments).where(eq(fgdComments.sessionId, sId));
  
  const participantIds = new Set<number>();
  if (fgd.createdBy) participantIds.add(fgd.createdBy);
  if (fgd.lockedBy) participantIds.add(fgd.lockedBy);
  votes.forEach(v => participantIds.add(v.curatorId));
  comments.forEach(c => participantIds.add(c.curatorId));

  let participantsData: any[] = [];
  if (participantIds.size > 0) {
    const pUsers = await db.select({ name: users.name, roles: users.roles }).from(users).where(inArray(users.id, Array.from(participantIds)));
    participantsData = pUsers.map(u => {
      let role = u.roles.includes('coordinator') ? 'Koordinator' : (fgd.fgdType === 'promoter' ? 'Anggota Promotor' : 'Anggota Kurator');
      if (u.name === fgd.ketuaName) {
        role = fgd.fgdType === 'promoter' ? 'Ketua Promotor' : 'Ketua Task Force Kurator';
      } else if (u.name === fgd.sekretarisName) {
        role = fgd.fgdType === 'promoter' ? 'Sekretaris Promotor' : 'Sekretaris Task Force Kurator';
      }
      return { name: u.name, role };
    });
  }

  // Ensure ketua and sekretaris are present
  if (fgd.ketuaName && !participantsData.find(p => p.name === fgd.ketuaName)) {
    participantsData.push({
      name: fgd.ketuaName,
      role: fgd.fgdType === 'promoter' ? 'Ketua Promotor' : 'Ketua Task Force Kurator'
    });
  }
  if (fgd.sekretarisName && !participantsData.find(p => p.name === fgd.sekretarisName)) {
    participantsData.push({
      name: fgd.sekretarisName,
      role: fgd.fgdType === 'promoter' ? 'Sekretaris Promotor' : 'Sekretaris Task Force Kurator'
    });
  }

  // Sort: Ketua first, Sekretaris second, others later
  participantsData.sort((a, b) => {
    if (a.role.startsWith('Ketua')) return -1;
    if (b.role.startsWith('Ketua')) return 1;
    if (a.role.startsWith('Sekretaris')) return -1;
    if (b.role.startsWith('Sekretaris')) return 1;
    if (a.role === 'Koordinator') return 1;
    if (b.role === 'Koordinator') return -1;
    return 0;
  });

  // Calculate pool size and other stats
  const rawStatuses = Array.isArray(fgd.filterStatuses) && fgd.filterStatuses.length > 0 ? (fgd.filterStatuses as string[]) : ['lolos'];
  let poolSql = sql`p.category IN ('BI', 'BC')`;
  if (fgd.fgdType === 'promoter') {
    poolSql = sql`1=1`; // For promoter, pool is just anything with status 'promotor_selection'
  } else if (fgd.scope === 'regional' && fgd.regionCenter) {
    if (fgd.regionCenter === 'Kantor Pusat') {
      poolSql = sql`p.category = 'PUSAT'`;
    } else {
      poolSql = sql`(p.category = 'WILAYAH' AND p.region_center = ${fgd.regionCenter})`;
    }
  }

  // 1. Proposal Memenuhi Persyaratan Administrasi (Total global in competition, matching dashboard)
  const rawTotalAdmin = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM proposals p
    WHERE p.competition_id = ${fgd.competitionId}
  `);
  const totalAdmin = parseInt((rawTotalAdmin[0] as any).count, 10) || 0;

  // 3. Proposal Lolos Kurasi Internal (Pool FGD)
  let queryCondition = sql`p.status IN ('promotor_selection', 'takeout_promotor', 'grand_final', 'winner')`;
  if (fgd.fgdType !== 'promoter') {
    queryCondition = sql`sr.verdict IN (${sql.raw(rawStatuses.map(s => `'${s}'`).join(', '))}) AND ${poolSql}`;
  }

  const rawPool = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM proposals p
    LEFT JOIN screening_results sr ON sr.proposal_id = p.id
    WHERE p.competition_id = ${fgd.competitionId}
      AND ${queryCondition}
  `);
  
  const poolSize = parseInt((rawPool[0] as any).count, 10) || 0;
  
  // 4. Proposal yang lolos ke kurasi Promotor (Final FGD)
  const lolosCount = finalProposals.length;

  // Date formatting
  const today = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  const dayName = days[today.getDay()];
  const dateNum = today.getDate().toString();
  const monthName = months[today.getMonth()];
  
  // helper to convert number to words for year, assuming year is 2026/2027 etc.
  // We can simplify this and just pass the string representation for year.
  // Actually, we can just say "Dua Ribu Dua Puluh Enam" for 2026, but let's make it generic or stick to the digits since it's safer.
  const yearStr = today.getFullYear().toString();

  const generatedAt = today.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const generatedBy = session.name || 'System';
  const curatorName = session.name || 'Tim Kurator';
  const regionName = fgd.category === 'PUSAT' ? 'Kantor Pusat' : fgd.category;

  // @ts-expect-error React 19 types
  const stream = await renderToStream(
    // @ts-expect-error React 19 types
    React.createElement(FgdBeritaAcaraReport, {
      competitionName: `${activeComp?.name || ''} ${activeComp?.year || ''}`,
      regionName,
      generatedAt,
      generatedBy,
      curatorName,
      proposals: finalProposals,
      participants: participantsData,
      ketuaName: fgd.ketuaName || null,
      sekretarisName: fgd.sekretarisName || null,
      stats: {
        total: 0,
        admin: totalAdmin,
        lolos: poolSize,
        promotor: lolosCount
      },
      dateInfo: {
        dayName,
        dateNum,
        monthName,
        yearStr,
        place: 'Jakarta'
      },
      fgdType: fgd.fgdType
    })
  );

  let filename = `Berita_Acara_FGD_${fgd.name.replace(/\s+/g, '_')}.pdf`;

  await audit.pdfExport('fgd_berita_acara', activeComp?.id || 0);

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
