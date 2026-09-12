import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const evidenceDir = process.env.LAB_EVIDENCE_DIR || 'lab-evidence';
const packedPath = path.join(process.env.GITHUB_WORKSPACE || process.cwd(), 'fixtures/qidu-card/card-v0.4.11-lab.json.gz.b64');
const reportPath = path.join(evidenceDir, 'qidu-card-runtime-report.json');

await fs.mkdir(evidenceDir, { recursive: true });
const zlib = await import('node:zlib');
const packed = (await fs.readFile(packedPath, 'utf8')).trim();
const raw = zlib.gunzipSync(Buffer.from(packed, 'base64'));
const card = JSON.parse(raw.toString('utf8'));
const expectedName = card?.data?.name || card?.name;
const entries = card?.data?.character_book?.entries || [];

const staticChecks = {
  specV3: card.spec === 'chara_card_v3' && card.spec_version === '3.0',
  version: card?.data?.character_version === '0.4.11-lab',
  entryCount: entries.length >= 40,
  annNumericAffinity: JSON.stringify(card).includes('"affection":0') && JSON.stringify(card).includes('ANN_CORE_30'),
  openingDoesNotPrePurifyCourt: card.data.first_mes.includes('"court":"unknown"') && !card.data.first_mes.includes('中央庭＝已净化'),
  yanhuaMonocle: entries.find(x => x.id === 42)?.content?.includes('左眼单片镜') === true,
  yumiEyepatch: entries.find(x => x.id === 45)?.content?.includes('左眼眼罩') === true,
  arashiIllusion: entries.find(x => x.id === 55)?.content?.includes('制造、维持高度沉浸的幻境') === true,
  oldTownCore: entries.find(x => x.id === 35)?.content?.includes('核心人物固定为艾露比与薇拉') === true,
  sacrificeAudit: entries.find(x => x.id === 17)?.content?.includes("artifact_view='weapon'") === true && entries.find(x => x.id === 17)?.content?.includes("ann_release='released'") === true,
  wenziBranch: entries.find(x => x.id === 31)?.content?.includes('wenzi_injured=true') === true,
};

const form = new FormData();
form.set('file_type', 'json');
form.set('avatar', new Blob([raw], { type: 'application/json' }), 'qidu-card-v0411.json');
const importResponse = await fetch(`${baseUrl}/api/characters/import`, { method: 'POST', body: form });
const importText = await importResponse.text();

const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.LAB_CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const pageErrors = [];
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

let browserApi = null;
let uiHasName = false;
try {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2500);

  browserApi = await page.evaluate(async (name) => {
    const response = await fetch('/api/characters/all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    const arr = Array.isArray(data) ? data : (Array.isArray(data?.characters) ? data.characters : []);
    const found = arr.find(x => (x?.data?.name || x?.name) === name);
    return {
      status: response.status,
      ok: response.ok,
      count: arr.length,
      found: Boolean(found),
      foundVersion: found?.data?.character_version || null,
      foundWorldEntries: found?.data?.character_book?.entries?.length ?? null,
      foundFirstMesHasUnknownCourt: String(found?.data?.first_mes || found?.first_mes || '').includes('"court":"unknown"'),
    };
  }, expectedName);

  const rightDrawer = page.locator('#rightNavDrawerIcon');
  if (await rightDrawer.count()) {
    await rightDrawer.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  const bodyText = await page.locator('body').innerText().catch(() => '');
  uiHasName = bodyText.includes(expectedName);

  await page.screenshot({ path: path.join(evidenceDir, 'qidu-card-real-st.png'), fullPage: true });
} finally {
  await browser.close();
}

const report = {
  expectedName,
  import: { status: importResponse.status, ok: importResponse.ok, text: importText.slice(0, 500) },
  staticChecks,
  browserApi,
  uiHasName,
  pageErrors,
  consoleErrors,
};

await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const failedStatic = Object.entries(staticChecks).filter(([, ok]) => !ok).map(([k]) => k);
if (!importResponse.ok) throw new Error(`Character import failed: ${importResponse.status} ${importText}`);
if (failedStatic.length) throw new Error(`Static card checks failed: ${failedStatic.join(', ')}`);
if (!browserApi?.ok || !browserApi?.found) throw new Error(`Imported character not visible through real ST browser API: ${JSON.stringify(browserApi)}`);
if (browserApi?.foundVersion !== '0.4.11-lab') throw new Error(`Imported card version mismatch: ${browserApi?.foundVersion}`);
if ((browserApi?.foundWorldEntries ?? 0) < 40) throw new Error(`Embedded worldbook missing after import: ${browserApi?.foundWorldEntries}`);
if (!browserApi?.foundFirstMesHasUnknownCourt) throw new Error('Opening state changed/lost during ST import');
if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
