import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';

export interface AuditParams {
  action: string;
  entity: string;
  entityId?: string | number;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ipAddress?: string;
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    const session = await getSession();
    await db.insert(auditLogs).values({
      actorId: session?.userId ?? null,
      actorName: session?.name ?? 'System',
      action: params.action,
      entity: params.entity,
      entityId: params.entityId != null ? String(params.entityId) : null,
      beforeJson: params.before ? (params.before as Record<string, unknown>) : null,
      afterJson: params.after ? (params.after as Record<string, unknown>) : null,
      reason: params.reason ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (error) {
    // Audit log failure should never break the main operation
    console.error('[AuditLog] Failed to write audit log:', error);
  }
}

// Shorthand helpers
export const audit = {
  importProposals: (competitionId: number, count: number) =>
    createAuditLog({ action: 'import_proposals', entity: 'competition', entityId: competitionId, after: { count } }),

  createBatch: (batchId: number, config: unknown) =>
    createAuditLog({ action: 'create_batch', entity: 'curation_batch', entityId: batchId, after: config }),

  updateAssignment: (assignmentId: number, before: unknown, after: unknown) =>
    createAuditLog({ action: 'update_assignment', entity: 'curator_assignment', entityId: assignmentId, before, after }),

  reassignProposal: (assignmentId: number, fromCuratorId: number, toCuratorId: number, reason?: string) =>
    createAuditLog({ action: 'reassign_proposal', entity: 'curator_assignment', entityId: assignmentId, before: { curatorId: fromCuratorId }, after: { curatorId: toCuratorId }, reason }),

  lockBatch: (batchId: number) =>
    createAuditLog({ action: 'lock_batch', entity: 'curation_batch', entityId: batchId }),

  screeningSubmit: (assignmentId: number, verdict: string) =>
    createAuditLog({ action: 'submit_screening', entity: 'screening_result', entityId: assignmentId, after: { verdict } }),

  promoterSelect: (proposalId: number) =>
    createAuditLog({ action: 'promoter_select', entity: 'promoter_selection', entityId: proposalId }),

  closePhase: (competitionId: number, phase: string, overrideReason?: string) =>
    createAuditLog({ action: 'close_phase', entity: 'competition', entityId: competitionId, after: { phase }, reason: overrideReason }),

  lockNomination: (competitionId: number) =>
    createAuditLog({ action: 'lock_nomination', entity: 'competition', entityId: competitionId }),

  lockScoringResults: (competitionId: number) =>
    createAuditLog({ action: 'lock_scoring_results', entity: 'competition', entityId: competitionId }),

  finalLock: (competitionId: number) =>
    createAuditLog({ action: 'final_lock', entity: 'competition', entityId: competitionId }),

  pdfExport: (reportType: string, competitionId?: number) =>
    createAuditLog({ action: 'pdf_export', entity: 'pdf_exports', entityId: competitionId, after: { reportType } }),

  userCreated: (userId: number, data: unknown) =>
    createAuditLog({ action: 'create_user', entity: 'users', entityId: userId, after: data }),

  userEdited: (userId: number, before: unknown, after: unknown) =>
    createAuditLog({ action: 'edit_user', entity: 'users', entityId: userId, before, after }),

  passwordResetByAdmin: (userId: number) =>
    createAuditLog({ action: 'password_reset_by_admin', entity: 'users', entityId: userId }),

  userDeleted: (userId: number) =>
    createAuditLog({ action: 'delete_user', entity: 'users', entityId: userId }),
};
