import fs from 'node:fs/promises';
import path from 'node:path';
import { loadV0414FinalCard, entryMap, EXPECTED_V0414_FINAL_SHA256 } from './qidu-card-v0414-final.mjs';

const baseUrl = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const evidenceDir = process.env.LAB_EVIDENCE_DIR || 'lab-evidence';
await fs.mkdir(evidenceDir, { recursive: true });

const { card, raw, compactSha256 } = await loadV0414FinalCard();
const expectedName = card.data.name;
const entries = card.data.character_book?.entries || [];
const BOOK = entryMap(card);
const get = name => BOOK[name] || '';
const scripts = card.data.extensions?.regex_scripts || [];
const choiceWrap = scripts.find(x => x.id === 'f7d-choices-wrap-v0414');
const choiceButton = scripts.find(x => x.id === 'f7d-choice-button-v0414');

const staticChecks = {
  exactHash: compactSha256 === EXPECTED_V0414_FINAL_SHA256,
  specV3: card.spec === 'chara_card_v3' && card.spec_version === '3.0',
  version: card.data.character_version === '0.4.14-lab',
  worldbookSize: entries.length === 55,
  choiceRegexPresent: Boolean(choiceWrap && choiceButton),
  choiceRegexDeclarative: choiceButton?.replaceString?.includes('data-f7d-choice="1"') && !choiceButton?.replaceString?.includes('onclick='),
  choiceProtocol: get('04｜输出协议：隐藏状态、正文、终端').includes('点击UI只回填输入框'),
  choiceNoPrecommit: get('91｜f7d_state字段与更新规则').includes('按钮被渲染、点击并回填输入框都不是剧情行动'),
  annGuard: get('40｜安').includes('不得顺势写成拆机展示'),
  yanhuaGuard: get('42｜晏华').includes('证据闭包'),
  wenziAtomic: get('31｜东方古街：六巡查与五行阵黑核').includes('延误分支原子结算'),
  sacrificeNoLeak: get('17｜最终日：普通线结局判定优先级').includes('最终抉择防攻略泄露'),
  sybillaNoLeak: get('66｜西比尔').includes('节点信息不对玩家泄露'),
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

async function renderAndClick(viewport) {
  await page.setViewportSize(viewport);
  return await page.evaluate(async ({ wrapScript, buttonScript }) => {
    const { runRegexScript } = await import('/scripts/extensions/regex/engine.js');
    const { messageFormatting } = await import('/script.js');
    const input = document.querySelector('#send_textarea');
    if (!(input instanceof HTMLTextAreaElement)) return { error: 'send_textarea missing' };

    input.value = '';
    let inputEvents = 0;
    let changeEvents = 0;
    const onInput = () => inputEvents++;
    const onChange = () => changeEvents++;
    input.addEventListener('input', onInput);
    input.addEventListener('change', onChange);

    const sample = '<f7d_choices><f7d_choice>先去高校学园看看</f7d_choice><f7d_choice>我不同意你的做法</f7d_choice></f7d_choices>';
    let regexed = runRegexScript(wrapScript, sample);
    regexed = runRegexScript(buttonScript, regexed);
    const formatted = messageFormatting(regexed, 'Qidu UI Test', false, false, 999999, {}, false);
    const host = document.createElement('div');
    host.id = 'f7d-ui-test-host';
    host.style.width = '100%';
    host.innerHTML = formatted;
    document.body.appendChild(host);

    const buttons = [...host.querySelectorAll('[data-f7d-choice="1"]')];
    const container = buttons[0]?.closest('[class*="f7d-choice-grid"]');
    const beforeMes = document.querySelectorAll('.mes').length;
    const firstStyle = buttons[0] ? getComputedStyle(buttons[0]) : null;
    const containerStyle = container ? getComputedStyle(container) : null;
    const inlineOnclick = buttons[0]?.getAttribute('onclick') ?? null;
    buttons[0]?.click();
    await new Promise(r => setTimeout(r, 60));
    const afterMes = document.querySelectorAll('.mes').length;

    const result = {
      buttonCount: buttons.length,
      labels: buttons.map(x => x.textContent?.trim()),
      inputValue: input.value,
      inputEvents,
      changeEvents,
      focused: document.activeElement === input,
      mesCountUnchanged: beforeMes === afterMes,
      inlineOnclick,
      classNames: buttons.map(x => x.className),
      minHeight: firstStyle?.minHeight ?? null,
      buttonWidth: firstStyle?.width ?? null,
      gridColumns: containerStyle?.gridTemplateColumns ?? null,
      containerWidth: containerStyle?.width ?? null,
      bridgeLoaded: Boolean(window.__LINGQI_LAB_PROBE__?.qiduChoiceBridge),
      renderedContainsDataHook: formatted.includes('data-f7d-choice="1"'),
      renderedContainsOnclick: formatted.includes('onclick='),
    };

    input.removeEventListener('input', onInput);
    input.removeEventListener('change', onChange);
    host.remove();
    return result;
  }, { wrapScript: choiceWrap, buttonScript: choiceButton });
}

let browserApi = null;
let desktopChoice = null;
let mobileChoice = null;
try {
  const response = await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!response || response.status() >= 400) throw new Error(`ST page HTTP ${response?.status()}`);
  await page.waitForTimeout(2500);

  browserApi = await page.evaluate(async ({ name, version }) => {
    const attempts = [
      () => fetch('/api/characters/all', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }),
      () => fetch('/api/characters/all'),
    ];
    let response, data;
    for (const call of attempts) {
      response = await call();
      const text = await response.text();
      try { data = JSON.parse(text); } catch { data = null; }
      if (response.ok && data) break;
    }
    const arr = Array.isArray(data) ? data : Array.isArray(data?.characters) ? data.characters : (data && typeof data === 'object' ? Object.values(data) : []);
    const found = arr.find(x => (x?.data?.name || x?.name) === name && x?.data?.character_version === version);
    const foundScripts = found?.data?.extensions?.regex_scripts || [];
    return {
      status: response?.status,
      ok: Boolean(response?.ok),
      found: Boolean(found),
      foundVersion: found?.data?.character_version ?? null,
      foundWorldEntries: found?.data?.character_book?.entries?.length ?? 0,
      foundChoiceRegex: foundScripts.some(x => x?.id === 'f7d-choices-wrap-v0414') && foundScripts.some(x => x?.id === 'f7d-choice-button-v0414'),
      importedButtonHasInlineJs: String(foundScripts.find(x => x?.id === 'f7d-choice-button-v0414')?.replaceString || '').includes('onclick='),
    };
  }, { name: expectedName, version: '0.4.14-lab' });

  desktopChoice = await renderAndClick({ width: 1440, height: 1000 });
  mobileChoice = await renderAndClick({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(evidenceDir, 'qidu-card-v0414-mobile-real-st.png'), fullPage: true });
} finally {
  await browser.close();
}

