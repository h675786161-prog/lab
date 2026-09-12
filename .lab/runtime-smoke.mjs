import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, 'fixtures', 'f7d');
const EXPECTED_SHA = 'd85a240e3ada1300349ba205149e936346da2bc4d7746e26e84d5f76e3f8d982';
const EXPECTED_NAME = '永远的7日之都｜七日轮回文本互动';
const OUT = process.env.LAB_EVIDENCE_DIR || path.join(ROOT, 'lab-evidence');
const baseUrl = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';

await fs.mkdir(OUT, { recursive: true });
const chunkNames = (await fs.readdir(FIXTURE_DIR)).filter(x => /^card\.\d+\.b64$/.test(x)).sort();
if (!chunkNames.length) throw new Error('F7D fixture chunks are missing');
const b64 = (await Promise.all(chunkNames.map(x => fs.readFile(path.join(FIXTURE_DIR, x), 'utf8')))).join('');
const cardBuffer = zlib.gunzipSync(Buffer.from(b64, 'base64'));
const sha = crypto.createHash('sha256').update(cardBuffer).digest('hex');
if (sha !== EXPECTED_SHA) throw new Error(`F7D card SHA mismatch: ${sha}`);
const cardText = cardBuffer.toString('utf8');
const card = JSON.parse(cardText);

const preflight = {
  sha256: sha,
  name: card?.data?.name || card?.name,
  spec: card?.spec,
  spec_version: card?.spec_version,
  entries: card?.data?.character_book?.entries?.length ?? null,
  regex_scripts: card?.data?.extensions?.regex_scripts?.length ?? null,
  creator: card?.data?.creator ?? null,
  version: card?.data?.character_version ?? null,
};
if (preflight.name !== EXPECTED_NAME) throw new Error(`Unexpected card name: ${preflight.name}`);
if (preflight.spec !== 'chara_card_v3') throw new Error(`Unexpected spec: ${preflight.spec}`);
if (preflight.entries !== 55) throw new Error(`Expected 55 lore entries, got ${preflight.entries}`);
if (preflight.regex_scripts !== 2) throw new Error(`Expected 2 regex scripts, got ${preflight.regex_scripts}`);
if (preflight.version !== '0.4.4-lab') throw new Error(`Unexpected version: ${preflight.version}`);
await fs.writeFile(path.join(OUT, 'f7d-preflight.json'), JSON.stringify(preflight, null, 2));

const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.LAB_CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

let report = { preflight, pageErrors, consoleErrors };
try {
  const nav = await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2500);
  if (!nav || nav.status() >= 400) throw new Error(`SillyTavern HTTP status ${nav?.status()}`);

  const importResult = await page.evaluate(async ({ cardText }) => {
    const form = new FormData();
    form.set('file_type', 'json');
    form.set('avatar', new File([cardText], 'f7d-v044.json', { type: 'application/json' }));
    const res = await fetch('/api/characters/import', { method: 'POST', body: form });
    return { status: res.status, ok: res.ok, text: await res.text() };
  }, { cardText });
  if (!importResult.ok) throw new Error(`Character import failed: ${JSON.stringify(importResult)}`);

  const allResult = await page.evaluate(async () => {
    const res = await fetch('/api/characters/all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, ok: res.ok, text: text.slice(0, 1000), json };
  });
  if (!allResult.ok || !Array.isArray(allResult.json)) {
    throw new Error(`Character list failed: ${JSON.stringify({ status: allResult.status, text: allResult.text })}`);
  }

  const found = allResult.json.find(x => (x?.data?.name || x?.name) === EXPECTED_NAME);
  if (!found) throw new Error('Imported card not found in /api/characters/all');
  let parsed = found;
  if (!found?.data?.character_book && typeof found?.json_data === 'string') {
    try { parsed = JSON.parse(found.json_data); } catch {}
  }

  const lore = parsed?.data?.character_book?.entries || [];
  const readback = {
    name: parsed?.data?.name || parsed?.name,
    creator: parsed?.data?.creator ?? null,
    version: parsed?.data?.character_version ?? null,
    entries: lore.length,
    regex_scripts: parsed?.data?.extensions?.regex_scripts?.length ?? null,
    has_post_history_rules: String(parsed?.data?.post_history_instructions || '').includes('七都项目每轮运行规则'),
    has_state_protocol: lore.some(e => String(e?.content || '').includes('<f7d_state>')),
    has_state_first: String(parsed?.data?.post_history_instructions || '').includes('状态先提交'),
    has_atomic_settlement: String(parsed?.data?.post_history_instructions || '').includes('自动结算原子性'),
    has_day4_harbor: lore.some(e => String(e?.content || '').includes('DAY4_HARBOR')),
    has_sybilla_split: lore.some(e => String(e?.content || '').includes('sybilla_condition_obtained')) && lore.some(e => String(e?.content || '').includes('sybilla_rescued')),
    has_ann: lore.some(e => String(e?.name || e?.comment || '').includes('安')),
    has_hiro: lore.some(e => String(e?.name || e?.comment || '').includes('希罗')),
  };

  if (readback.entries !== 55) throw new Error(`Readback lore count mismatch: ${readback.entries}`);
  if (readback.regex_scripts !== 2) throw new Error(`Readback regex count mismatch: ${readback.regex_scripts}`);
  if (readback.version !== '0.4.4-lab') throw new Error(`Readback version mismatch: ${readback.version}`);
  if (!readback.has_post_history_rules || !readback.has_state_protocol || !readback.has_state_first || !readback.has_atomic_settlement || !readback.has_day4_harbor || !readback.has_sybilla_split) {
    throw new Error(`Readback lost v0.4.4 runtime rules: ${JSON.stringify(readback)}`);
  }

  let uiNameVisible = false;
  try {
    const button = page.locator('#rm_button_characters');
    if (await button.count()) {
      await button.first().click({ timeout: 5000 });
      await page.waitForTimeout(1200);
    }
    uiNameVisible = await page.getByText(EXPECTED_NAME, { exact: false }).first().isVisible().catch(() => false);
  } catch {}

  await page.screenshot({ path: path.join(OUT, 'f7d-after-import.png'), fullPage: true });
  report = { ...report, url: page.url(), importResult, readback, uiNameVisible, pageErrors, consoleErrors };
  if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
} finally {
  await fs.writeFile(path.join(OUT, 'f7d-runtime-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
