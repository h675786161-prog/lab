import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const baseUrl = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const evidenceDir = process.env.LAB_EVIDENCE_DIR || 'lab-evidence';
const reportPath = path.join(evidenceDir, 'qidu-card-runtime-report.json');
const packedPath = path.join(process.env.GITHUB_WORKSPACE || process.cwd(), 'fixtures/qidu-card/card-v0.4.12-lab.json.gz.b64');
await fs.mkdir(evidenceDir, { recursive: true });

const packed = (await fs.readFile(packedPath, 'utf8')).trim();
const raw = zlib.gunzipSync(Buffer.from(packed, 'base64'));
const card = JSON.parse(raw.toString('utf8'));
const expectedName = card.data.name;
const firstMes = String(card.data.first_mes || '');
const entries = card.data.character_book?.entries || [];
const byName = Object.fromEntries(entries.map(e => [String(e.name || ''), String(e.content || '')]));
const get = name => byName[name] || '';
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
  specV3: card.spec === 'chara_card_v3' && card.spec_version === '3.0',
  version: card.data.character_version === '0.4.12-lab',
  worldbookSize: entries.length >= 55,
  openingState: firstMes.includes('"court":"unknown"') && firstMes.includes('"affection":0') && !firstMes.includes('old_risk') && !firstMes.includes('seaside_risk') && !firstMes.includes('institute_risk'),
  courtPurifiesAfterOpening: day7.includes("cores.court='purified'") && day7.includes('希罗初始段落结束') && day7.includes('12节点正式开放'),
  firstLoopSybillaRescue: day7.includes('额外消耗1节点') && day7.includes('爱缪莎') && day7.includes('sybilla_condition_obtained=true') && school.includes('爱缪莎') && sybilla.includes('第3次高校巡查后') && !timelineText.includes('loop>=2') && !timelineText.includes('二周目') && !timelineText.includes('首周目不能'),
  noLegacyAutoCoreRiskChain: day4.includes('没有额外的“旧城区/海湾侧城/研究所自动夺核风险链”') && day3.includes('不额外自动结算旧城区或海湾侧城黑核丢失') && day2.includes('不额外自动夺取海湾侧城或研究所黑核') && day1.includes('不凭空自动夺取研究所或其他区域黑核') && !timelineText.includes('旧城区风险') && !timelineText.includes('海湾侧城风险') && !timelineText.includes('研究所风险'),
  annNumericAffinity: annAffinity.includes('ANN_CORE_30') && annAffinity.includes('ANN_CORE_60') && annAffinity.includes('ANN_CORE_80') && annAffinity.includes('ann.affection>=100'),
  annIdentityGuard: ann.includes('禁止反复写金属关节') && ann.includes('人偶安是失去自主'),
  yanhuaMonocle: yanhua.includes('左眼单片镜') && yanhua.includes('因私人嫉妒针对安'),
  yumiEyepatchAndTucker: yumi.includes('左眼眼罩') && yumi.includes('真相揭露后不会瞬间切割'),
  arashiIllusion: arashi.includes('男性神器使') && arashi.includes('高度沉浸的幻境') && arashi.includes('海湾侧城黑核链'),
  oldTownCore: oldtown.includes('核心人物固定为艾露比与薇拉') && oldtown.includes('瞬、虎彻等只能'),
  sacrificeAudit: sacrifice.includes("artifact_view='weapon'") && sacrifice.includes("ann_release='released'") && sacrifice.includes("antoneva_choice='help_release'"),
  wenziBranch: wenzi.includes('雯梓受伤') && wenzi.includes('暂不加入'),
  hiroAgreeNotJoin: hiro.includes('支持≠加入') && hiro.includes('不等于“加入希罗阵营”'),
  stateSchemaNoLegacyRiskFields: stateRules.includes('hiro={intel:0,handled:[]}') && stateRules.includes('当前母版不使用old_risk/seaside_risk/institute_risk'),
};

const form = new FormData();
form.set('file_type', 'json');
form.set('avatar', new Blob([raw], { type: 'application/json' }), 'qidu-card-v0412-full.json');
const importResponse = await fetch(`${baseUrl}/api/characters/import`, { method: 'POST', body: form });
const importText = await importResponse.text();

const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser = await chromium.launch({ headless:true, executablePath:process.env.LAB_CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
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
    const matches = arr.filter(x => (x?.data?.name || x?.name) === name);
    const found = matches.sort((a,b) => String(b?.data?.character_version||'').localeCompare(String(a?.data?.character_version||'')))[0];
    const first = String(found?.data?.first_mes || found?.first_mes || '');
    const book = found?.data?.character_book?.entries || [];
    const joinedBook = book.map(e => String(e?.content || '')).join('\n');
    return {
      status:response?.status,
      ok:Boolean(response?.ok),
      count:arr.length,
      matches:matches.length,
      found:Boolean(found),
      foundVersion:found?.data?.character_version||null,
      foundWorldEntries:book.length,
      foundFirstMesHasUnknownCourt:first.includes('"court":"unknown"'),
      foundFirstMesHasAnnAffection0:first.includes('"affection":0'),
      foundFirstMesHasLegacyRisk:first.includes('old_risk')||first.includes('seaside_risk')||first.includes('institute_risk'),
      foundHasFirstLoopSybilla:joinedBook.includes('sybilla_condition_obtained=true') && joinedBook.includes('爱缪莎'),
      foundHasLegacySecondLoopGate:joinedBook.includes('loop>=2') || joinedBook.includes('首周目不能'),
    };
  }, expectedName);
  const rightDrawer = page.locator('#rightNavDrawerIcon');
  if (await rightDrawer.count()) { await rightDrawer.first().click().catch(()=>{}); await page.waitForTimeout(1200); }
  const bodyText = await page.locator('body').innerText().catch(()=> '');
  uiHasName = bodyText.includes(expectedName);
  await page.screenshot({ path:path.join(evidenceDir,'qidu-card-v0412-real-st.png'), fullPage:true });
} finally { await browser.close(); }

const report={expectedName,source:'fixtures/qidu-card/card-v0.4.12-lab.json.gz.b64',rawBytes:raw.length,import:{status:importResponse.status,ok:importResponse.ok,text:importText.slice(0,500)},staticChecks,browserApi,uiHasName,pageErrors,consoleErrors};
await fs.writeFile(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
const failedStatic=Object.entries(staticChecks).filter(([,ok])=>!ok).map(([k])=>k);
if(!importResponse.ok) throw new Error(`Character import failed: ${importResponse.status} ${importText}`);
if(failedStatic.length) throw new Error(`Static full-card checks failed: ${failedStatic.join(', ')}`);
if(!browserApi?.ok||!browserApi?.found) throw new Error(`Imported full card not visible through real ST browser API: ${JSON.stringify(browserApi)}`);
if(browserApi?.foundVersion!=='0.4.12-lab') throw new Error(`Imported full-card version mismatch: ${browserApi?.foundVersion}`);
if((browserApi?.foundWorldEntries??0)<55) throw new Error(`Embedded full worldbook missing after import: ${browserApi?.foundWorldEntries}`);
if(!browserApi?.foundFirstMesHasUnknownCourt || !browserApi?.foundFirstMesHasAnnAffection0 || browserApi?.foundFirstMesHasLegacyRisk) throw new Error('Opening state changed/lost during ST import');
if(!browserApi?.foundHasFirstLoopSybilla || browserApi?.foundHasLegacySecondLoopGate) throw new Error('Sybilla first-loop patch changed/lost during ST import');
if(pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
