/**
 * CIDA Data Importer — Fase 1.6
 *
 * Melakukan import/sync data proposal asli dari 6 file CSV ke database.
 * Dapat di-run ulang kapan saja (upsert by externalSubId, idempotent).
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/import-cida.ts
 *
 * Options:
 *   --dry-run    Print stats without writing to DB
 *   --truncate   Hapus semua proposals lama sebelum import (HATI-HATI!)
 */

import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import * as schema from '../lib/db/schema';

const { proposals, competitions, screeningResults, curatorAssignments, users } = schema;

// ─── CSV Parser ───────────────────────────────────────────────────────────────
// Simple CSV parser that handles quoted fields with embedded commas/newlines
function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: Record<string, string>[] = [];

  let headers: string[] = [];
  let inQuotes = false;
  let field = '';
  let fields: string[] = [];
  let isFirstRow = true;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else if (ch === '\n' && !inQuotes) {
      fields.push(field);
      field = '';

      if (isFirstRow) {
        headers = fields.map(h => h.trim());
        isFirstRow = false;
      } else if (fields.length > 0 && fields.some(f => f.trim() !== '')) {
        const row: Record<string, string> = {};
        // Handle duplicate column names by appending index
        const colCounts: Record<string, number> = {};
        headers.forEach((h, idx) => {
          const key = h === '' ? `__empty_${idx}` : h;
          const count = colCounts[key] ?? 0;
          const finalKey = count === 0 ? key : `${key}__${count}`;
          colCounts[key] = count + 1;
          row[finalKey] = (fields[idx] ?? '').trim();
        });
        rows.push(row);
      }
      fields = [];
    } else {
      field += ch;
    }
  }

  // Last row if no trailing newline
  if (fields.length > 0 || field !== '') {
    fields.push(field);
    if (!isFirstRow && fields.some(f => f.trim() !== '')) {
      const row: Record<string, string> = {};
      const colCounts: Record<string, number> = {};
      headers.forEach((h, idx) => {
        const key = h === '' ? `__empty_${idx}` : h;
        const count = colCounts[key] ?? 0;
        const finalKey = count === 0 ? key : `${key}__${count}`;
        colCounts[key] = count + 1;
        row[finalKey] = (fields[idx] ?? '').trim();
      });
      rows.push(row);
    }
  }

  return rows;
}

// ─── Category Mapping ─────────────────────────────────────────────────────────
const CATEGORY_MAP = {
  BC: 'BC',
  PUSAT: 'PUSAT',
  WILAYAH: 'WILAYAH',
  BI: 'BI',
} as const;

// Group → Category mapping from LOLOS.csv
const GROUP_TO_CATEGORY: Record<string, string> = {
  'Kantor Wilayah': 'WILAYAH',
  'Wilayah': 'WILAYAH',
  'Kantor Pusat': 'PUSAT',
  'Pusat': 'PUSAT',
  'Business Innovation': 'BI',
  'BI': 'BI',
  'Business Case': 'BC',
  'BC': 'BC',
};

// ─── Parse helpers ────────────────────────────────────────────────────────────
function parseScore(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val.trim());
  return isNaN(n) ? null : n;
}

function parseSubDate(val: string | undefined): Date | null {
  if (!val || val.trim() === '') return null;
  // Format: "DD-MM-YYYY H:M" or "DD-MM-YYYYHH:MM"
  const v = val.trim();
  // Try "08-07-2026 12:3" format
  const m = v.match(/(\d{1,2})-(\d{1,2})-(\d{4})\s*(\d{1,2}):(\d{1,2})/);
  if (m) {
    const [, d, mo, y, h, mi] = m;
    return new Date(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(mi));
  }
  return null;
}

function collectTeamMembers(row: Record<string, string>): string[] {
  const members: string[] = [];
  // Handles duplicate "Team_Member" columns (Team_Member, Team_Member__1, Team_Member__2, ...)
  const memberFields = Object.keys(row).filter(k => k === 'Team_Member' || k.startsWith('Team_Member__'));
  for (const key of memberFields) {
    const v = row[key]?.trim();
    if (v && v !== '') members.push(v);
  }
  return members;
}

