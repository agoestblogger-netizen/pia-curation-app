import { config } from 'dotenv';
config({ path: '.env.local' });
import { getActiveCompetition } from './app/actions/competitions';

async function main() {
  const comp = await getActiveCompetition();
  console.log("Active comp:", comp?.id);
}
main();
