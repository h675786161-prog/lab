import fs from 'node:fs/promises';
import path from 'node:path';
import { loadV0414Card, entryMap, EXPECTED_V0414_COMPACT_SHA256 } from './qidu-card-v0414-candidate.mjs';

const baseUrl = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const evidenceDir = process.env.LAB_EVIDENCE_DIR || 'lab-evidence';
await fs.mkdir(evidenceDir, { recursive: true });

const { card, raw, compactSha256 } = await loadV0414Card();
const expectedName = card.data.name;
const firstMes = String(card.data.first_mes || '');
const entries = card.data.character_book?.entries || [];
const BOOK = entryMap(card);
const get = name => BOOK[name] || '';
const outputProtocol = get('04｜输出协议：隐藏状态、正文、终端');
const day7 = get('10｜第7天：苏醒与高校主线');
const day4 = get('13｜第4天：公开对抗、港湾结算、安资格截止');
const day3 = get('14｜第3天：安离开/追回与自由行动');
const day2 = get('15｜第2天：安托涅瓦抉择与普通线突袭');
const day1 = get('16｜第1天：终局准备与剩余自由行动');
const school = get('30｜高校学园：六巡查与黑核');
const east = get('31｜东方古街：六巡查与五行阵黑核');
const ann = get('40｜安');
const yanhua = get('42｜晏华');
const yumi = get('45｜羽弥');
const wenzi = get('46｜雯梓');
const arashi = get('55｜阿岚');
const oldtown = get('35｜旧城区：六巡查、艾露比/薇拉与黑核');
const sacrifice = get('17｜最终日：普通线结局判定优先级');
const hiro = get('43｜希罗');
const amusa = get('65｜爱缪莎');
const sybilla = get('66｜西比尔');
const annAffinity = get('90｜安好感与三段核心剧情');
const stateRules = get('91｜f7d_state字段与更新规则');
const timelineText = [day7, day4, day3, day2, day1, school, sybilla].join('\n');
const regexScripts = card.data.extensions?.regex_scripts || [];
const choiceWrap = regexScripts.find(x => x.id === 'f7d-choices-wrap-v0414');
const choiceButton = regexScripts.find(x => x.id === 'f7d-choice-button-v0414');

