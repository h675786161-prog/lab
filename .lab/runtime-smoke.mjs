import fs from 'node:fs/promises';
import path from 'node:path';
import { loadV0412Card, entryMap, EXPECTED_COMPACT_SHA256, EXPECTED_PACKED_SHA256, EXPECTED_RAW_SHA256 } from './qidu-card-v0412-candidate.mjs';

const baseUrl = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const evidenceDir = process.env.LAB_EVIDENCE_DIR || 'lab-evidence';
await fs.mkdir(evidenceDir, { recursive: true });

const { card, raw, compactSha256, packedSha256, rawSha256 } = await loadV0412Card();
const expectedName = card.data.name;
const firstMes = String(card.data.first_mes || '');
const entries = card.data.character_book?.entries || [];
const BOOK = entryMap(card);
const get = name => BOOK[name] || '';
const day7 = get('10｜第7天：苏醒与高校主线');
const day4 = get('13｜第4天：公开对抗、港湾结算、安资格截止');
const day3 = get('14｜第3天：安离开/追回与自由行动');
const day2 = get('15｜第2天：安托涅瓦抉择与普通线突袭');
const day1 = get('16｜第1天：终局准备与剩余自由行动');
const school = get('30｜高校学园：六巡查与黑核');
const sybilla = get('66｜西比尔');
const ann = get('40｜安');
const yanhua = get('42｜晏华');
const yumi = get('45｜羽弥');
const arashi = get('55｜阿岚');
const oldtown = get('35｜旧城区：六巡查、艾露比/薇拉与黑核');
const sacrifice = get('17｜最终日：普通线结局判定优先级');
const wenzi = get('31｜东方古街：六巡查与五行阵黑核') + '\n' + get('46｜雯梓');
const hiro = get('43｜希罗');
const annAffinity = get('90｜安好感与三段核心剧情');
const stateRules = get('91｜f7d_state字段与更新规则');
const timelineText = [day7, day4, day3, day2, day1, school, sybilla].join('\n');

const staticChecks = {
  exactCompactHash: compactSha256 === EXPECTED_COMPACT_SHA256,
  exactPackedHash: packedSha256 === EXPECTED_PACKED_SHA256,
  exactRawHash: rawSha256 === EXPECTED_RAW_SHA256,
  specV3: card.spec === 'chara_card_v3' && card.spec_version === '3.0',
  version: card.data.character_version === '0.4.12-lab',
  worldbookSize: entries.length === 55,
  openingState: firstMes.includes('"court":"unknown"') && firstMes.includes('"affection":0') && !/old_risk|seaside_risk|institute_risk/.test(firstMes),
  courtPurifiesAfterOpening: day7.includes("cores.court='purified'") && day7.includes('希罗初始段落结束') && day7.includes('12节点正式开放'),
  firstLoopSybillaRescue: day7.includes('额外消耗1节点') && day7.includes('爱缪莎') && day7.includes('sybilla_condition_obtained=true') && school.includes('爱缪莎') && sybilla.includes('第3次高校巡查后') && !/loop>=2|二周目|首周目不能/.test(timelineText),
  noLegacyAutoCoreRiskChain: day4.includes('没有额外的“旧城区/海湾侧城/研究所自动夺核风险链”') && day3.includes('不额外自动结算旧城区或海湾侧城黑核丢失') && day2.includes('不额外自动夺取海湾侧城或研究所黑核') && day1.includes('不凭空自动夺取研究所或其他区域黑核'),
  annNumericAffinity: annAffinity.includes('ANN_CORE_30') && annAffinity.includes('ANN_CORE_60') && annAffinity.includes('ANN_CORE_80') && annAffinity.includes('ann.affection>=100'),
  annIdentityGuard: ann.includes('禁止反复写金属关节') && ann.includes('人偶安是失去自主'),
  yanhuaMonocle: yanhua.includes('左眼单片镜') && yanhua.includes('私人嫉妒'),
  yumiEyepatchAndTucker: yumi.includes('左眼眼罩') && yumi.includes('不会瞬间切割'),
  arashiIllusion: arashi.includes('男性神器使') && arashi.includes('高度沉浸的幻境') && arashi.includes('海湾侧城黑核链'),
  oldTownCore: oldtown.includes('核心人物固定为艾露比与薇拉') && oldtown.includes('瞬、虎彻等只能'),
  sacrificeAudit: sacrifice.includes("artifact_view='weapon'") && sacrifice.includes("ann_release='released'") && sacrifice.includes("antoneva_choice='help_release'"),
  wenziBranch: wenzi.includes('雯梓负伤') && wenzi.includes('本阶段不加入'),
  hiroAgreeNotJoin: hiro.includes('支持≠加入') && hiro.includes('不等于“加入希罗阵营”'),
  stateSchemaNoLegacyRiskFields: stateRules.includes('hiro={intel:0,handled:[]}') && stateRules.includes('当前母版不使用old_risk/seaside_risk/institute_risk'),
};

