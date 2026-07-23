import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from '../lib/db';
import { proposals } from '../lib/db/schema';
import { isNotNull, isNull, and, eq } from 'drizzle-orm';
import { getDocumentProxy, extractText } from 'unpdf';

async function processProposal(proposal: { id: number; link: string | null }) {
  const { id, link } = proposal;
  try {
    const response = await fetch(link!);
    if (!response.ok) {
      return { id, status: 'fail', reason: `Fetch failed: ${response.status} ${response.statusText}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    let text = '';
    try {
      const pdf = await getDocumentProxy(buffer);
      const extracted = await extractText(pdf, { mergePages: true });
      text = extracted.text.trim();
    } catch (parseErr) {
      return { id, status: 'fail', reason: `PDF Parse failed` };
    }

    let isScan = false;
    if (text.length < 100) {
      isScan = true;
      text = '[ERROR: DOKUMEN HASIL SCAN ATAU GAMBAR. TEKS TIDAK DAPAT DIEKSTRAK OTOMATIS.]';
    } else {
      // Remove null bytes \u0000 which cause postgres errors
      text = text.replace(/\0/g, '');
      if (text.length > 80000) {
        text = text.substring(0, 80000) + '\n\n[...TEKS DIPOTONG KARENA TERLALU PANJANG...]';
      }
    }

    await db
      .update(proposals)
      .set({ resubmitDocumentText: text })
      .where(eq(proposals.id, id));

    return { id, status: 'success', isScan };
  } catch (err) {
    return { id, status: 'fail', reason: `Unhandled error` };
  }
}

async function run() {
  console.log('Fetching proposals with resubmission links...');
  const targetProposals = await db
    .select({
      id: proposals.id,
      link: proposals.linkResubmitProposal,
    })
    .from(proposals)
    .where(
      and(
        isNotNull(proposals.linkResubmitProposal),
        isNull(proposals.resubmitDocumentText)
      )
    );

  console.log(`Found ${targetProposals.length} proposals to process.`);

  let successCount = 0;
  let failCount = 0;
  let emptyScanCount = 0;

  const CONCURRENCY = 20;
  for (let i = 0; i < targetProposals.length; i += CONCURRENCY) {
    const chunk = targetProposals.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(p => processProposal(p)));
    
    for (const res of results) {
      if (res.status === 'success') {
        successCount++;
        if (res.isScan) emptyScanCount++;
      } else {
        failCount++;
        console.error(`[ID ${res.id}] Failed: ${res.reason}`);
      }
    }

    console.log(`Processed ${Math.min(i + CONCURRENCY, targetProposals.length)}/${targetProposals.length} ... (Success: ${successCount}, Fail: ${failCount}, Scan: ${emptyScanCount})`);
  }

  console.log('--- BATCH EXTRACTION COMPLETE ---');
  console.log(`Total Target: ${targetProposals.length}`);
  console.log(`Success (Extracted): ${successCount}`);
  console.log(`Empty/Scanned (Marked as error in text): ${emptyScanCount}`);
  console.log(`Failed (Fetch/Parse error): ${failCount}`);
  
  process.exit(0);
}

run().catch((e) => {
  console.error('Fatal Error:', e);
  process.exit(1);
});
