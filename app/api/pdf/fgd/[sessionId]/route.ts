import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { FgdBeritaAcaraReport } from '@/lib/pdf/templates/fgd-berita-acara';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { 
  fgdSessions, fgdComments, fgdVotes, proposals, competitions, users, auditLogs 
} from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
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
      title: proposals.title,
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
    participantsData = pUsers.map(u => ({
      name: u.name,
      role: u.roles.includes('coordinator') ? 'Koordinator' : (fgd.fgdType === 'promoter' ? 'Tim Promotor' : 'Tim Kurator')
    }));
  }

  const generatedAt = new Date().toLocaleString('id-ID');
  const generatedBy = session.name;
  let filename = `Berita_Acara_FGD_${fgd.name.replace(/\s+/g, '_')}.pdf`;
  const scopeText = fgd.scope === 'regional' ? `Regional (${fgd.regionCenter})` : 'Nasional (BI & BC)';

  // @ts-ignore
  const stream = await renderToStream(
    // @ts-ignore
    React.createElement(FgdBeritaAcaraReport, {
      competitionName: `${activeComp?.name || ''} ${activeComp?.year || ''}`,
      sessionName: fgd.name,
      scopeText,
      generatedAt,
      generatedBy,
      proposals: finalProposals,
      participants: participantsData,
    })
  );

  await audit.pdfExport('fgd_berita_acara', activeComp?.id || 0);

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
