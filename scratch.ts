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
  const files = [
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Breakthrough Innovation.csv",
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Business Case.csv",
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Regional - Kantor Pusat.csv",
    "data/resubmission/Proposal Resubmission - PIA Season 12 - Regional - Kantor Wilayah.csv"
  ];

  let totalIds = 0;
  const ids: number[] = [];
  const mapTitle: Record<number, string> = {};

  for (const f of files) {
    if (!fs.existsSync(f)) {
       console.log("Missing file: " + f);
       continue;
    }
    const rows = parseCSV(f);
    for (const r of rows) {
      const id = parseInt(r['ID'] || '');
      if (!isNaN(id)) {
        ids.push(id);
        mapTitle[id] = r['nama pada solusi tersebut'];
      }
    }
  }

  console.log(`Found ${ids.length} valid IDs in CSVs.`);

  // Query DB
  const dbProposals = await db.select({
    id: proposals.id,
    externalSubId: proposals.externalSubId,
    title: proposals.title
  }).from(proposals).where(inArray(proposals.externalSubId, ids));

  console.log(`Matched ${dbProposals.length} rows in database via external_sub_id.`);

  let missing = 0;
  const foundIds = new Set(dbProposals.map(p => p.externalSubId));
  for (const id of ids) {
    if (!foundIds.has(id)) {
      missing++;
      if (missing <= 5) console.log(`Missing ID in DB: ${id}`);
    }
  }

  console.log(`\nSample comparisons (ID, CSV 'nama pada solusi tersebut' vs DB 'title'):`);
  for (let i = 0; i < Math.min(5, dbProposals.length); i++) {
    const p = dbProposals[i];
    console.log(`ID: ${p.externalSubId}`);
    console.log(` CSV: ${mapTitle[p.externalSubId as number]}`);
    console.log(` DB : ${p.title}`);
    console.log(`---`);
  }

  process.exit(0);
}

run().catch(console.error);
