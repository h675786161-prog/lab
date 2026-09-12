import fs from 'node:fs/promises';
import path from 'node:path';

// Import executes the exact-card benchmark and writes report.md/results.json.
await import('./qidu-card-model-bench.mjs');

const out = process.env.LAB_OUT || 'bench-evidence/qidu-card-v0412';
const reportPath = path.join(out, 'report.md');
const report = await fs.readFile(reportPath, 'utf8');
console.log('\n===== QIDU_OOC_FULL_REPORT_BEGIN =====\n');
console.log(report);
console.log('\n===== QIDU_OOC_FULL_REPORT_END =====\n');