// ─── Source fields for change detection ──────────────────────────────────────
type SourceFields = {
  title: string;
  summary: string | null;
  aiCidaViability: number | null;
  aiCidaFeasibility: number | null;
  aiCidaDesirability: number | null;
  aiCidaSolvability: number | null;
  aiCidaProblemUrgency: number | null;
  aiCidaUniqueness: number | null;
  aiCidaAverage: number | null;
  aiCidaTotal: number | null;
  aiCidaAverageSkor: number | null;
  teamMembers: string[];
};

function extractSourceFields(data: Partial<schema.NewProposal> & { teamMembers?: string[] | null }): SourceFields {
  return {
    title: data.title ?? '',
    summary: data.summary ?? null,
    aiCidaViability: data.aiCidaViability ?? null,
    aiCidaFeasibility: data.aiCidaFeasibility ?? null,
    aiCidaDesirability: data.aiCidaDesirability ?? null,
    aiCidaSolvability: data.aiCidaSolvability ?? null,
    aiCidaProblemUrgency: data.aiCidaProblemUrgency ?? null,
    aiCidaUniqueness: data.aiCidaUniqueness ?? null,
    aiCidaAverage: data.aiCidaAverage ?? null,
    aiCidaTotal: data.aiCidaTotal ?? null,
    aiCidaAverageSkor: data.aiCidaAverageSkor ?? null,
    teamMembers: (data.teamMembers ?? []) as string[],
  };
}

function sourceFieldsChanged(a: SourceFields, b: SourceFields): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

