import fs from 'fs';

function normalize(str: string): string {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/["']/g, '') // remove quotes
    .replace(/\s+/g, ' ') // normalize spaces
    .replace(/[^\w\s]/g, '') // remove punctuation
    .trim();
}

async function run() {
  const lines = fs.readFileSync('data/resubmission/metadata_diffs.txt', 'utf-8').split('\n').filter(l => l.trim().length > 0);
  const significantDiffs = [];
  let formatDiffsCount = 0;
  
  for (const line of lines) {
    const match = line.match(/ID \d+ \| (.+?) \| LAMA: "(.*)" \| BARU: "(.*)"/);
    if (match) {
      const field = match[1];
      const lama = match[2];
      const baru = match[3];
      
      let isFormatDiff = false;
      const lNorm = normalize(lama);
      const bNorm = normalize(baru);
      
      if (field.includes('Category')) {
          if (
             (lNorm === 'bi' && bNorm === 'breakthrough innovation') ||
             (lNorm === 'bc' && bNorm === 'business case') ||
             (lNorm === 'pusat' && bNorm === 'kantor pusat') ||
             (lNorm === 'pusat' && bNorm === 'regional kantor pusat') ||
             (lNorm === 'wilayah' && bNorm === 'kantor wilayah') ||
             (lNorm === 'wilayah' && bNorm === 'regional kantor wilayah') ||
             lNorm === bNorm
          ) {
              isFormatDiff = true;
          }
      } else {
          if (lNorm === bNorm) {
              isFormatDiff = true;
          }
      }
      
      if (isFormatDiff) {
          formatDiffsCount++;
      } else {
          significantDiffs.push(line);
      }
    }
  }
  
  console.log(`Out of ${lines.length} diffs, ${formatDiffsCount} were purely format/case/quotes/category-mapping.`);
  console.log(`Found ${significantDiffs.length} SIGNIFICANT differences.`);
  if (significantDiffs.length > 0) {
    console.log("\nSample of significant differences (Top 20):");
    significantDiffs.slice(0, 20).forEach(d => console.log(d));
  }
}
run();
