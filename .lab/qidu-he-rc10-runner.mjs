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
const out = '/tmp/qidu-he-rc10-wrapper-fixed.mjs';
await fs.writeFile(out, s, 'utf8');
console.log('rc10 wrapper syntax preprocessed');
await import(`${pathToFileURL(out).href}?v=${Date.now()}`);
