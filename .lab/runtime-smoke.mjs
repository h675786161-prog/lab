import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.LAB_ST_URL;
const evidenceDir = process.env.LAB_EVIDENCE_DIR;
const chrome = process.env.LAB_CHROME;
const playwrightEntry = process.env.LAB_PLAYWRIGHT_CORE_ENTRY;
const cardPath = path.join(process.env.GITHUB_WORKSPACE || process.cwd(), 'fixtures/qidu-he-if/qidu-he-if.character.json');
if (!baseUrl || !evidenceDir || !chrome || !playwrightEntry) throw new Error('Missing LingQi lab browser environment');

const raw = await fs.readFile(cardPath, 'utf8');
const card = JSON.parse(raw);
if (card?.spec !== 'chara_card_v2') throw new Error('Character card is not V2');
if (card?.data?.name !== '交界都市：普通人的人生 HE IF') throw new Error('Unexpected character card name');
if (!card?.data?.first_mes?.includes('彼安汀') || !card?.data?.first_mes?.includes('塞拉菲姆')) throw new Error('Opening anchors missing');
if (!card?.data?.system_prompt?.includes('不存在神器使、指挥使')) throw new Error('Ordinary-world hard anchor missing');

const form = new FormData();
form.set('file_type', 'json');
form.set('avatar', new Blob([raw], { type: 'application/json' }), 'qidu-he-if.character.json');
const importResponse = await fetch(`${baseUrl}/api/characters/import`, { method: 'POST', body: form });
const importBody = await importResponse.text();
if (!importResponse.ok) throw new Error(`Character import failed ${importResponse.status}: ${importBody.slice(0, 1000)}`);

const { chromium } = await import(playwrightEntry);
const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));

let report;
try {
  const response = await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3000);
  const list = await page.evaluate(async () => {
    const r = await fetch('/api/characters/all', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    return { status: r.status, body: await r.json() };
  });
  const chars = Array.isArray(list.body) ? list.body : [];
  const match = chars.find(c => c?.name === '交界都市：普通人的人生 HE IF');
  if (!match) throw new Error(`Imported character not found in real ST character list (count=${chars.length})`);

  const firstMes = match.first_mes || match.data?.first_mes || '';
  const description = match.description || match.data?.description || '';
  report = {
    url: page.url(),
    httpStatus: response?.status() ?? null,
    importStatus: importResponse.status,
    characterListStatus: list.status,
    importedName: match.name,
    firstMesHasPiantin: firstMes.includes('彼安汀'),
    firstMesHasSeraphim: firstMes.includes('塞拉菲姆'),
    descriptionHasOrdinaryLife: description.includes('普通人'),
    pageErrors,
  };
  await page.screenshot({ path: path.join(evidenceDir, 'qidu-he-character-import.png'), fullPage: true });
  if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
} finally {
  if (!report) report = { importStatus: importResponse.status, importBody: importBody.slice(0, 1000), pageErrors, failedBeforeReport: true };
  await fs.writeFile(path.join(evidenceDir, 'qidu-he-character-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