// ─── Check if proposal needs review flag ──────────────────────────────────────
async function hasScreeningOrAdvanced(db: ReturnType<typeof drizzle>, proposalId: number): Promise<boolean> {
  // Check if has screening result
  const [sr] = await db.select({ id: screeningResults.id })
    .from(screeningResults)
    .where(eq(screeningResults.proposalId, proposalId))
    .limit(1);
  if (sr) return true;

  // Check proposal status — if beyond 'under_curation', consider advanced
  const [p] = await db.select({ status: proposals.status })
    .from(proposals)
    .where(eq(proposals.id, proposalId))
    .limit(1);

  if (!p) return false;
  const advancedStatuses = ['regional_finalist', 'promotor_nominated', 'grand_final', 'winner', 'selected', 'reserve', 'takeout'];
  return advancedStatuses.includes(p.status);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const doTruncate = process.argv.includes('--truncate');

  if (isDryRun) console.log('🔍 DRY RUN MODE — tidak ada yang ditulis ke DB');
  if (doTruncate) console.log('⚠️  TRUNCATE MODE — akan hapus semua proposals lama');

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL tidak di-set');

  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema });

  // ─── Step 0: Truncate if requested ─────────────────────────────────────────
  if (doTruncate && !isDryRun) {
    console.log('🗑️  Menghapus data lama (screening_results, curator_assignments, proposals)...');
    // Order matters due to FK constraints
    await client`DELETE FROM screening_results`;
    await client`DELETE FROM promoter_selections`;
    await client`DELETE FROM grand_final_selections`;
    await client`DELETE FROM final_results`;
    await client`DELETE FROM assignment_history`;
    await client`DELETE FROM curator_assignments`;
    await client`DELETE FROM curation_batches`;
    await client`DELETE FROM proposals`;
    console.log('✅ Data lama dihapus');
  }

  // ─── Step 1: Get active competition ────────────────────────────────────────
  const [activeComp] = await db.select().from(competitions).where(eq(competitions.isActive, true)).limit(1);
  if (!activeComp) {
    throw new Error('Tidak ada kompetisi aktif. Jalankan seed users & competition dulu.');
  }
  console.log(`\n📦 Kompetisi aktif: ${activeComp.name} (ID: ${activeComp.id})`);

  // Get coordinator user for importedBy
  const [coordinator] = await db.select().from(users).where(sql`'coordinator' = ANY(${users.roles})`).limit(1);
  const coordinatorId = coordinator?.id ?? null;

  // ─── Step 2: Load LOLOS.csv ────────────────────────────────────────────────
  const DATA_DIR = path.join(process.cwd(), 'data', 'raw');
  const lolosFile = path.join(DATA_DIR, 'Hasil Penilaian AI CIDA PIA 2026.xlsx - LOLOS.csv');
  console.log('\n📋 Membaca LOLOS.csv...');
  const lolosRows = parseCSV(lolosFile);
  const lolosMap = new Map<number, Record<string, string>>();
  for (const row of lolosRows) {
    const id = parseInt(row['ID_Sub'] ?? '');
    if (!isNaN(id)) lolosMap.set(id, row);
  }
  console.log(`   ${lolosMap.size} proposal lolos ditemukan`);

  // ─── Step 3: Load Data_Wilayah.csv (enrichment) ───────────────────────────
  const dataWilayahFile = path.join(DATA_DIR, 'Hasil Penilaian AI CIDA PIA 2026.xlsx - Data Wilayah.csv');
  console.log('🏢 Membaca Data_Wilayah.csv...');
  const dataWilayahRows = parseCSV(dataWilayahFile);
  const enrichmentMap = new Map<string, Record<string, string>>();
  for (const row of dataWilayahRows) {
    const name = row['Name']?.trim().toLowerCase();
    if (name) enrichmentMap.set(name, row);
  }
  console.log(`   ${enrichmentMap.size} data wilayah ditemukan`);

  // ─── Stats ─────────────────────────────────────────────────────────────────
  let statsNew = 0;
  let statsUpdated = 0;
  let statsSkipped = 0;
  let statsNeedsReview = 0;
  let statsEnriched = 0;

  // ─── Step 4: Process each category file ───────────────────────────────────
  const categoryFiles = [
    {
      file: path.join(DATA_DIR, 'Hasil Penilaian AI CIDA PIA 2026 - BC.csv'),
      category: 'BC' as const,
      type: 'bc' as const,
    },
    {
      file: path.join(DATA_DIR, 'Hasil Penilaian AI CIDA PIA 2026 - Kantor Pusat 2.csv'),
      category: 'PUSAT' as const,
      type: 'bc' as const,
    },
    {
      file: path.join(DATA_DIR, 'Hasil Penilaian AI CIDA PIA 2026 - Kantor Wilayah 2.csv'),
      category: 'WILAYAH' as const,
      type: 'bc' as const,
    },
    {
      file: path.join(DATA_DIR, 'Hasil Penilaian AI CIDA PIA 2026 - BI.csv'),
      category: 'BI' as const,
      type: 'bi' as const,
    },
  ];

  for (const { file, category, type } of categoryFiles) {
    console.log(`\n📂 Processing ${category} from ${path.basename(file)}...`);
    const rows = parseCSV(file);
    let catNew = 0, catUpdated = 0, catSkipped = 0;

    for (const row of rows) {
      const subId = parseInt(row['ID_Sub'] ?? '');
      if (isNaN(subId)) { catSkipped++; continue; }

      // Only import if in LOLOS
      if (!lolosMap.has(subId)) { catSkipped++; continue; }

      const lolosRow = lolosMap.get(subId)!;

      // Build proposer name (different key for BI)
      const proposerName = type === 'bi'
        ? (row['Nama_Inovator'] ?? lolosRow['Name'] ?? '')
        : (row['Name'] ?? lolosRow['Name'] ?? '');

      // Enrichment lookup
      const enrichKey = proposerName.trim().toLowerCase();
      const enrichRow = enrichmentMap.get(enrichKey);
      if (enrichRow) statsEnriched++;

      // Team members
      const teamMembers = collectTeamMembers(row);

      // Scores
      const scores = {
        aiCidaViability: parseScore(row['Viability']),
        aiCidaFeasibility: parseScore(row['Feasibility']),
        aiCidaDesirability: parseScore(row['Desirability']),
        aiCidaSolvability: parseScore(row['Solvability']),
        aiCidaProblemUrgency: parseScore(row['Problem_urgency']),
        aiCidaUniqueness: parseScore(row['Uniqueness']),
        aiCidaAverage: parseScore(row['Average']),
        aiCidaTotal: parseScore(row['Total']),
        aiCidaAverageSkor: parseScore(row['Average Skor']),
      };

      // Build proposal data
      const title = type === 'bi'
        ? (row['Nama_Inovasi'] ?? lolosRow['Nama_Solusi'] ?? 'Untitled')
        : (row['Nama_Solusi'] ?? lolosRow['Nama_Solusi'] ?? 'Untitled');

      const summary = type === 'bi'
        ? (row['Inovasi_Diusulkan'] ?? null)
        : (row['Kembangkan_Ide'] ?? lolosRow['Kembangkan_Ide'] ?? null);

      const proposalData: Partial<schema.NewProposal> = {
        competitionId: activeComp.id,
        externalSubId: subId,
        externalId: `CIDA-${subId}`,
        title,
        proposerName,
        proposerEmail: (type === 'bi' ? row['EMAIL'] : row['Email']) ?? lolosRow['Email'] ?? null,
        proposerOrg: enrichRow?.['Division'] ?? null,
        category,
        regionCenter: category === 'WILAYAH' ? (row['Wilayah'] ?? null) : null,
        summary,
        status: 'imported',
        importedBy: coordinatorId,

        // CIDA extended
        whatsapp: row['Whatsapp'] ?? lolosRow['Whatsapp'] ?? null,
        theme: row['Theme'] ?? lolosRow['Theme'] ?? null,
        groupName: (type === 'bi' ? null : row['Group']) ?? lolosRow['Group'] ?? null,
        teamMembers: teamMembers.length > 0 ? teamMembers : null,
        linkProposal: row['Link_Proposal'] ?? lolosRow['Link_Proposal'] ?? null,
        submissionDate: parseSubDate(row['Submission_Date'] ?? lolosRow['Submission_Date']),
        tagging: row['Tagging'] ?? lolosRow['Tagging'] ?? null,
        tagging2: row['Tagging 2'] ?? lolosRow['Tagging 2'] ?? null,
        confirmationMember: row['Konfirmasi Member'] ?? lolosRow['Konfirmasi Member'] ?? null,

        // Scores
        ...scores,

        // Enrichment
        proposerDirectorate: enrichRow?.['Directorate'] ?? null,
        proposerDivision: enrichRow?.['Division'] ?? null,
        proposerDepartment: enrichRow?.['Depertement'] ?? null,
        proposerRegion: enrichRow?.['Region'] ?? null,
        proposerOffice: enrichRow?.['Office'] ?? null,
        proposerUnitKerja: enrichRow?.['Unit Kerja'] ?? null,

        lastSyncedAt: new Date(),
      };

      // BC/PUSAT/WILAYAH specific fields
      if (type === 'bc') {
        Object.assign(proposalData, {
          bcKelompokDibantu: row['Kelompok_Dibantu'] ?? null,
          bcAlasanMemilihMereka: row['Alasan_Memilih_Mereka'] ?? null,
          bcApaYangAndaInginkan: row['Apa_Yang_Anda_Inginkan'] ?? null,
          bcAlasanMemilihAreaBantuan: row['Alasan_Memilih_Area_Bantuan'] ?? null,
          bcMasalahSasaranInovasi: row['Masalah_Sasaran_Inovasi'] ?? null,
          bcIdentifikasiMasalah: row['Identifikasi_Masalah'] ?? null,
          bcDampakNegatifYangMuncul: row['Dampak_Negatif_Yang_Muncul'] ?? null,
          bcDilakukanUntukMenyelesaikanMasalah: row['Dilakukan_Untuk_Menyelesaikan_Masalah'] ?? null,
          bcAlternatifSolusi: row['Alternatif_Solusi'] ?? null,
          bcEksploraSolusi: row['Explorasi_Solusi'] ?? null,
          bcInovasiHarusMemilikiKebaruan: row['Inovasi_Harus_Memiliki_Kebaruan'] ?? null,
          bcDetilCaraKerja: row['Detil_Cara_Kerja'] ?? null,
          bcJelaskanSecaraDetil: row['Jelaskan_Secara_Detil'] ?? null,
          bcMewujudkanSolusi: row['Mewujudkan_Solusi'] ?? null,
          bcSumberDayaDiperlukan: row['Sumber_Daya_Diperlukan'] ?? null,
          bcTargetCapaianFinansial: row['Target_Capaian_Finansial'] ?? null,
          bcTargetCapaianNonFinansial: row['Target_Capaian_Non_Finansial'] ?? null,
          bcSketsaInnovasi: row['Sketsa_Innovasi'] ?? null,
          bcDokumen: row['Dokumen'] ?? null,
        });
      }

      // BI specific fields
      if (type === 'bi') {
        Object.assign(proposalData, {
          biCompany: row['Company'] ?? null,
          biProfession: row['Profession'] ?? null,
          biFungsi: row['Fungsi'] ?? null,
          biSasaranPenggunaInovasi: row['Sasaran_Pengguna_Inovasi'] ?? null,
          biAlasanMemilihSasaran: row['Alasan_Memilih_Sasaran_Pengguna_Inovasi'] ?? null,
          biMasalahDiselesaikan: row['Masalah_Diselesaikan'] ?? null,
          biMasalahPentingKarena: row['Masalah_Penting_Segera_Diselesaikan_Karena'] ?? null,
          biInovasiDiusulkan: row['Inovasi_Diusulkan'] ?? null,
          biKonteksInovasi: row['Konteks_Inovasi'] ?? null,
          biAlasanKonteksInovasi: row['Alasan_Konteks_Inovasi'] ?? null,
          biSolusiSudahAda: row['Solusi_Sudah_Ada_Saat_Ini'] ?? null,
          biInovasiDapatMenyelesaikan: row['Inovasi_Dapat_Menyelesaikan'] ?? null,
          biKeunikanPenyelesaian: row['Keunikan_Peneyelesaian'] ?? null,
          biDenganCara: row['Dengan_Cara'] ?? null,
          biDiwujudkanDenganCara: row['Diwujudkan_Dengan_Cara'] ?? null,
          biSumberDaya: row['Sumber_daya'] ?? null,
          biTargetFinansial: row['Target_Finansial'] ?? null,
          biTargetNonFinansial: row['Target_Non_Finansial'] ?? null,
        });
      }

      if (isDryRun) {
        catNew++;
        continue;
      }

      // ─── Upsert by externalSubId ──────────────────────────────────────────
      const [existing] = await db.select()
        .from(proposals)
        .where(and(
          eq(proposals.competitionId, activeComp.id),
          eq(proposals.externalSubId, subId)
        ))
        .limit(1);

      if (!existing) {
        // INSERT
        await db.insert(proposals).values(proposalData as schema.NewProposal);
        catNew++;
      } else {
        // UPDATE — only source fields, never override work fields
        const oldSource = extractSourceFields({
          title: existing.title,
          summary: existing.summary,
          aiCidaViability: existing.aiCidaViability,
          aiCidaFeasibility: existing.aiCidaFeasibility,
          aiCidaDesirability: existing.aiCidaDesirability,
          aiCidaSolvability: existing.aiCidaSolvability,
          aiCidaProblemUrgency: existing.aiCidaProblemUrgency,
          aiCidaUniqueness: existing.aiCidaUniqueness,
          aiCidaAverage: existing.aiCidaAverage,
          aiCidaTotal: existing.aiCidaTotal,
          aiCidaAverageSkor: existing.aiCidaAverageSkor,
          teamMembers: (existing.teamMembers as string[] | null),
        });
        const newSource = extractSourceFields({
          title: proposalData.title,
          summary: proposalData.summary,
          ...scores,
          teamMembers: teamMembers,
        });

        const changed = sourceFieldsChanged(oldSource, newSource);

        // Check if needs-review flag should be set
        let needsReview = existing.needsReview ?? false;
        if (changed) {
          const advanced = await hasScreeningOrAdvanced(db, existing.id);
          if (advanced) {
            needsReview = true;
            statsNeedsReview++;
            // Audit log
            await client`
              INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, before_json, after_json)
              VALUES (${coordinatorId}, 'System (CIDA Sync)', 'source_data_changed', 'proposal', ${String(existing.id)},
                ${JSON.stringify(oldSource)}, ${JSON.stringify(newSource)})
            `;
          }
        }

        // Update only source fields + enrichment — NOT status/screening/claims
        const updateData: Partial<schema.NewProposal> = {
          title: proposalData.title,
          summary: proposalData.summary,
          proposerName: proposalData.proposerName,
          proposerEmail: proposalData.proposerEmail,
          whatsapp: proposalData.whatsapp,
          theme: proposalData.theme,
          groupName: proposalData.groupName,
          teamMembers: proposalData.teamMembers,
          linkProposal: proposalData.linkProposal,
          submissionDate: proposalData.submissionDate,
          tagging: proposalData.tagging,
          tagging2: proposalData.tagging2,
          confirmationMember: proposalData.confirmationMember,
          ...scores,
          proposerDirectorate: proposalData.proposerDirectorate,
          proposerDivision: proposalData.proposerDivision,
          proposerDepartment: proposalData.proposerDepartment,
          proposerRegion: proposalData.proposerRegion,
          proposerOffice: proposalData.proposerOffice,
          proposerUnitKerja: proposalData.proposerUnitKerja,
          lastSyncedAt: new Date(),
          needsReview,
          updatedAt: new Date(),
        };

        // Also update bc_* / bi_* fields
        if (type === 'bc') {
          Object.assign(updateData, {
            bcKelompokDibantu: proposalData.bcKelompokDibantu,
            bcAlasanMemilihMereka: proposalData.bcAlasanMemilihMereka,
            bcApaYangAndaInginkan: proposalData.bcApaYangAndaInginkan,
            bcAlasanMemilihAreaBantuan: proposalData.bcAlasanMemilihAreaBantuan,
            bcMasalahSasaranInovasi: proposalData.bcMasalahSasaranInovasi,
            bcIdentifikasiMasalah: proposalData.bcIdentifikasiMasalah,
            bcDampakNegatifYangMuncul: proposalData.bcDampakNegatifYangMuncul,
            bcDilakukanUntukMenyelesaikanMasalah: proposalData.bcDilakukanUntukMenyelesaikanMasalah,
            bcAlternatifSolusi: proposalData.bcAlternatifSolusi,
            bcEksploraSolusi: proposalData.bcEksploraSolusi,
            bcInovasiHarusMemilikiKebaruan: proposalData.bcInovasiHarusMemilikiKebaruan,
            bcDetilCaraKerja: proposalData.bcDetilCaraKerja,
            bcJelaskanSecaraDetil: proposalData.bcJelaskanSecaraDetil,
            bcMewujudkanSolusi: proposalData.bcMewujudkanSolusi,
            bcSumberDayaDiperlukan: proposalData.bcSumberDayaDiperlukan,
            bcTargetCapaianFinansial: proposalData.bcTargetCapaianFinansial,
            bcTargetCapaianNonFinansial: proposalData.bcTargetCapaianNonFinansial,
            bcSketsaInnovasi: proposalData.bcSketsaInnovasi,
            bcDokumen: proposalData.bcDokumen,
          });
        }
        if (type === 'bi') {
          Object.assign(updateData, {
            biCompany: proposalData.biCompany,
            biProfession: proposalData.biProfession,
            biFungsi: proposalData.biFungsi,
            biSasaranPenggunaInovasi: proposalData.biSasaranPenggunaInovasi,
            biAlasanMemilihSasaran: proposalData.biAlasanMemilihSasaran,
            biMasalahDiselesaikan: proposalData.biMasalahDiselesaikan,
            biMasalahPentingKarena: proposalData.biMasalahPentingKarena,
            biInovasiDiusulkan: proposalData.biInovasiDiusulkan,
            biKonteksInovasi: proposalData.biKonteksInovasi,
            biAlasanKonteksInovasi: proposalData.biAlasanKonteksInovasi,
            biSolusiSudahAda: proposalData.biSolusiSudahAda,
            biInovasiDapatMenyelesaikan: proposalData.biInovasiDapatMenyelesaikan,
            biKeunikanPenyelesaian: proposalData.biKeunikanPenyelesaian,
            biDenganCara: proposalData.biDenganCara,
            biDiwujudkanDenganCara: proposalData.biDiwujudkanDenganCara,
            biSumberDaya: proposalData.biSumberDaya,
            biTargetFinansial: proposalData.biTargetFinansial,
            biTargetNonFinansial: proposalData.biTargetNonFinansial,
          });
        }

        await db.update(proposals)
          .set(updateData)
          .where(eq(proposals.id, existing.id));

        catUpdated++;
      }
    }

    statsNew += catNew;
    statsUpdated += catUpdated;
    statsSkipped += catSkipped;
    console.log(`   ✅ ${category}: ${catNew} baru, ${catUpdated} diperbarui, ${catSkipped} dilewati`);
  }

  // ─── Final stats ───────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════');
  console.log('📊 HASIL IMPORT:');
  console.log(`   Proposal baru    : ${statsNew}`);
  console.log(`   Diperbarui       : ${statsUpdated}`);
  console.log(`   Dilewati         : ${statsSkipped}`);
  console.log(`   Needs review     : ${statsNeedsReview}`);
  console.log(`   Enriched (match) : ${statsEnriched}`);
  if (isDryRun) console.log('\n⚠️  DRY RUN — tidak ada yang ditulis ke DB');
  console.log('═══════════════════════════════════\n');

  await client.end();
}

main().catch(err => {
  console.error('Import gagal:', err);
  process.exit(1);
});
