import fs from 'node:fs/promises';
import path from 'node:path';
import { makeFocusCard, RULES } from './qidu-card-focus-fixture.mjs';

const baseUrl = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const evidenceDir = process.env.LAB_EVIDENCE_DIR || 'lab-evidence';
const reportPath = path.join(evidenceDir, 'qidu-card-runtime-report.json');
await fs.mkdir(evidenceDir, { recursive: true });

const card = makeFocusCard();
const raw = Buffer.from(JSON.stringify(card), 'utf8');
const expectedName = card.data.name;
const entries = card.data.character_book.entries || [];
const firstMes = card.data.first_mes;

const staticChecks = {
  specV3: card.spec === 'chara_card_v3' && card.spec_version === '3.0',
  version: card.data.character_version === '0.4.11-lab-focus',
  annNumericAffinity: RULES.ann.includes('affection 0~100') && RULES.ann.includes('ANN_CORE_30') && RULES.ann.includes('ANN_CORE_60') && RULES.ann.includes('ANN_CORE_80'),
  openingDoesNotPrePurifyCourt: firstMes.includes('"court":"unknown"') && !firstMes.includes('中央庭＝已净化'),
  yanhuaMonocle: RULES.yanhua.includes('左眼单片镜'),
  yumiEyepatch: RULES.yumi.includes('左眼眼罩'),
  arashiIllusion: RULES.arashi.includes('制造、维持高度沉浸的幻境'),
  oldTownCore: RULES.oldtown.includes('核心人物固定为艾露比+薇拉'),
  sacrificeAudit: RULES.sacrifice.includes("artifact_view='weapon'") && RULES.sacrifice.includes("ann_release='released'"),
  wenziBranch: RULES.wenzi.includes('wenzi_injured=true') && RULES.wenzi.includes('wenzi_joined=false'),
  hiroAgreeNotJoin: RULES.hiro.includes('不等于正式加入希罗阵营'),
};

const form = new FormData();
form.set('file_type', 'json');
form.set('avatar', new Blob([raw], { type: 'application/json' }), 'qidu-card-v0411-focus.json');
const importResponse = await fetch(`${baseUrl}/api/characters/import`, { method: 'POST', body: form });
const importText = await importResponse.text();

const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser = await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
const pageErrors = [];
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
let browserApi = null;
let uiHasName = false;
try {
  await page.goto(`${baseUrl}/`, { waitUntil:'domcontentloaded', timeout:60_000 });
  await page.waitForTimeout(2500);
  browserApi = await page.evaluate(async (name) => {
    const candidates = [
      async () => fetch('/api/characters/all', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),
      async () => fetch('/api/characters/all'),
    ];
    let response, text, data;
    for (const call of candidates) {
      response = await call(); text = await response.text();
      try { data = JSON.parse(text); } catch { data = null; }
      if (response.ok && data) break;
    }
    const arr = Array.isArray(data) ? data : (Array.isArray(data?.characters) ? data.characters : (data && typeof data==='object' ? Object.values(data) : []));
    const found = arr.find(x => (x?.data?.name || x?.name) === name);
    return {status:response?.status,ok:Boolean(response?.ok),count:arr.length,found:Boolean(found),foundVersion:found?.data?.character_version||null,foundWorldEntries:found?.data?.character_book?.entries?.length??null,foundFirstMesHasUnknownCourt:String(found?.data?.first_mes||found?.first_mes||'').includes('"court":"unknown"')};
  }, expectedName);
  const rightDrawer = page.locator('#rightNavDrawerIcon');
  if (await rightDrawer.count()) { await rightDrawer.first().click().catch(()=>{}); await page.waitForTimeout(1200); }
  const bodyText = await page.locator('body').innerText().catch(()=> '');
  uiHasName = bodyText.includes(expectedName);
  await page.screenshot({path:path.join(evidenceDir,'qidu-card-real-st.png'),fullPage:true});
} finally { await browser.close(); }

const report={expectedName,import:{status:importResponse.status,ok:importResponse.ok,text:importText.slice(0,500)},staticChecks,browserApi,uiHasName,pageErrors,consoleErrors};
await fs.writeFile(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
const failedStatic=Object.entries(staticChecks).filter(([,ok])=>!ok).map(([k])=>k);
if(!importResponse.ok) throw new Error(`Character import failed: ${importResponse.status} ${importText}`);
if(failedStatic.length) throw new Error(`Static card checks failed: ${failedStatic.join(', ')}`);
if(!browserApi?.ok||!browserApi?.found) throw new Error(`Imported character not visible through real ST browser API: ${JSON.stringify(browserApi)}`);
if(browserApi?.foundVersion!=='0.4.11-lab-focus') throw new Error(`Imported card version mismatch: ${browserApi?.foundVersion}`);
if((browserApi?.foundWorldEntries??0)<10) throw new Error(`Embedded worldbook missing after import: ${browserApi?.foundWorldEntries}`);
if(!browserApi?.foundFirstMesHasUnknownCourt) throw new Error('Opening state changed/lost during ST import');
if(pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
