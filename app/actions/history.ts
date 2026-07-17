'use server';

import { db } from '@/lib/db';
import { auditLogs, proposals, screeningResults, promoterSelections, grandFinalSelections, finalResults, curatorAssignments, users } from '@/lib/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/helpers';

export type TimelineEvent = {
  id: string;
  timestamp: Date | null;
  eventType: 'import' | 'sync_update' | 'claim' | 'screening' | 'regional_finalist' | 'promoter_selection' | 'grand_final' | 'scoring' | 'final_result' | 'status_change' | 'audit';
  title: string;
  description: string;
  actor?: string;
  metadata?: Record<string, unknown>;
};

export type ProposalHistory = {
  proposalId: number;
  proposalTitle: string;
  category: string;
  status: string;
  timeline: TimelineEvent[];
  exportJson: object;
};

/**
 * Get complete history timeline for a proposal.
 * Combines audit_logs + all related tables into a linear timeline.
 */
export async function getProposalHistory(proposalId: number): Promise<ProposalHistory | null> {
  await requireRole('coordinator');

  const [proposal] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1);

  if (!proposal) return null;

  const timeline: TimelineEvent[] = [];

  // 1. Import event
  timeline.push({
    id: `import-${proposalId}`,
    timestamp: proposal.importedAt,
    eventType: 'import',
    title: 'Proposal Diimport',
    description: `Proposal diimport ke sistem. Kategori: ${proposal.category}${proposal.regionCenter ? ` — ${proposal.regionCenter}` : ''}.`,
    metadata: {
      externalSubId: proposal.externalSubId,
      category: proposal.category,
      regionCenter: proposal.regionCenter,
    },
  });

  // 2. Audit logs for this proposal
  const logs = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entity, 'proposal'), eq(auditLogs.entityId, String(proposalId))))
    .orderBy(asc(auditLogs.createdAt));

  for (const log of logs) {
    let eventType: TimelineEvent['eventType'] = 'audit';
    let title = log.action;
    let description = log.reason ?? '-';

    if (log.action === 'source_data_changed') {
      eventType = 'sync_update';
      title = 'Data Sumber Berubah (CIDA Sync)';
      description = 'Data dari CIDA mengalami perubahan setelah proposal sudah diproses. Perlu ditinjau.';
    } else if (log.action === 'set_regional_finalists') {
      eventType = 'regional_finalist';
      title = 'Ditetapkan sebagai Finalis Regional';
      description = `Oleh: ${log.actorName ?? 'Koordinator'}`;
    } else if (log.action === 'lock_regional_group') {
      eventType = 'regional_finalist';
      title = 'Grup Regional Dikunci';
      description = `Grup ${(log.afterJson as any)?.regionKey} dikunci.`;
    }

    timeline.push({
      id: `audit-${log.id}`,
      timestamp: log.createdAt,
      eventType,
      title,
      description,
      actor: log.actorName ?? undefined,
      metadata: { before: log.beforeJson, after: log.afterJson },
    });
  }



  // 4. Screening result
  const [screening] = await db
    .select({
      id: screeningResults.id,
      verdict: screeningResults.verdict,
      notes: screeningResults.notes,
      recommendation: screeningResults.recommendation,
      submittedAt: screeningResults.submittedAt,
      curatorId: screeningResults.curatorId,
    })
    .from(screeningResults)
    .where(eq(screeningResults.proposalId, proposalId))
    .limit(1);

  if (screening) {
    const [curator] = await db.select({ name: users.name }).from(users).where(eq(users.id, screening.curatorId)).limit(1);
    timeline.push({
      id: `screening-${screening.id}`,
      timestamp: screening.submittedAt,
      eventType: 'screening',
      title: `Hasil Screening: ${screening.verdict.toUpperCase()}`,
      description: screening.notes ?? '-',
      actor: curator?.name ?? String(screening.curatorId),
      metadata: {
        verdict: screening.verdict,
        notes: screening.notes,
        recommendation: screening.recommendation,
      },
    });
  }

  // 5. Regional finalist status
  if (proposal.status === 'regional_finalist' || proposal.regionalFinalizedAt) {
    timeline.push({
      id: `regional-${proposalId}`,
      timestamp: proposal.regionalFinalizedAt,
      eventType: 'regional_finalist',
      title: `Finalis Regional — Peringkat ${proposal.regionalFinalistRank ?? '?'}`,
      description: `Proposal terpilih sebagai finalis regional${proposal.regionCenter ? ` untuk ${proposal.regionCenter}` : ''}.`,
      metadata: {
        rank: proposal.regionalFinalistRank,
        regionCenter: proposal.regionCenter,
      },
    });
  }

  // 6. Promoter selections
  const promoterSels = await db
    .select({
      id: promoterSelections.id,
      promoterId: promoterSelections.promoterId,
      selectedAt: promoterSelections.selectedAt,
    })
    .from(promoterSelections)
    .where(eq(promoterSelections.proposalId, proposalId))
    .orderBy(asc(promoterSelections.selectedAt));

  for (const sel of promoterSels) {
    const [promoter] = await db.select({ name: users.name }).from(users).where(eq(users.id, sel.promoterId)).limit(1);
    timeline.push({
      id: `promoter-${sel.id}`,
      timestamp: sel.selectedAt,
      eventType: 'promoter_selection',
      title: `Dipilih oleh Promotor`,
      description: promoter?.name ?? `Promotor #${sel.promoterId}`,
      actor: promoter?.name ?? String(sel.promoterId),
    });
  }

  // 7. Grand final selection
  const [gf] = await db
    .select()
    .from(grandFinalSelections)
    .where(eq(grandFinalSelections.proposalId, proposalId))
    .limit(1);

  if (gf) {
    timeline.push({
      id: `grandfinal-${gf.id}`,
      timestamp: gf.selectedAt,
      eventType: 'grand_final',
      title: 'Masuk Grand Final',
      description: `Dipilih untuk Grand Final${gf.lockedAt ? ' (Dikunci)' : ''}.`,
      metadata: { lockedAt: gf.lockedAt },
    });
  }

  // 8. Final result
  const [fr] = await db
    .select()
    .from(finalResults)
    .where(eq(finalResults.proposalId, proposalId))
    .limit(1);

  if (fr) {
    timeline.push({
      id: `finalresult-${fr.id}`,
      timestamp: fr.createdAt,
      eventType: 'final_result',
      title: `Hasil Akhir: ${fr.resultStatus.toUpperCase()}`,
      description: `Peringkat: ${fr.rank ?? '-'}. ${fr.notes ?? ''}`,
      metadata: { resultStatus: fr.resultStatus, rank: fr.rank },
    });
  }

  // Sort all events by timestamp
  timeline.sort((a, b) => {
    const ta = a.timestamp?.getTime() ?? 0;
    const tb = b.timestamp?.getTime() ?? 0;
    return ta - tb;
  });

  const exportJson = {
    proposalId,
    externalSubId: proposal.externalSubId,
    title: proposal.title,
    category: proposal.category,
    status: proposal.status,
    regionCenter: proposal.regionCenter,
    aiCidaTotal: proposal.aiCidaTotal,
    exportedAt: new Date().toISOString(),
    timeline: timeline.map(e => ({
      eventType: e.eventType,
      timestamp: e.timestamp?.toISOString(),
      title: e.title,
      description: e.description,
      actor: e.actor,
      metadata: e.metadata,
    })),
  };

  return {
    proposalId,
    proposalTitle: proposal.title,
    category: proposal.category,
    status: proposal.status,
    timeline,
    exportJson,
  };
}
