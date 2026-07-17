import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { ProposalListReport } from '@/lib/pdf/templates/proposal-list';
import { getActiveCompetition } from '@/app/actions/competitions'; // Will import proper actions
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { proposals, competitions, screeningResults, curatorAssignments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import React from 'react';
import { audit } from '@/lib/audit';
import { SCREENING_VERDICT_LABELS, ScreeningVerdict } from '@/lib/constants/screening';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await params;
  
  // Need to dynamically import or map types to templates
  const [activeComp] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.isActive, true))
    .limit(1);

  if (!activeComp) {
    return NextResponse.json({ error: 'No active competition' }, { status: 404 });
  }

  const generatedAt = new Date().toLocaleString('id-ID');
  const generatedBy = session.name;

  let stream: NodeJS.ReadableStream;
  let filename = `${type}_${activeComp.year}.pdf`;

  if (type === 'proposals') {
    const allProposals = await db
      .select({
        id: proposals.id,
        externalId: proposals.externalId,
        title: proposals.title,
        proposerName: proposals.proposerName,
        category: proposals.category,
        status: proposals.status,
        verdict: screeningResults.verdict,
      })
      .from(proposals)
      .leftJoin(curatorAssignments, eq(proposals.id, curatorAssignments.proposalId))
      .leftJoin(screeningResults, eq(curatorAssignments.id, screeningResults.assignmentId))
      .where(eq(proposals.competitionId, activeComp.id));

    // @ts-ignore - React-pdf stream type mismatch with Next.js response stream but it works
    stream = await renderToStream(
      // @ts-ignore
      React.createElement(ProposalListReport, {
        competitionName: `${activeComp.name} ${activeComp.year}`,
        generatedAt,
        generatedBy,
        documentStatus: activeComp.phase === 'closed' ? 'FINAL' : 'DRAFT',
        proposals: allProposals.map(p => ({
          id: p.id,
          externalId: p.externalId,
          title: p.title,
          proposerName: p.proposerName,
          category: p.category,
          status: p.verdict ? SCREENING_VERDICT_LABELS[p.verdict as ScreeningVerdict] : p.status
        }))
      })
    );
  } else {
    return NextResponse.json({ error: 'Report type not implemented yet' }, { status: 400 });
  }

  await audit.pdfExport(type, activeComp.id);

  // Return the PDF stream
  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
