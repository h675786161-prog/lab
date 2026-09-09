import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.env.GITHUB_WORKSPACE || process.cwd();
const assetDir = path.join(root, '.lab', 'assets');
const chunks = await Promise.all([
  fs.readFile(path.join(assetDir, 'guide-hero.b64.1'), 'utf8'),
  fs.readFile(path.join(assetDir, 'guide-hero.b64.tail'), 'utf8'),
]);
const bytes = Buffer.from(chunks.join('').replace(/\s+/g,''), 'base64');
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
if (sha256 !== 'ad8030cc75a4c63f26eb4798b9617aa4d02eabb56be9acfb263527ff87c05a34') {
  throw new Error(`approved hero checksum mismatch: ${sha256}`);
}
await fs.writeFile(path.join(assetDir, 'world-backstage-guide-hero.webp'), bytes);
console.log(`approved hero restored: ${bytes.length} bytes`);
