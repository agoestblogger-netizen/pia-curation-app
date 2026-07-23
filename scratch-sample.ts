import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import { db } from './lib/db';
import { proposals } from './lib/db/schema';
import { inArray } from 'drizzle-orm';

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

async function run() {
  const idsToTest = [6487, 7224, 6739, 6729, 6759];
  const files = [
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Breakthrough Innovation.csv",
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Business Case.csv",
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Regional - Kantor Pusat.csv",
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Regional - Kantor Wilayah.csv"
  ];
  
  let targetRows: Record<string, string>[] = [];
  for (const f of files) {
      const rows = parseCSV(f);
      targetRows = targetRows.concat(rows.filter(r => idsToTest.includes(parseInt(r['ID'] || ''))));
  }
  
  const dbProposals = await db.select().from(proposals).where(inArray(proposals.externalSubId, idsToTest));
  const dbMap = new Map(dbProposals.map(p => [p.externalSubId, p]));

  for (const row of targetRows) {
    const id = parseInt(row['ID']);
    const p = dbMap.get(id);
    if (!p) continue;

    console.log(`\n======================================================`);
    console.log(`PROPOSAL ID: ${id}`);
    console.log(`TITLE: ${p.title}`);
    console.log(`======================================================\n`);

    if (id === 6487) {
      console.log(`[KELOMPOK A - METADATA CHECK]`);
      const oldTitle = p.title;
      const newTitle = row['nama pada solusi tersebut'];
      console.log(`- Title: LAMA="${oldTitle}" | BARU="${newTitle}" -> ${oldTitle === newTitle ? 'SAMA (No-op)' : 'BEDA (Abaikan Baru)'}`);
      
      const oldTheme = p.theme;
      const newTheme = row['Sub-Tema'];
      console.log(`- Theme: LAMA="${oldTheme}" | BARU="${newTheme}" -> ${oldTheme === newTheme ? 'SAMA (No-op)' : 'BEDA (Abaikan Baru)'}`);
      console.log(`\n`);
    }

    console.log(`[KELOMPOK B - NARASI (OVERWRITE LANGSUNG)]`);
    const oldMasalah = p.biMasalahDiselesaikan || p.bcIdentifikasiMasalah || p.summary || '';
    const newMasalah = row['Identifikasi Masalah'] || row['Masalah diselesaikan'] || '';
    
    console.log(`\n--- IDENTIFIKASI MASALAH ---`);
    console.log(`>>> TEKS LAMA:\n${oldMasalah}`);
    console.log(`>>> TEKS BARU:\n${newMasalah}`);
    
    // OVERWRITE LOGIC
    let combinedMasalah = newMasalah || oldMasalah; // Kalau baru kosong, tetap pakai lama
    
    console.log(`>>> HASIL AKHIR:\n${combinedMasalah}`);

    const oldSolusi = p.biInovasiDiusulkan || p.bcAlternatifSolusi || p.formattedTexts || '';
    const newSolusi = row['Solusi Alternatif'] || row['untuk menyelesaikan masalah'] || '';
    
    console.log(`\n--- SOLUSI ALTERNATIF ---`);
    console.log(`>>> TEKS LAMA:\n${oldSolusi}`);
    console.log(`>>> TEKS BARU:\n${newSolusi}`);
    
    // OVERWRITE LOGIC
    let combinedSolusi = newSolusi || oldSolusi;
    
    console.log(`>>> HASIL AKHIR:\n${combinedSolusi}\n`);
  }
  process.exit(0);
}

run().catch(console.error);
