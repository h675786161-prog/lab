import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.env.GITHUB_WORKSPACE || process.cwd();
const assetDir = path.join(root, '.lab', 'assets');

const chunks = [];
for (let i = 1; i <= 9; i++) {
  let chunk = (await fs.readFile(path.join(assetDir, `guide-hero-hq.b64.${i}`), 'utf8')).replace(/\s+/g, '');
  // Chunks 1-8 are fixed at 18k chars. Trim any accidental upload suffix.
  if (i < 9) chunk = chunk.slice(0, 18000);
  chunks.push(chunk);
}

const encoded = chunks.join('');
if (encoded.length !== 154744) {
  throw new Error(`HQ hero base64 length mismatch: ${encoded.length}`);
}

const bytes = Buffer.from(encoded, 'base64');
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
if (sha256 !== 'dc71e5dbe0269f21b62127dd1d78278c4b733877f4c9f3bae3c91d663e171950') {
  throw new Error(`HQ hero checksum mismatch: ${sha256}`);
}

await fs.writeFile(path.join(assetDir, 'world-backstage-guide-hero.webp'), bytes);
console.log(`HQ approved hero restored: ${bytes.length} bytes`);
