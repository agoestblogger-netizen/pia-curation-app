import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { competitions, proposals, grandFinalAssessments, users } from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { renderToStream } from '@react-pdf/renderer';
import { RegionalFinalBeritaAcara } from '@/lib/pdf/templates/regional-final-berita-acara';
import React from 'react';
import { regionalFinalSessions, regionalFinalJudges, regionalFinalAssessments, regionalFinalResults } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.roles.some(r => ['coordinator', 'admin', 'curator'].includes(r))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);
    if (!activeComp) {
      return NextResponse.json({ error: 'No active competition' }, { status: 404 });
    }

    const sessionIdParam = req.nextUrl.searchParams.get('sessionId');
    if (!sessionIdParam) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    const sessionId = parseInt(sessionIdParam, 10);
    
    const [sessionData] = await db.select().from(regionalFinalSessions).where(eq(regionalFinalSessions.id, sessionId));
    if (!sessionData) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Get Regional proposals for this session
    const isPusat = sessionData.region === 'Kantor Pusat';
    const dbRegion = sessionData.region.replace(/^Kanwil /, '');
    
    const regionalProposals = await db.select({
      id: proposals.id,
      title: proposals.title,
      category: proposals.category,
      proposerName: proposals.proposerName,
    }).from(proposals)
      .where(and(
        eq(proposals.competitionId, activeComp.id),
        isPusat
          ? eq(proposals.category, 'PUSAT')
          : and(eq(proposals.category, 'WILAYAH'), eq(proposals.regionCenter, dbRegion)),
        eq(proposals.status, 'regional_finalist')
      ));

    // Get assessments
    const assessments = await db.select().from(regionalFinalAssessments)
      .where(eq(regionalFinalAssessments.sessionId, sessionId));
      
    // Get Results
    const results = await db.select().from(regionalFinalResults)
      .where(eq(regionalFinalResults.sessionId, sessionId));

    // Get judge users
    const judgesList = await db.select({ id: users.id, name: users.name })
      .from(users)
      .innerJoin(regionalFinalJudges, eq(users.id, regionalFinalJudges.userId))
      .where(eq(regionalFinalJudges.sessionId, sessionId));

    // Get PIC Name
    let picName = 'PIC Regional';
    if (regionalProposals.length > 0) {
      const { curatorAssignments } = await import('@/lib/db/schema');
      const [assignment] = await db.select({ name: users.name })
        .from(curatorAssignments)
        .innerJoin(users, eq(users.id, curatorAssignments.curatorId))
        .where(eq(curatorAssignments.proposalId, regionalProposals[0].id))
        .limit(1);
      if (assignment) {
        picName = assignment.name;
      }
    }

    // Assemble data
    const data = regionalProposals.map(p => {
      const pResult = results.find(r => r.proposalId === p.id);
      return {
        ...p,
        totalScore: pResult ? pResult.finalScore.toFixed(2) : '0.00',
        rank: pResult?.rank || null,
        isTieBreak: !!pResult?.tieBreakNote,
        avgNum: pResult ? pResult.finalScore : 0
      };
    });

    // Sort by finalScore, then rank if available
    data.sort((a, b) => b.avgNum - a.avgNum);

    // Current Date Formatted (Indonesian)
    const now = new Date();
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    // Create stream
    const stream = await renderToStream(
      // @ts-ignore
      React.createElement(RegionalFinalBeritaAcara, {
        competitionName: activeComp.name,
        regionName: sessionData.region,
        dateStr: dateStr,
        proposals: data,
        judges: judgesList,
        picName: picName
      })
    );

    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Berita_Acara_Regional_${sessionData.region.replace(/\s+/g, '_')}.pdf"`,
      }
    });

  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
