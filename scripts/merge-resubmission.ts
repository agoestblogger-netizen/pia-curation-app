import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import { db } from '../lib/db';
import { proposals } from '../lib/db/schema';
import { inArray, eq } from 'drizzle-orm';

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

function parseScore(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  // Replace comma with dot for decimals (e.g., 75,5 -> 75.5)
  const n = parseFloat(val.trim().replace(',', '.'));
  return isNaN(n) ? null : n;
}

async function run() {
  console.log("=== MERGE RESUBMISSION START ===");
  
  const lolosFile = "data/resubmission/Proposal Resubmission - PIA Season 12 - Lolos Customer-Problem Fit.csv";
  const filesPass2 = [
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Breakthrough Innovation.csv",
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Business Case.csv",
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Regional - Kantor Pusat.csv",
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Regional - Kantor Wilayah.csv"
  ];
  
  console.log("Reading CSV files...");
  const lolosRows = parseCSV(lolosFile);
  let pass2Rows: Record<string, string>[] = [];
  for (const f of filesPass2) {
      const rows = parseCSV(f);
      pass2Rows = pass2Rows.concat(rows);
  }
  
  // Fetch ALL proposals to modify them in memory before saving
  const allProposals = await db.select().from(proposals);
  const pMap = new Map(allProposals.map(p => [p.externalSubId, p]));
  
  let metadataDiffs: string[] = [];
  let updatedCountPass1 = 0;
  let updatedCountPass2 = 0;

  console.log(`\n--- PASS 1: Metadatas (${lolosRows.length} rows) ---`);
  for (const row of lolosRows) {
    const id = parseInt(row['ID'] || row['ID_Sub'] || '');
    if (isNaN(id)) continue;
    
    const p = pMap.get(id);
    if (!p) continue;
    
    // Group A checks
    const oldTitle = p.title;
    const newTitle = row['Nama_Solusi'] || row['nama pada solusi tersebut'];
    if (newTitle && newTitle !== oldTitle) {
      metadataDiffs.push(`ID ${id} | Title | LAMA: "${oldTitle}" | BARU: "${newTitle}"`);
    }

    const oldCategory = p.category;
    let newCategory = row['Group'] || row['Kategori'];
    if (newCategory === 'Business Case') newCategory = 'BC';
    if (newCategory === 'Business Innovation') newCategory = 'BI';
    if (newCategory === 'Kantor Pusat' || newCategory === 'Pusat') newCategory = 'PUSAT';
    if (newCategory === 'Kantor Wilayah' || newCategory === 'Wilayah') newCategory = 'WILAYAH';
    if (newCategory && newCategory !== oldCategory) {
      metadataDiffs.push(`ID ${id} | Category | LAMA: "${oldCategory}" | BARU: "${newCategory}"`);
    }
    
    const oldTheme = p.theme;
    const newTheme = row['Theme'] || row['Sub-Tema'];
    if (newTheme && newTheme !== oldTheme) {
      metadataDiffs.push(`ID ${id} | Theme | LAMA: "${oldTheme}" | BARU: "${newTheme}"`);
    }
    
    // Pass 1 just checks Group A, no DB modification for Group A except maybe tracking differences.
    updatedCountPass1++;
  }
  
  console.log(`\n--- PASS 2: Narration, Scores, Links (${pass2Rows.length} rows) ---`);
  for (const row of pass2Rows) {
    const id = parseInt(row['ID']);
    if (isNaN(id)) continue;
    
    const p = pMap.get(id);
    if (!p) continue;
    
    // Metadata diffs from pass 2
    const oldTitle = p.title;
    const newTitle = row['nama pada solusi tersebut'];
    if (newTitle && newTitle !== oldTitle) {
      metadataDiffs.push(`ID ${id} | Title (Pass2) | LAMA: "${oldTitle}" | BARU: "${newTitle}"`);
    }
    
    // GROUP B - Narasi (Overwrite)
    const updateData: Partial<typeof proposals.$inferInsert> = {};
    
    // We map CSV headers to db fields
    if (row['Identifikasi Masalah'] || row['Masalah diselesaikan']) {
      updateData.bcIdentifikasiMasalah = row['Identifikasi Masalah'] || p.bcIdentifikasiMasalah;
      updateData.biMasalahDiselesaikan = row['Masalah diselesaikan'] || p.biMasalahDiselesaikan;
      updateData.summary = row['Identifikasi Masalah'] || row['Masalah diselesaikan'] || p.summary; // Overwrite summary as well?
    }
    
    if (row['Solusi Alternatif'] || row['untuk menyelesaikan masalah']) {
      updateData.bcAlternatifSolusi = row['Solusi Alternatif'] || p.bcAlternatifSolusi;
      updateData.biInovasiDiusulkan = row['untuk menyelesaikan masalah'] || p.biInovasiDiusulkan;
    }
    
    // Map other narration fields if needed...
    if (row['Kembangkan ide solusi']) updateData.bcEksplorasiSolusi = row['Kembangkan ide solusi'];
    if (row['bagaimana solusi inovatif']) updateData.bcInovasiHarusMemilikiKebaruan = row['bagaimana solusi inovatif'];
    
    // GROUP C - Scores (Overwrite)
    if (row['viability'] !== undefined) updateData.aiCidaViability = parseScore(row['viability']);
    if (row['feasibility'] !== undefined) updateData.aiCidaFeasibility = parseScore(row['feasibility']);
    if (row['desirability'] !== undefined) updateData.aiCidaDesirability = parseScore(row['desirability']);
    if (row['solvability'] !== undefined) updateData.aiCidaSolvability = parseScore(row['solvability']);
    if (row['problem_urgency'] !== undefined) updateData.aiCidaProblemUrgency = parseScore(row['problem_urgency']);
    if (row['uniqueness'] !== undefined) updateData.aiCidaUniqueness = parseScore(row['uniqueness']);
    if (row['average'] !== undefined) updateData.aiCidaAverage = parseScore(row['average']);

    // GROUP D - Links
    if (row['Link Resubmit Proposal']) updateData.linkResubmitProposal = row['Link Resubmit Proposal'];
    if (row['Link Surat Pernyataan Orisinalitas']) updateData.linkSuratOrisinalitas = row['Link Surat Pernyataan Orisinalitas'];
    
    const newLink1 = row['Link Proposal Fase 1'];
    if (newLink1) {
      if (!p.linkProposal) {
        updateData.linkProposal = newLink1;
      } else if (p.linkProposal !== newLink1) {
        metadataDiffs.push(`ID ${id} | Link Proposal | LAMA: "${p.linkProposal}" | BARU: "${newLink1}"`);
      }
    }
    
    if (Object.keys(updateData).length > 0) {
      await db.update(proposals)
        .set(updateData)
        .where(eq(proposals.id, p.id));
      updatedCountPass2++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Pass 1 processed: ${updatedCountPass1} rows (No modifications, only diffs).`);
  console.log(`Pass 2 modified: ${updatedCountPass2} rows (Overwrote narration, scores, links).`);
  
  if (metadataDiffs.length > 0) {
    fs.writeFileSync('data/resubmission/metadata_diffs.txt', metadataDiffs.join('\n'));
    console.log(`Found ${metadataDiffs.length} metadata differences. Written to 'data/resubmission/metadata_diffs.txt'.`);
  }
  
  process.exit(0);
}

run().catch(console.error);