const staticChecks = {
  exactV0414Hash: compactSha256 === EXPECTED_V0414_COMPACT_SHA256,
  specV3: card.spec === 'chara_card_v3' && card.spec_version === '3.0',
  version: card.data.character_version === '0.4.14-lab',
  worldbookSize: entries.length === 55,
  openingState: firstMes.includes('"court":"unknown"') && firstMes.includes('"affection":0') && !/old_risk|seaside_risk|institute_risk/.test(firstMes),
  courtPurifiesAfterOpening: day7.includes("cores.court='purified'") && day7.includes('希罗初始段落结束') && day7.includes('12节点正式开放'),
  firstLoopSybillaRescue: day7.includes('额外消耗1节点') && day7.includes('sybilla_condition_obtained=true') && !/loop>=2|二周目|首周目不能/.test(timelineText),
  noLegacyAutoCoreRiskChain: day4.includes('没有额外的“旧城区/海湾侧城/研究所自动夺核风险链”') && day3.includes('不额外自动结算旧城区或海湾侧城黑核丢失') && day2.includes('不额外自动夺取海湾侧城或研究所黑核') && day1.includes('不凭空自动夺取研究所或其他区域黑核'),
  annNumericAffinity: annAffinity.includes('ANN_CORE_30') && annAffinity.includes('ANN_CORE_60') && annAffinity.includes('ANN_CORE_80') && annAffinity.includes('ann.affection>=100'),
  annNoMechanicalShowcase: ann.includes('不得顺势写成拆机展示') && ann.includes('禁止新增“掀开仿生皮肤') && ann.includes('不是“证明她有人性/证明她像人类”'),
  yanhuaEvidenceClosure: yanhua.includes('证据闭包') && yanhua.includes('能量反应异常') && yanhua.includes('不会凭空生成一份检测报告'),
  yumiPosthumousFactGuard: yumi.includes('让·塔克死亡后的事实边界') && yumi.includes('主观确信或混乱感受'),
  wenziAtomicState: east.includes('延误分支原子结算') && east.includes('route_flags.wenzi_injured=true') && wenzi.includes('状态硬锁'),
  sacrificeNoGuideLeak: sacrifice.includes('最终抉择防攻略泄露') && sacrifice.includes('隐藏结局判定只能在后台使用') && sacrifice.includes('正确性评价'),
  sybillaNoNodeLeak: sybilla.includes('节点信息不对玩家泄露') && sybilla.includes('第X次决定生死') && amusa.includes('不得把后台巡查编号'),
  choiceProtocol: outputProtocol.includes('<f7d_choices>') && outputProtocol.includes('<f7d_choice>自然语言行动</f7d_choice>') && outputProtocol.includes('点击UI只回填输入框'),
  choiceRegexPresent: Boolean(choiceWrap && choiceButton) && choiceButton.replaceString.includes('data-f7d-choice="1"') && choiceButton.replaceString.includes('#send_textarea'),
  choiceNoPrecommit: stateRules.includes('按钮被渲染、点击并回填输入框都不是剧情行动'),
  yanhuaMonocle: yanhua.includes('左眼单片镜'),
  yumiEyepatch: yumi.includes('左眼眼罩'),
  arashiIllusion: arashi.includes('男性神器使') && arashi.includes('高度沉浸的幻境') && arashi.includes('海湾侧城黑核链'),
  oldTownCore: oldtown.includes('核心人物固定为艾露比与薇拉') && oldtown.includes('瞬、虎彻等只能'),
  hiroAgreeNotJoin: hiro.includes('支持≠加入') && hiro.includes('不等于“加入希罗阵营”'),
};

const form = new FormData();
form.set('file_type', 'json');
form.set('avatar', new Blob([raw], { type: 'application/json' }), 'qidu-card-v0.4.14-lab.json');
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
let choiceUi = null;
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
    const scripts = found?.data?.extensions?.regex_scripts || [];
    return {
      status: response?.status, ok: Boolean(response?.ok), count: arr.length, matches: matches.length,
      found: Boolean(found), foundVersion: found?.data?.character_version || null, foundWorldEntries: book.length,
      foundUnknownCourt: first.includes('"court":"unknown"'), foundAnnAffection0: first.includes('"affection":0'),
      foundLegacyRisk: /old_risk|seaside_risk|institute_risk/.test(first),
      foundChoiceRegex: scripts.some(x => x?.id === 'f7d-choices-wrap-v0414') && scripts.some(x => x?.id === 'f7d-choice-button-v0414'),
      foundAnnMechanicalGuard: joined.includes('不得顺势写成拆机展示'),
      foundYanhuaClosure: joined.includes('证据闭包'),
      foundWenziAtomic: joined.includes('延误分支原子结算'),
      foundSacrificeNoLeak: joined.includes('最终抉择防攻略泄露'),
      foundSybillaNoLeak: joined.includes('节点信息不对玩家泄露'),
    };
  }, { name: expectedName, version: '0.4.14-lab' });

  choiceUi = await page.evaluate(async ({ wrapScript, buttonScript }) => {
    const { runRegexScript } = await import('/scripts/extensions/regex/engine.js');
    const { messageFormatting } = await import('/script.js');
    const input = document.querySelector('#send_textarea');
    if (!input) return { error: 'send_textarea missing' };

    input.value = '';
    let inputEvents = 0;
    let changeEvents = 0;
    input.addEventListener('input', () => inputEvents++, { once: false });
    input.addEventListener('change', () => changeEvents++, { once: false });

    const sample = '<f7d_choices><f7d_choice>先去高校学园看看</f7d_choice><f7d_choice>我不同意你的做法</f7d_choice></f7d_choices>';
    let regexed = runRegexScript(wrapScript, sample);
    regexed = runRegexScript(buttonScript, regexed);
    const formatted = messageFormatting(regexed, 'Qidu UI Test', false, false, 999999, {}, false);

    const host = document.createElement('div');
    host.id = 'f7d-ui-test-host';
    host.innerHTML = formatted;
    document.body.appendChild(host);
    const buttons = [...host.querySelectorAll('.f7d-choice-btn')];
    const beforeMes = document.querySelectorAll('.mes').length;
    const inlineOnclick = buttons[0]?.getAttribute('onclick') || null;
    const style = buttons[0] ? getComputedStyle(buttons[0]) : null;
    buttons[0]?.click();
    await new Promise(r => setTimeout(r, 50));
    const afterMes = document.querySelectorAll('.mes').length;
    const result = {
      regexed,
      formattedSample: formatted.slice(0, 1200),
      buttonCount: buttons.length,
      firstLabel: buttons[0]?.textContent?.trim() || null,
      secondLabel: buttons[1]?.textContent?.trim() || null,
      inlineOnclick,
      inputValue: input.value,
      inputEvents,
      changeEvents,
      focused: document.activeElement === input,
      mesCountUnchanged: beforeMes === afterMes,
      display: style?.display || null,
      minHeight: style?.minHeight || null,
      width: style?.width || null,
      hostHtml: host.innerHTML.slice(0, 2000),
    };
    host.remove();
    return result;
  }, { wrapScript: choiceWrap, buttonScript: choiceButton });

  await page.screenshot({ path: path.join(evidenceDir, 'qidu-card-v0414-real-st.png'), fullPage: true });
} finally { await browser.close(); }

