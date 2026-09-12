import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

export const EXPECTED_COMPACT_SHA256 = '126b403a70c27a53fbc6ad31ac67808c9e7291a1e23d8d00b9d8225daa36764b';
export const EXPECTED_PACKED_SHA256 = '0323df7c0cfc250854df3023b25d3d60c75c9950a7d25dc672db43d6d1792b9a';
export const EXPECTED_RAW_SHA256 = '27fdfc545385d88966e01d09e105852424813e3103aaae6d2ca3bed008d05c54';
export const EXPECTED_PACKED_CHARS = 63400;

async function readExactPart(packedDir, part) {
  if (part !== 5 && part !== 7) {
    return (await fs.readFile(path.join(packedDir, `part-${String(part).padStart(2, '0')}.txt`), 'utf8')).trim();
  }
  const subdir = path.join(packedDir, `part-${String(part).padStart(2, '0')}`);
  const count = 8;
  const pieces = [];
  for (let i = 0; i < count; i++) {
    pieces.push((await fs.readFile(path.join(subdir, `${String(i).padStart(2, '0')}.txt`), 'utf8')).trim());
  }
  return pieces.join('');
}

export async function loadV0412Card(workspace = process.env.GITHUB_WORKSPACE || process.cwd()) {
  const packedDir = path.join(workspace, 'fixtures/qidu-card/v0412-packed');
  const chunks = [];
  for (let i = 0; i < 8; i++) chunks.push(await readExactPart(packedDir, i));
  const packed = chunks.join('');
  const packedSha256 = crypto.createHash('sha256').update(packed, 'utf8').digest('hex');
  if (packed.length !== EXPECTED_PACKED_CHARS) throw new Error(`Packed candidate length mismatch: ${packed.length}`);
  if (packedSha256 !== EXPECTED_PACKED_SHA256) throw new Error(`Packed candidate hash mismatch: ${packedSha256}`);

  const rawSource = zlib.gunzipSync(Buffer.from(packed, 'base64'));
  const rawSha256 = crypto.createHash('sha256').update(rawSource).digest('hex');
  if (rawSha256 !== EXPECTED_RAW_SHA256) throw new Error(`Raw candidate hash mismatch: ${rawSha256}`);

  const card = JSON.parse(rawSource.toString('utf8'));
  const raw = Buffer.from(JSON.stringify(card), 'utf8');
  const compactSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (compactSha256 !== EXPECTED_COMPACT_SHA256) throw new Error(`Compact candidate hash mismatch: ${compactSha256}`);
  return { card, raw, compactSha256, packedSha256, rawSha256 };
}

export function entryMap(card) {
  return Object.fromEntries((card.data.character_book?.entries || []).map(e => [String(e.name || ''), String(e.content || '')]));
}