const report = {
  expectedName,
  version: card.data.character_version,
  rawBytes: raw.length,
  compactSha256,
  import: { status: importResponse.status, ok: importResponse.ok, text: importText.slice(0,500) },
  staticChecks,
  browserApi,
  desktopChoice,
  mobileChoice,
  pageErrors,
  consoleErrors,
};
await fs.writeFile(path.join(evidenceDir, 'qidu-card-runtime-report.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(evidenceDir, 'qidu-card-v0.4.14-lab.json'), raw);
console.log(JSON.stringify(report, null, 2));

const failedStatic = Object.entries(staticChecks).filter(([,ok]) => !ok).map(([k]) => k);
if (!importResponse.ok) throw new Error(`Character import failed: ${importResponse.status} ${importText}`);
if (failedStatic.length) throw new Error(`Static checks failed: ${failedStatic.join(', ')}`);
if (!browserApi?.ok || !browserApi?.found || browserApi.foundVersion !== '0.4.14-lab' || browserApi.foundWorldEntries !== 55) throw new Error(`Imported card mismatch: ${JSON.stringify(browserApi)}`);
if (!browserApi.foundChoiceRegex || browserApi.importedButtonHasInlineJs) throw new Error(`Imported choice regex unsafe/missing: ${JSON.stringify(browserApi)}`);
for (const [label, x] of [['desktop',desktopChoice], ['mobile',mobileChoice]]) {
  if (x?.buttonCount !== 2) throw new Error(`${label}: choice button count mismatch ${JSON.stringify(x)}`);
  if (x?.inputValue !== '先去高校学园看看') throw new Error(`${label}: choice click did not refill input ${JSON.stringify(x)}`);
  if (!x?.bridgeLoaded || !x?.focused || x?.inputEvents < 1 || x?.changeEvents < 1) throw new Error(`${label}: bridge/input behavior failed ${JSON.stringify(x)}`);
  if (!x?.mesCountUnchanged) throw new Error(`${label}: click auto-sent unexpectedly ${JSON.stringify(x)}`);
  if (x?.inlineOnclick !== null || x?.renderedContainsOnclick) throw new Error(`${label}: unsafe inline click survived ${JSON.stringify(x)}`);
  if (!x?.renderedContainsDataHook) throw new Error(`${label}: data hook lost in formatter ${JSON.stringify(x)}`);
}
if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
