import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { competitions, proposals, grandFinalAssessments, users } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { renderToStream } from '@react-pdf/renderer';
import { GrandFinalBeritaAcara } from '@/lib/pdf/templates/grand-final-berita-acara';
import React from 'react';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.roles.some(r => ['coordinator', 'admin'].includes(r))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);
    if (!activeComp) {
      return NextResponse.json({ error: 'No active competition' }, { status: 404 });
    }

    // Get GF proposals
    const gfProposals = await db.select({
      id: proposals.id,
      title: proposals.title,
      category: proposals.category,
    }).from(proposals)
      .where(and(
        eq(proposals.competitionId, activeComp.id),
        eq(proposals.status, 'grand_final')
      ));

    // Get assessments
    const assessments = await db.select().from(grandFinalAssessments)
      .where(eq(grandFinalAssessments.competitionId, activeComp.id));

    // Get sponsor users who actually assessed
    const sponsorIds = Array.from(new Set(assessments.map(a => a.sponsorId)));
    
    let sponsorsList: any[] = [];
    if (sponsorIds.length > 0) {
      sponsorsList = await db.select({ id: users.id, name: users.name })
        .from(users).where(sql`${users.id} IN (${sql.join(sponsorIds, sql`, `)})`);
    } else {
      // Fallback: all sponsors
      sponsorsList = await db.select({ id: users.id, name: users.name })
        .from(users).where(sql`'sponsor' = ANY(${users.roles})`);
    }

    // Calculate averages and classifications
    const data = gfProposals.map(p => {
      const pAssessments = assessments.filter(a => a.proposalId === p.id);
      const count = pAssessments.length;
      if (count === 0) return { ...p, totalScore: '0.00', classification: 'Belum Dinilai', avgNum: 0 };

      const sum1 = pAssessments.reduce((acc, a) => acc + a.param1Score, 0);
      const sum2 = pAssessments.reduce((acc, a) => acc + a.param2Score, 0);
      const sum3 = pAssessments.reduce((acc, a) => acc + a.param3Score, 0);
      const sum4 = pAssessments.reduce((acc, a) => acc + a.param4Score, 0);
      const totalAvg = (sum1 + sum2 + sum3 + sum4) / count;

      let classification = 'Bronze';
      if (totalAvg >= 14) classification = 'Diamond';
      else if (totalAvg >= 10) classification = 'Platinum';
      else if (totalAvg >= 6) classification = 'Gold';

      return {
        ...p,
        totalScore: totalAvg.toFixed(2),
        classification,
        avgNum: totalAvg
      };
    });

    data.sort((a, b) => b.avgNum - a.avgNum);

    // Current Date Formatted (Indonesian)
    const now = new Date();
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    // Create stream
    const stream = await renderToStream(
      // @ts-ignore
      React.createElement(GrandFinalBeritaAcara, {
        competitionName: activeComp.name,
        dateStr: dateStr,
        proposals: data,
        sponsors: sponsorsList
      })
    );

    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Berita_Acara_Grand_Final.pdf"',
      }
    });

  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