const form = new FormData();
form.set('file_type', 'json');
form.set('avatar', new Blob([raw], { type: 'application/json' }), 'qidu-card-v0.4.12-lab.json');
const importResponse = await fetch(`${baseUrl}/api/characters/import`, { method: 'POST', body: form });
const importText = await importResponse.text();

const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser = await chromium.launch({ headless: true, executablePath: process.env.LAB_CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const pageErrors = [];
const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
let browserApi = null;
let uiHasName = false;
try {
  const response = await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!response || response.status() >= 400) throw new Error(`ST page HTTP ${response?.status()}`);
  await page.waitForTimeout(2500);
  browserApi = await page.evaluate(async ({ name, version }) => {
    const calls = [
      () => fetch('/api/characters/all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
      () => fetch('/api/characters/all'),
    ];
    let response, data;
    for (const call of calls) {
      response = await call();
      const text = await response.text();
      try { data = JSON.parse(text); } catch { data = null; }
      if (response.ok && data) break;
    }
    const arr = Array.isArray(data) ? data : Array.isArray(data?.characters) ? data.characters : (data && typeof data === 'object' ? Object.values(data) : []);
    const matches = arr.filter(x => (x?.data?.name || x?.name) === name);
    const found = matches.find(x => x?.data?.character_version === version) || matches[0];
    const first = String(found?.data?.first_mes || found?.first_mes || '');
    const book = found?.data?.character_book?.entries || [];
    const joined = book.map(e => String(e?.content || '')).join('\n');
    return {
      status: response?.status,
      ok: Boolean(response?.ok),
      count: arr.length,
      matches: matches.length,
      found: Boolean(found),
      foundVersion: found?.data?.character_version || null,
      foundWorldEntries: book.length,
      foundUnknownCourt: first.includes('"court":"unknown"'),
      foundAnnAffection0: first.includes('"affection":0'),
      foundLegacyRisk: /old_risk|seaside_risk|institute_risk/.test(first),
      foundFirstLoopSybilla: joined.includes('sybilla_condition_obtained=true') && joined.includes('爱缪莎'),
      foundLegacySecondLoopGate: /loop>=2|首周目不能/.test(joined),
    };
  }, { name: expectedName, version: '0.4.12-lab' });

  const rightDrawer = page.locator('#rightNavDrawerIcon');
  if (await rightDrawer.count()) {
    await rightDrawer.first().click().catch(() => {});
    await page.waitForTimeout(800);
  }
  uiHasName = (await page.locator('body').innerText().catch(() => '')).includes(expectedName);
  await page.screenshot({ path: path.join(evidenceDir, 'qidu-card-v0412-real-st.png'), fullPage: true });
} finally {
  await browser.close();
}

const report = {
  expectedName,
  version: card.data.character_version,
  rawBytes: raw.length,
  hashes: { compactSha256, packedSha256, rawSha256 },
  import: { status: importResponse.status, ok: importResponse.ok, text: importText.slice(0, 500) },
  staticChecks,
  browserApi,
  uiHasName,
  pageErrors,
  consoleErrors,
};
await fs.writeFile(path.join(evidenceDir, 'qidu-card-runtime-report.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(evidenceDir, 'qidu-card-v0.4.12-lab.json'), raw);
console.log(JSON.stringify(report, null, 2));

const failedStatic = Object.entries(staticChecks).filter(([, ok]) => !ok).map(([k]) => k);
if (!importResponse.ok) throw new Error(`Character import failed: ${importResponse.status} ${importText}`);
if (failedStatic.length) throw new Error(`Static exact-card checks failed: ${failedStatic.join(', ')}`);
if (!browserApi?.ok || !browserApi?.found) throw new Error(`Imported exact card not visible through real ST browser API: ${JSON.stringify(browserApi)}`);
if (browserApi.foundVersion !== '0.4.12-lab') throw new Error(`Imported card version mismatch: ${browserApi.foundVersion}`);
if (browserApi.foundWorldEntries !== 55) throw new Error(`Embedded worldbook entry count mismatch: ${browserApi.foundWorldEntries}`);
if (!browserApi.foundUnknownCourt || !browserApi.foundAnnAffection0 || browserApi.foundLegacyRisk) throw new Error('Opening state changed/lost during ST import');
if (!browserApi.foundFirstLoopSybilla || browserApi.foundLegacySecondLoopGate) throw new Error('First-loop Sybilla rule changed/lost during ST import');
if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