const report = {
  expectedName,
  version: card.data.character_version,
  rawBytes: raw.length,
  compactSha256,
  import: { status: importResponse.status, ok: importResponse.ok, text: importText.slice(0,500) },
  staticChecks,
  browserApi,
  choiceUi,
  pageErrors,
  consoleErrors,
};
await fs.writeFile(path.join(evidenceDir, 'qidu-card-runtime-report.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(evidenceDir, 'qidu-card-v0.4.14-lab.json'), raw);
console.log(JSON.stringify(report, null, 2));

const failedStatic = Object.entries(staticChecks).filter(([,ok]) => !ok).map(([k]) => k);
if (!importResponse.ok) throw new Error(`Character import failed: ${importResponse.status} ${importText}`);
if (failedStatic.length) throw new Error(`Static exact-card checks failed: ${failedStatic.join(', ')}`);
if (!browserApi?.ok || !browserApi?.found) throw new Error(`Imported v0.4.14 not visible through real ST browser API: ${JSON.stringify(browserApi)}`);
if (browserApi.foundVersion !== '0.4.14-lab' || browserApi.foundWorldEntries !== 55) throw new Error(`Imported card shape/version mismatch: ${JSON.stringify(browserApi)}`);
if (!browserApi.foundChoiceRegex || !browserApi.foundAnnMechanicalGuard || !browserApi.foundYanhuaClosure || !browserApi.foundWenziAtomic || !browserApi.foundSacrificeNoLeak || !browserApi.foundSybillaNoLeak) throw new Error(`v0.4.14 rules changed/lost during ST import: ${JSON.stringify(browserApi)}`);
if (choiceUi?.buttonCount !== 2) throw new Error(`Choice buttons did not render through ST formatter: ${JSON.stringify(choiceUi)}`);
if (choiceUi?.inputValue !== '先去高校学园看看') throw new Error(`Choice click did not refill #send_textarea: ${JSON.stringify(choiceUi)}`);
if (!choiceUi?.focused || choiceUi?.inputEvents < 1 || choiceUi?.changeEvents < 1) throw new Error(`Choice click did not behave like user input: ${JSON.stringify(choiceUi)}`);
if (!choiceUi?.mesCountUnchanged) throw new Error(`Choice click unexpectedly auto-sent a message: ${JSON.stringify(choiceUi)}`);
if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
