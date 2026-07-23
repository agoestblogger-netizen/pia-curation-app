import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './lib/db';
import { proposals } from './lib/db/schema';
import { inArray, isNotNull } from 'drizzle-orm';

async function run() {
  const props = await db.select({
    id: proposals.id,
    externalSubId: proposals.externalSubId,
    linkProposal: proposals.linkProposal,
    linkResubmitProposal: proposals.linkResubmitProposal,
    linkSuratOrisinalitas: proposals.linkSuratOrisinalitas,
  }).from(proposals).where(isNotNull(proposals.linkResubmitProposal)).limit(3);

  console.log("URL Examples:");
  props.forEach(p => {
    console.log(`\nID (External): ${p.externalSubId}`);
    console.log(`Link Fase 1 (Previewable): ${p.linkProposal}`);
    console.log(`Link Resubmit (Downloading): ${p.linkResubmitProposal}`);
    console.log(`Link Surat Orisinalitas: ${p.linkSuratOrisinalitas}`);
  });

  process.exit(0);
}
run();
