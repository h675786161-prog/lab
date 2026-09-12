import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

export const EXPECTED_COMPACT_SHA256 = '126b403a70c27a53fbc6ad31ac67808c9e7291a1e23d8d00b9d8225daa36764b';

export async function loadV0412Card(workspace = process.env.GITHUB_WORKSPACE || process.cwd()) {
  const basePackedPath = path.join(workspace, 'fixtures/qidu-card/card-v0.4.11-lab.json.gz.b64');
  const patchPaths = [
    path.join(workspace, 'fixtures/qidu-card/v0412-patch-top.json'),
    path.join(workspace, 'fixtures/qidu-card/v0412-patch-a.json'),
    path.join(workspace, 'fixtures/qidu-card/v0412-patch-b.json'),
  ];
  const basePacked = (await fs.readFile(basePackedPath, 'utf8')).trim();
  const baseRaw = zlib.gunzipSync(Buffer.from(basePacked, 'base64'));
  const card = JSON.parse(baseRaw.toString('utf8'));
  for (const patchPath of patchPaths) {
    const patch = JSON.parse(await fs.readFile(patchPath, 'utf8'));
    if (patch.data) Object.assign(card.data, patch.data);
    for (const [index, entry] of Object.entries(patch.entries || {})) {
      card.data.character_book.entries[Number(index)] = entry;
    }
  }
  const raw = Buffer.from(JSON.stringify(card), 'utf8');
  const compactSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  return { card, raw, compactSha256 };
}

export function entryMap(card) {
  return Object.fromEntries((card.data.character_book?.entries || []).map(e => [String(e.name || ''), String(e.content || '')]));
}
