const fs = require('fs');
const data = require('../proposals_db.json');

let md = '# Database Proposals\n\n';
md += '| ID | Sub ID | Title | Category | Region Center | Status | Verdict |\n';
md += '|---|---|---|---|---|---|---|\n';

for (const p of data) {
  md += `| ${p.id} | ${p.subId || ''} | ${p.title} | ${p.category || ''} | ${p.regionCenter || ''} | ${p.status || ''} | ${p.verdict || ''} |\n`;
}

fs.writeFileSync('/Users/macbook/.gemini/antigravity-ide/brain/6e83a304-25a1-4a66-97ce-3d2550e9a498/proposals_db.md', md);
