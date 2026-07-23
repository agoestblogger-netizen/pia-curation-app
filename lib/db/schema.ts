import {
  pgTable,
  text,
  integer,
  serial,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { SCREENING_VERDICTS } from '../constants/screening';

export const screeningVerdictEnum = pgEnum('screening_verdict', SCREENING_VERDICTS);


// ─── USERS ───────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  roles: text('roles').array().notNull().default(sql`'{"curator"}'`), // array of coordinator | curator | promoter | sponsor
  isActive: boolean('is_active').notNull().default(true),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── COMPETITIONS ─────────────────────────────────────────────────────────────
export const competitions = pgTable('competitions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  year: integer('year').notNull(),
  description: text('description'),
  // Phase progression
  phase: text('phase').notNull().default('imported'),
  phaseLockedAt: timestamp('phase_locked_at', { withTimezone: true }),
  phaseLockedBy: integer('phase_locked_by').references(() => users.id),
  promotorAccessMode: text('promotor_access_mode').notNull().default('open'), // 'assigned' | 'open'
  sponsorScoreVisibility: text('sponsor_score_visibility').notNull().default('closed'), // 'open' | 'closed'
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').references(() => users.id),
  claimDeadline: timestamp('claim_deadline', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── PROPOSALS ────────────────────────────────────────────────────────────────
export const proposals = pgTable('proposals', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  externalId: text('external_id'),
  // CIDA ID_Sub — upsert key untuk sinkronisasi data asli
  externalSubId: integer('external_sub_id'),
  title: text('title').notNull(),
  proposerName: text('proposer_name').notNull(),
  proposerOrg: text('proposer_org'),
  proposerEmail: text('proposer_email'),
  // Category: WILAYAH | PUSAT | BI | BC
  category: text('category').notNull(),
  division: text('division'),
  regionCenter: text('region_center'),
  summary: text('summary'),
  formattedTexts: jsonb('formatted_texts'),
  // Status progression
  status: text('status').notNull().default('imported'),
  takeoutReason: text('takeout_reason'),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  importedBy: integer('imported_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

  // ─── CIDA Extended Fields ──────────────────────────────────────────────────
  whatsapp: text('whatsapp'),
  theme: text('theme'),
  groupName: text('group_name'),
  teamMembers: jsonb('team_members'), // string[]
  linkProposal: text('link_proposal'),
  submissionDate: timestamp('submission_date', { withTimezone: true }),
  tagging: text('tagging'),
  tagging2: text('tagging2'),
  confirmationMember: text('confirmation_member'),

  // ─── AI CIDA Scores ────────────────────────────────────────────────────────
  aiCidaViability: doublePrecision('ai_cida_viability'),
  aiCidaFeasibility: doublePrecision('ai_cida_feasibility'),
  aiCidaDesirability: doublePrecision('ai_cida_desirability'),
  aiCidaSolvability: doublePrecision('ai_cida_solvability'),
  aiCidaProblemUrgency: doublePrecision('ai_cida_problem_urgency'),
  aiCidaUniqueness: doublePrecision('ai_cida_uniqueness'),
  aiCidaAverage: doublePrecision('ai_cida_average'),
  aiCidaTotal: doublePrecision('ai_cida_total'),
  // Catatan: 'Average Skor' di CSV ternyata berbeda dari 'Average' — Average adalah rata-rata
  // berbobot per dimensi (0-25), sementara Average Skor adalah skala 0-100. Disimpan terpisah.
  aiCidaAverageSkor: doublePrecision('ai_cida_average_skor'),

  // ─── BC / Kantor Pusat / Kantor Wilayah Fields (prefix bc_) ───────────────
  // Diisi untuk kategori BC, PUSAT, WILAYAH. NULL untuk BI.
  bcKelompokDibantu: text('bc_kelompok_dibantu'),
  bcAlasanMemilihMereka: text('bc_alasan_memilih_mereka'),
  bcApaYangAndaInginkan: text('bc_apa_yang_anda_inginkan'),
  bcAlasanMemilihAreaBantuan: text('bc_alasan_memilih_area_bantuan'),
  bcMasalahSasaranInovasi: text('bc_masalah_sasaran_inovasi'),
  bcIdentifikasiMasalah: text('bc_identifikasi_masalah'),
  bcDampakNegatifYangMuncul: text('bc_dampak_negatif_yang_muncul'),
  bcDilakukanUntukMenyelesaikanMasalah: text('bc_dilakukan_untuk_menyelesaikan_masalah'),
  bcAlternatifSolusi: text('bc_alternatif_solusi'),
  bcEksploraSolusi: text('bc_eksplorasi_solusi'),
  bcInovasiHarusMemilikiKebaruan: text('bc_inovasi_harus_memiliki_kebaruan'),
  bcDetilCaraKerja: text('bc_detil_cara_kerja'),
  bcJelaskanSecaraDetil: text('bc_jelaskan_secara_detil'),
  bcMewujudkanSolusi: text('bc_mewujudkan_solusi'),
  bcSumberDayaDiperlukan: text('bc_sumber_daya_diperlukan'),
  bcTargetCapaianFinansial: text('bc_target_capaian_finansial'),
  bcTargetCapaianNonFinansial: text('bc_target_capaian_non_finansial'),
  bcSketsaInnovasi: text('bc_sketsa_innovasi'),
  bcDokumen: text('bc_dokumen'),

  // ─── BI Fields (prefix bi_) ───────────────────────────────────────────────
  // Diisi untuk kategori BI. NULL untuk BC/PUSAT/WILAYAH.
  biCompany: text('bi_company'),
  biProfession: text('bi_profession'),
  biFungsi: text('bi_fungsi'),
  biSasaranPenggunaInovasi: text('bi_sasaran_pengguna_inovasi'),
  biAlasanMemilihSasaran: text('bi_alasan_memilih_sasaran'),
  biMasalahDiselesaikan: text('bi_masalah_diselesaikan'),
  biMasalahPentingKarena: text('bi_masalah_penting_karena'),
  biInovasiDiusulkan: text('bi_inovasi_diusulkan'),
  biKonteksInovasi: text('bi_konteks_inovasi'),
  biAlasanKonteksInovasi: text('bi_alasan_konteks_inovasi'),
  biSolusiSudahAda: text('bi_solusi_sudah_ada'),
  biInovasiDapatMenyelesaikan: text('bi_inovasi_dapat_menyelesaikan'),
  biKeunikanPenyelesaian: text('bi_keunikan_penyelesaian'),
  biDenganCara: text('bi_dengan_cara'),
  biDiwujudkanDenganCara: text('bi_diwujudkan_dengan_cara'),
  biSumberDaya: text('bi_sumber_daya'),
  biTargetFinansial: text('bi_target_finansial'),
  biTargetNonFinansial: text('bi_target_non_finansial'),

  // ─── Enrichment dari Data_Wilayah.csv (best-effort join by Name) ──────────
  proposerDirectorate: text('proposer_directorate'),
  proposerDivision: text('proposer_division'),
  proposerDepartment: text('proposer_department'),
  proposerRegion: text('proposer_region'),
  proposerOffice: text('proposer_office'),
  proposerUnitKerja: text('proposer_unit_kerja'),

  // ─── Sync tracking ────────────────────────────────────────────────────────
  needsReview: boolean('needs_review').notNull().default(false),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),

  // ─── Regional Final (Modul 2) ─────────────────────────────────────────────
  regionalFinalistRank: integer('regional_finalist_rank'),
  regionalFinalizedAt: timestamp('regional_finalized_at', { withTimezone: true }),
  regionalFinalizedBy: integer('regional_finalized_by').references(() => users.id),

  // ─── OPTIMIZATION ─────────────────────────────────────────────────────────
  nomorUrut: integer('nomor_urut'),
}, (table) => [
  index('proposals_competition_id_idx').on(table.competitionId),
  index('proposals_category_idx').on(table.category),
  index('proposals_status_idx').on(table.status),
  uniqueIndex('proposals_external_sub_id_idx').on(table.competitionId, table.externalSubId),
  index('proposals_needs_review_idx').on(table.needsReview),
  index('proposals_region_center_idx').on(table.regionCenter),
]);

// ─── PROPOSAL AI ANALYSES ─────────────────────────────────────────────────────
export const proposalAiAnalyses = pgTable('proposal_ai_analyses', {
  id: serial('id').primaryKey(),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id).unique(),
  structuredSummary: jsonb('structured_summary').notNull(), // { problem: string, solution: string, target: string }
  keyClaims: jsonb('key_claims').notNull(), // string[]
  clarificationPoints: jsonb('clarification_points').notNull(), // string[]
  duplicationCheck: text('duplication_check'), // string
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── FGD ADDITIONAL DOCUMENTS ─────────────────────────────────────────────────
export const fgdAdditionalDocuments = pgTable('fgd_additional_documents', {
  id: serial('id').primaryKey(),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  aiAnalysis: jsonb('ai_analysis').notNull(), // The GPT result
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  uploadedBy: integer('uploaded_by').references(() => users.id),
});

// ─── CURATION BATCHES ─────────────────────────────────────────────────────────
export const curationBatches = pgTable('curation_batches', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  name: text('name').notNull(),
  // Mode: equal | manual_quota | weighted | category_based | hybrid
  assignmentMode: text('assignment_mode').notNull().default('equal'),
  configJson: jsonb('config_json'),
  status: text('status').notNull().default('draft'), // draft | locked | closed
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: integer('locked_by').references(() => users.id),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── QUOTA FACTOR CONFIGS ─────────────────────────────────────────────────────
export const quotaFactorConfigs = pgTable('quota_factor_configs', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  // Load level: none | light | medium | high
  loadLevel: text('load_level').notNull(),
  factor: doublePrecision('factor').notNull(), // e.g. 1.00, 0.75, 0.60, 0.40
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('quota_factor_competition_level').on(table.competitionId, table.loadLevel),
]);

// ─── CURATOR ASSIGNMENTS ──────────────────────────────────────────────────────
export const curatorAssignments = pgTable('curator_assignments', {
  id: serial('id').primaryKey(),
  batchId: integer('batch_id').notNull().references(() => curationBatches.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  curatorId: integer('curator_id').notNull().references(() => users.id),
  category: text('category').notNull(),
  // Status: assigned | in_review | completed | reassigned
  status: text('status').notNull().default('assigned'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  assignedBy: integer('assigned_by').references(() => users.id),
}, (table) => [
  // One proposal per batch (no double assignment)
  uniqueIndex('curator_assignment_batch_proposal').on(table.batchId, table.proposalId),
  index('curator_assignment_curator_idx').on(table.curatorId),
  index('curator_assignment_batch_idx').on(table.batchId),
  index('curator_assignment_proposal_idx').on(table.proposalId),
  index('curator_assignment_status_idx').on(table.status),
]);

// ─── ASSIGNMENT HISTORY ───────────────────────────────────────────────────────
export const assignmentHistory = pgTable('assignment_history', {
  id: serial('id').primaryKey(),
  assignmentId: integer('assignment_id').notNull().references(() => curatorAssignments.id),
  fromCuratorId: integer('from_curator_id').references(() => users.id),
  toCuratorId: integer('to_curator_id').references(() => users.id),
  reason: text('reason'),
  reassignedBy: integer('reassigned_by').references(() => users.id),
  reassignedAt: timestamp('reassigned_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── CURATOR QUOTA CONFIGS ────────────────────────────────────────────────────
export const curatorQuotaConfigs = pgTable('curator_quota_configs', {
  id: serial('id').primaryKey(),
  batchId: integer('batch_id').notNull().references(() => curationBatches.id),
  curatorId: integer('curator_id').notNull().references(() => users.id),
  // Regional load (for BI/BC quota reduction)
  regionalLoad: text('regional_load').notNull().default('none'), // none|light|medium|high
  // Recommended quotas by category
  recommendedWilayah: integer('recommended_wilayah').notNull().default(0),
  recommendedPusat: integer('recommended_pusat').notNull().default(0),
  recommendedBi: integer('recommended_bi').notNull().default(0),
  recommendedBc: integer('recommended_bc').notNull().default(0),
  // Final quotas (after manual adjustment)
  finalWilayah: integer('final_wilayah').notNull().default(0),
  finalPusat: integer('final_pusat').notNull().default(0),
  finalBi: integer('final_bi').notNull().default(0),
  finalBc: integer('final_bc').notNull().default(0),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('quota_config_batch_curator').on(table.batchId, table.curatorId),
]);

// ─── SCREENING RESULTS ────────────────────────────────────────────────────────
export const screeningResults = pgTable('screening_results', {
  id: serial('id').primaryKey(),
  assignmentId: integer('assignment_id').notNull().references(() => curatorAssignments.id).unique(),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  curatorId: integer('curator_id').notNull().references(() => users.id),
  // Verdict: lolos | duplication | mapped | non_compliance | low_impact
  verdict: screeningVerdictEnum('verdict').notNull(),
  notes: text('notes'),
  recommendation: text('recommendation'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('screening_results_proposal_idx').on(table.proposalId),
]);

// ─── PROMOTER SELECTIONS ──────────────────────────────────────────────────────
export const promoterSelections = pgTable('promoter_selections', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  promoterId: integer('promoter_id').notNull().references(() => users.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  selectedAt: timestamp('selected_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('promoter_selection_promoter_proposal').on(table.promoterId, table.proposalId),
  index('promoter_selection_competition_idx').on(table.competitionId),
  index('promoter_selection_proposal_idx').on(table.proposalId),
]);

// ─── GRAND FINAL SPONSORS ───────────────────────────────────────────────────
export const grandFinalSponsors = pgTable('grand_final_sponsors', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  userId: integer('user_id').notNull().references(() => users.id),
  assignedBy: integer('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('grand_final_sponsor_unique').on(table.competitionId, table.userId),
]);

// ─── GRAND FINAL SELECTIONS ───────────────────────────────────────────────────
export const grandFinalSelections = pgTable('grand_final_selections', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id).unique(),
  selectedBy: integer('selected_by').references(() => users.id),
  selectedAt: timestamp('selected_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: integer('locked_by').references(() => users.id),
});

// ─── GRAND FINAL ASSESSMENTS (SPONSOR SCORES) ───────────────────────────────
export const grandFinalAssessments = pgTable('grand_final_assessments', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  sponsorId: integer('sponsor_id').notNull().references(() => users.id),
  param1Score: integer('param1_score').notNull(),
  param2Score: integer('param2_score').notNull(),
  param3Score: integer('param3_score').notNull(),
  param4Score: integer('param4_score').notNull(),
  totalScore: integer('total_score').notNull(),
  classification: text('classification').notNull(), // Diamond | Platinum | Gold | Silver | Bronze
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('grand_final_assessments_unique').on(table.competitionId, table.proposalId, table.sponsorId),
]);

// ─── SCORING CRITERIA ─────────────────────────────────────────────────────────
export const scoringCriteria = pgTable('scoring_criteria', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  name: text('name').notNull(),
  description: text('description'),
  maxScore: doublePrecision('max_score').notNull().default(100),
  weight: doublePrecision('weight').notNull().default(1.0),
  orderIndex: integer('order_index').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── SPONSOR SCORES ───────────────────────────────────────────────────────────
export const sponsorScores = pgTable('sponsor_scores', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  sponsorId: integer('sponsor_id').notNull().references(() => users.id),
  criterionId: integer('criterion_id').notNull().references(() => scoringCriteria.id),
  score: doublePrecision('score').notNull(),
  isDraft: boolean('is_draft').notNull().default(true),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('sponsor_score_sponsor_proposal_criterion').on(table.sponsorId, table.proposalId, table.criterionId),
]);

// ─── SCORING SNAPSHOTS ────────────────────────────────────────────────────────
export const scoringSnapshots = pgTable('scoring_snapshots', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
  lockedBy: integer('locked_by').references(() => users.id),
  snapshotJson: jsonb('snapshot_json').notNull(), // full ranking snapshot
});

// ─── FINAL RESULTS ────────────────────────────────────────────────────────────
export const finalResults = pgTable('final_results', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id).unique(),
  rank: integer('rank'),
  // Status: winner | selected | reserve | not_selected
  resultStatus: text('result_status').notNull(),
  notes: text('notes'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: integer('locked_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorId: integer('actor_id').references(() => users.id),
  actorName: text('actor_name'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  beforeJson: jsonb('before_json'),
  afterJson: jsonb('after_json'),
  reason: text('reason'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_log_actor_idx').on(table.actorId),
  index('audit_log_entity_idx').on(table.entity, table.entityId),
  index('audit_log_created_at_idx').on(table.createdAt),
]);

// ─── PDF EXPORTS ──────────────────────────────────────────────────────────────
export const pdfExports = pgTable('pdf_exports', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').references(() => competitions.id),
  reportType: text('report_type').notNull(),
  filterJson: jsonb('filter_json'),
  generatedBy: integer('generated_by').references(() => users.id),
  generatedByName: text('generated_by_name'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  documentStatus: text('document_status').notNull().default('DRAFT'), // DRAFT | INTERNAL | FINAL
});

// ─── PROMOTER ASSIGNMENTS ───────────────────────────────────────────────────
export const promoterAssignments = pgTable('promoter_assignments', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  promoterId: integer('promoter_id').notNull().references(() => users.id),
  assignedBy: integer('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('promoter_assignment_unique').on(table.competitionId, table.proposalId, table.promoterId),
  index('promoter_assignment_promoter_idx').on(table.promoterId),
]);

// ─── FGD SESSIONS ─────────────────────────────────────────────────────────────
export const fgdSessions = pgTable('fgd_sessions', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  name: text('name').notNull(),
  fgdType: text('fgd_type').notNull().default('curator'), // curator | promoter
  scope: text('scope').notNull().default('nasional'), // nasional | regional
  regionCenter: text('region_center'), // null if nasional
  targetCandidates: integer('target_candidates').notNull().default(10),
  viewMode: text('view_mode').notNull().default('grouped'), // grouped | mixed
  filterStatuses: jsonb('filter_statuses').notNull().default(sql`'["lolos"]'`), // array of string status
  ketuaName: text('ketua_name'),
  sekretarisName: text('sekretaris_name'),
  status: text('status').notNull().default('draft'), // draft | active | locked
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: integer('locked_by').references(() => users.id),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── FGD VOTES ────────────────────────────────────────────────────────────────
export const fgdVotes = pgTable('fgd_votes', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => fgdSessions.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  curatorId: integer('curator_id').notNull().references(() => users.id),
  vote: text('vote').notNull(), // nominate | not_nominate
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('fgd_vote_unique').on(table.sessionId, table.proposalId, table.curatorId),
]);

// ─── FGD COMMENTS ─────────────────────────────────────────────────────────────
export const fgdComments = pgTable('fgd_comments', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => fgdSessions.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  curatorId: integer('curator_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── POTENTIAL DUPLICATES ───────────────────────────────────────────────────────
export const potentialDuplicates = pgTable('potential_duplicates', {
  id: serial('id').primaryKey(),
  proposalAId: integer('proposal_a_id').notNull().references(() => proposals.id),
  proposalBId: integer('proposal_b_id').notNull().references(() => proposals.id),
  markedBy: integer('marked_by').notNull().references(() => users.id),
  markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
  aiSimilarityLevel: text('ai_similarity_level').notNull(),
  note: text('note'),
  // status: pending, confirmed, rejected
  status: text('status').notNull().default('pending'),
}, (table) => [
  index('potential_duplicates_prop_a_idx').on(table.proposalAId),
  index('potential_duplicates_prop_b_idx').on(table.proposalBId),
]);

// ─── REGIONAL FINAL (MODUL 3) ─────────────────────────────────────────────────
export const regionalFinalSessions = pgTable('regional_final_sessions', {
  id: serial('id').primaryKey(),
  competitionId: integer('competition_id').notNull().references(() => competitions.id),
  region: text('region').notNull(), // Kanwil Name or 'Pusat'
  status: text('status').notNull().default('finalis_terkunci'), // finalis_terkunci | juri_ditugaskan | penilaian_dibuka | penilaian_selesai | sidang_penetapan | hasil_terkunci
  juriCountSetting: integer('juri_count_setting').notNull().default(3),
  lockedBy: integer('locked_by').references(() => users.id),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('regional_final_session_unique').on(table.competitionId, table.region),
]);

export const regionalFinalJudges = pgTable('regional_final_judges', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => regionalFinalSessions.id),
  userId: integer('user_id').notNull().references(() => users.id),
  isFinalized: boolean('is_finalized').notNull().default(false),
  assignedBy: integer('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
]);

export const regionalFinalPics = pgTable('regional_final_pics', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => regionalFinalSessions.id),
  userId: integer('user_id').notNull().references(() => users.id),
  assignedBy: integer('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('regional_final_pic_unique').on(table.sessionId, table.userId),
]);

export const regionalFinalAssessments = pgTable('regional_final_assessments', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => regionalFinalSessions.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  judgeUserId: integer('judge_user_id').notNull().references(() => users.id),
  paramProblemFit: doublePrecision('param_problem_fit').notNull(),
  paramDampak: doublePrecision('param_dampak').notNull(),
  paramKelayakan: doublePrecision('param_kelayakan').notNull(),
  paramProfessional: doublePrecision('param_professional').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('regional_final_assessment_unique').on(table.sessionId, table.proposalId, table.judgeUserId),
]);

export const regionalFinalResults = pgTable('regional_final_results', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull().references(() => regionalFinalSessions.id),
  proposalId: integer('proposal_id').notNull().references(() => proposals.id),
  finalScore: doublePrecision('final_score').notNull(),
  rank: integer('rank'), // 1, 2, 3, or null
  tieBreakNote: text('tie_break_note'),
  lockedBy: integer('locked_by').references(() => users.id),
  lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('regional_final_result_unique').on(table.sessionId, table.proposalId),
]);

// ─── TYPE EXPORTS ─────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Competition = typeof competitions.$inferSelect;
export type NewCompetition = typeof competitions.$inferInsert;
export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;
export type CurationBatch = typeof curationBatches.$inferSelect;
export type CuratorAssignment = typeof curatorAssignments.$inferSelect;
// ─── CLAIMS ───────────────────────────────────────────────────────────────────
// (Dihapus pada Fase 1.7 - Pindah ke model True Assignment)

export type ScreeningResult = typeof screeningResults.$inferSelect;
export type PromoterSelection = typeof promoterSelections.$inferSelect;
export type GrandFinalSelection = typeof grandFinalSelections.$inferSelect;
export type GrandFinalSponsor = typeof grandFinalSponsors.$inferSelect;
export type GrandFinalAssessment = typeof grandFinalAssessments.$inferSelect;

export type ScoringCriterion = typeof scoringCriteria.$inferSelect;
export type SponsorScore = typeof sponsorScores.$inferSelect;
export type FinalResult = typeof finalResults.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type CuratorQuotaConfig = typeof curatorQuotaConfigs.$inferSelect;
export type FgdSession = typeof fgdSessions.$inferSelect;
export type FgdVote = typeof fgdVotes.$inferSelect;
export type FgdComment = typeof fgdComments.$inferSelect;
export type PromoterAssignment = typeof promoterAssignments.$inferSelect;
export type ProposalAiAnalysis = typeof proposalAiAnalyses.$inferSelect;
export type FgdAdditionalDocument = typeof fgdAdditionalDocuments.$inferSelect;

export type RegionalFinalSession = typeof regionalFinalSessions.$inferSelect;
export type RegionalFinalJudge = typeof regionalFinalJudges.$inferSelect;
export type RegionalFinalPic = typeof regionalFinalPics.$inferSelect;
export type RegionalFinalAssessment = typeof regionalFinalAssessments.$inferSelect;
export type RegionalFinalResult = typeof regionalFinalResults.$inferSelect;
