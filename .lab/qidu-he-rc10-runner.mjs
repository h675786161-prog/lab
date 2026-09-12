import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const src = '.lab/qidu-he-rc10-real-st-glm.mjs';
let s = await fs.readFile(src, 'utf8');
const fixes = [
  [
    "failures.push(`${row.id}/${turnName}: obvious user-agency leak ${re}`);",
    "failures.push(row.id + '/' + turnName + ': obvious user-agency leak ' + re);",
  ],
  [
    "failures.push(`${row.id}/${turnName}: undeclared user-agency leak ${c.re}`);",
    "failures.push(row.id + '/' + turnName + ': undeclared user-agency leak ' + c.re);",
  ],
];
for (const [from, to] of fixes) {
  if (!s.includes(from)) throw new Error(`rc10 runner fix target missing: ${from}`);
  s = s.replace(from, to);
}

const sourceLoad = "let source = await fs.readFile(sourcePath, 'utf8');";
if (!s.includes(sourceLoad)) throw new Error('rc10 runner source-load anchor missing');
s = s.replace(
  sourceLoad,
  `${sourceLoad}\nsource = source.replace(\"failures.push(\\\`${'${row.id}/${turnName}: obvious user-agency leak ${re}'}\\\`);\", \"failures.push(row.id + '/' + turnName + ': obvious user-agency leak ' + re);\");`,
);

const out = '/tmp/qidu-he-rc10-wrapper-fixed.mjs';
await fs.writeFile(out, s, 'utf8');
console.log('rc10 wrapper syntax and base-source agency anchor preprocessed');

try {
  await import(`${pathToFileURL(out).href}?v=${Date.now()}`);
} catch (error) {
  const text = String(error?.stack || error?.message || error);
  const blocked = /Service Unavailable|insufficient_user_quota|账户额度不足|model_not_found|no available channel|no visible completion:.*(?:Service Unavailable|quota)/is.test(text);
  if (!blocked) throw error;
  const outDir = process.env.LAB_OUT || 'bench-evidence/qidu-he-rc10-real-st-glm';
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(`${outDir}/rc10-status.json`, JSON.stringify({
    status: 'blocked_upstream',
    model: process.env.GLM_MODEL || null,
    upstream: process.env.GLM_API || null,
    rpm: Number(process.env.RPM || 12),
    reason: text.slice(0, 3000),
  }, null, 2));
  console.error('RC10_BLOCKED_UPSTREAM', text.slice(0, 1200));
  process.exitCode = 75;
}
