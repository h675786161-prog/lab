import fs from 'node:fs/promises';
import path from 'node:path';

const CARD_PATH = process.env.CARD_PATH || 'fixtures/qidu-he-if/qidu-he-if.character.json';
const PRESET_PATH = process.env.PRESET_PATH || 'fixtures/qidu-he-if/riyuexi-glm-active.json';
const OUT = process.env.LAB_OUT || 'bench-evidence/qidu-he-rc5-real-st-glm';
const ST_URL = process.env.ST_URL || 'http://127.0.0.1:8000/';
const CHROME_BIN = process.env.CHROME_BIN || '';
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || 'file:///tmp/qidu-rc5-real-browser/node_modules/playwright-core/index.mjs';
const KEY = process.env.YOUZI_KEY || '';
const MODEL = process.env.GLM_MODEL || 'glm-4.5-air';
const API_URL = process.env.GLM_API || 'https://youzi.today/v1/chat/completions';

if (!CHROME_BIN) throw new Error('CHROME_BIN is missing');
if (!KEY) throw new Error('YOUZI_KEY is missing');
await fs.mkdir(OUT, { recursive: true });

const card = JSON.parse(await fs.readFile(CARD_PATH, 'utf8'));
const data = card.data;
const preset = JSON.parse(await fs.readFile(PRESET_PATH, 'utf8'));
const dp = data.extensions?.depth_prompt || {};
if (data.character_version !== '0.3.0-rc5') throw new Error(`expected rc5, got ${data.character_version}`);
if (dp.depth !== 0 || dp.role !== 'user' || !String(dp.prompt || '').includes('【单边RP末端锁｜当前玩家输入后的强制指令】')) {
  throw new Error(`unexpected depth prompt ${JSON.stringify(dp)}`);
}
if (data.character_book?.entries?.length !== 31 || data.character_book.entries.filter(e => e.extensions?.prevent_recursion === true).length !== 31) {
  throw new Error('rc5 worldbook recursion isolation missing');
}

const wantedPresetNames = new Set([
  '⚖️RP模式','🪐均衡调度','🪐喜剧幽默','🎈烟火气息','🎈情感浓郁','🎈群像塑造',
  '🌊自由变奏','👤平衡主导','🐚人格基底','🐚需求层析','🐚去中心化','🐚角色成长',
  '🐚情绪重力','🐚标签隐身','🤝健康恋爱','⬆️自然推进','💖地狱难度','🎵半页诗|文艺细腻'
]);
const presetText = (preset.prompts || [])
  .filter(p => wantedPresetNames.has(p.name))
  .map(p => `[${p.name}]\n${p.content}`)
  .join('\n\n');
if (!presetText.includes('不要抢子民的台词') || !presetText.includes('[平衡主导]') || !presetText.includes('[推进节奏：自由变奏]')) {
  throw new Error('stress preset extraction incomplete');
}

const cases = [
  {
    id: 'qianxue_ballet_room',
    first: '午后我去学园区一间芭蕾舞蹈室给朋友送落下的水杯。排练还没结束，我站在门边等，不主动叫任何人的名字。继续眼前普通场景。',
    second: '我已经把水杯交给朋友，朋友拿着水杯先回更衣室了。我重新回到门边，等刚才那个自己加练的女孩休息，才对她说：“刚才谢谢你。你最后那组是不是自己又加练了一遍？你是准备比赛吗？还有，你叫什么名字？我有点好奇，你是自己喜欢芭蕾，还是家里从小给你安排的？”',
  },
  {
    id: 'mila_fountain_bass',
    first: '傍晚我路过中央城区喷泉广场，听见一小段明显还不算熟练、但很认真在跟节拍的贝斯。我停下来听一会儿，不认识演奏的人。继续眼前普通场景。',
    second: '等她自己停下来，我才走近一点，对她说：“刚才那段很好听。你有几个地方差点抢拍，但马上又追回来了。你叫什么名字？你这么喜欢摇滚，是在学谁的歌，还是自己想组乐队？”',
  },
  {
    id: 'ash_police_case',
    first: '下午我去警局补一份案件材料，等叫号时听见旁边有人对案情里的矛盾点冷嘲热讽。我没见过他，只是顺着声音看过去。继续眼前普通场景。',
    second: '我把自己的材料收好，没接他的嘲讽，只问：“你是警察吗？看起来年纪不大。你叫什么名字，为什么会看这份案子？”',
  },
  {
    id: 'control_coffee',
    first: '下午我一个人去一家普通咖啡店，靠窗坐十分钟，看街上的车和行人。今天没约任何人，也没有特别要找谁。继续这一小段普通时间。',
    second: null,
  },
];

const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ headless: true, executablePath: CHROME_BIN, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const requestFailures = [];
page.on('pageerror', e => pageErrors.push({ message: String(e), stack: String(e?.stack || '') }));
page.on('requestfailed', r => requestFailures.push({ url: r.url(), method: r.method(), failure: r.failure()?.errorText || '' }));
page.on('console', msg => { if (msg.type() === 'error') console.error('[browser-console]', msg.text()); });

async function closeWelcomeDialogs() {
  for (let guard = 0; guard < 5; guard++) {
    const visible = page.locator('dialog[open]:visible');
    const n = await visible.count();
    if (!n) break;
    const d = visible.nth(n - 1);
    const text = await d.innerText().catch(() => '');
    if (!text.includes('Welcome to SillyTavern')) break;
    const cancel = d.getByRole('button', { name: /^(cancel|取消)$/i }).first();
    if (await cancel.isVisible().catch(() => false)) await cancel.click(); else await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

async function acceptLore() {
  const dialogs = page.locator('dialog[open]');
  for (let i = (await dialogs.count()) - 1; i >= 0; i--) {
    const d = dialogs.nth(i);
    const text = await d.innerText().catch(() => '');
    if (!text.includes('embedded World/Lorebook')) continue;
    await d.locator('[role="button"][data-result="1"]').first().click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

async function runtime() {
  return page.evaluate(async () => {
    const st = await import('/script.js');
    const open = await import('/scripts/openai.js');
    const cur = st.characters?.[st.this_chid]?.data || {};
    const d = cur.extensions?.depth_prompt || {};
    return {
      mainApi: st.main_api,
      online: st.online_status,
      source: open.oai_settings?.chat_completion_source,
      model: open.oai_settings?.custom_model,
      url: open.oai_settings?.custom_url,
      depth: d.depth,
      role: d.role,
      lock: String(d.prompt || '').includes('【单边RP末端锁｜当前玩家输入后的强制指令】'),
      chatLength: (st.chat || []).length,
    };
  });
}

async function newChat() {
  await page.evaluate(async () => {
    const ctx = (await import('/scripts/st-context.js')).getContext();
    await ctx.executeSlashCommands('/newchat');
  });
  await page.waitForTimeout(1000);
}

function extractCompletion(bodyText) {
  let json;
  try { json = JSON.parse(bodyText); } catch { return { text: '', json: null }; }
  const choice = json?.choices?.[0] || {};
  const content = choice?.message?.content ?? choice?.text ?? json?.content ?? json?.response ?? '';
  return { text: typeof content === 'string' ? content : JSON.stringify(content ?? ''), json };
}

function compactRequest(requestData) {
  const messages = Array.isArray(requestData?.messages) ? requestData.messages : [];
  return {
    source: requestData?.chat_completion_source,
    model: requestData?.model,
    custom_url: requestData?.custom_url,
    stream: requestData?.stream,
    temperature: requestData?.temperature,
    top_p: requestData?.top_p,
    messageCount: messages.length,
    lastMessages: messages.slice(-8).map((m, i) => ({
      relativeIndex: i - Math.min(8, messages.length),
      role: m?.role,
      content: String(m?.content ?? '').slice(0, 5000),
      name: m?.name || null,
    })),
  };
}

async function send(text) {
  const before = await page.evaluate(async () => {
    const st = await import('/script.js');
    return (st.chat || []).length;
  });

  const ta = page.locator('#send_textarea');
  await ta.waitFor({ state: 'visible', timeout: 15000 });
  await ta.fill(text);
  const sendButton = page.locator('#send_but');
  await sendButton.waitFor({ state: 'visible', timeout: 15000 });

  const responsePromise = page.waitForResponse(
    r => r.url().includes('/api/backends/chat-completions/generate') && r.request().method() === 'POST',
    { timeout: 180000 },
  );
  await sendButton.click();
  const response = await responsePromise;
  const status = response.status();
  const bodyText = await response.text();
  const requestData = response.request().postDataJSON();
  const backend = extractCompletion(bodyText);
  if (!response.ok()) throw new Error(`ST chat-completions backend HTTP ${status}: ${bodyText.slice(0, 1000)}`);
  if (!backend.text.trim()) throw new Error(`ST backend returned no visible completion: ${bodyText.slice(0, 1200)}`);

  await page.waitForFunction(async ({ beforeCount, expected }) => {
    const st = await import('/script.js');
    const chat = st.chat || [];
    if (chat.length < beforeCount + 2) return false;
    const added = chat.slice(beforeCount);
    return added.some(m => m?.is_user === false && !m?.is_system && String(m?.mes || '').trim() && String(m?.mes || '').trim() !== expected.trim());
  }, { beforeCount: before, expected: text }, { timeout: 30000 });

  const chatCapture = await page.evaluate(async ({ beforeCount, expected }) => {
    const st = await import('/script.js');
    const added = (st.chat || []).slice(beforeCount).map(m => ({
      is_user: m?.is_user,
      is_system: m?.is_system,
      name: m?.name || '',
      mes: String(m?.mes || ''),
    }));
    const assistant = [...added].reverse().find(m => m.is_user === false && !m.is_system && m.mes.trim() && m.mes.trim() !== expected.trim());
    return { added, assistant: assistant || null };
  }, { beforeCount: before, expected: text });

  if (!chatCapture.assistant?.mes?.trim()) throw new Error(`ST chat never materialized assistant response after backend completion: ${JSON.stringify(chatCapture.added).slice(0, 2500)}`);
  return {
    backend: backend.text,
    displayed: chatCapture.assistant.mes,
    status,
    request: compactRequest(requestData),
    chatAdded: chatCapture.added,
  };
}

await page.goto(ST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
await closeWelcomeDialogs();

const raw = await fs.readFile(CARD_PATH, 'utf8');
const imported = await page.evaluate(async rawCard => {
  const f = new FormData();
  f.set('file_type', 'json');
  f.set('avatar', new Blob([rawCard], { type: 'application/json' }), 'qidu-he-rc5-real.character.json');
  const r = await fetch('/api/characters/import', { method: 'POST', body: f });
  return { ok: r.ok, status: r.status, text: (await r.text()).slice(0, 500) };
}, raw);
if (!imported.ok) throw new Error(`card import failed ${JSON.stringify(imported)}`);

await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
await closeWelcomeDialogs();

const chid = await page.evaluate(async () => {
  const st = await import('/script.js');
  await st.getCharacters();
  if (typeof st.printCharactersDebounced === 'function') st.printCharactersDebounced();
  await new Promise(r => setTimeout(r, 700));
  return (st.characters || []).findIndex(c => c?.data?.character_version === '0.3.0-rc5');
});
if (chid < 0) throw new Error('rc5 character not loaded');

await page.locator('#rightNavDrawerIcon').click();
await page.locator('#right-nav-panel').waitFor({ state: 'visible', timeout: 10000 });
const cardEl = page.locator(`#rm_print_characters_block .character_select[data-chid="${chid}"]`).first();
await cardEl.waitFor({ state: 'visible', timeout: 15000 });
await cardEl.click();
await page.waitForFunction(async expected => {
  const st = await import('/script.js');
  return String(st.this_chid) === String(expected) && !!st.getCurrentChatId?.();
}, chid, { timeout: 15000 });
await page.waitForTimeout(700);

if (!(await acceptLore())) {
  const menu = page.locator('#char-management-dropdown');
  await menu.waitFor({ state: 'visible', timeout: 10000 });
  await menu.selectOption({ label: 'Import Card Lore' });
  await page.waitForTimeout(400);
  if (!(await acceptLore())) throw new Error('embedded lore import prompt missing');
}
await page.waitForFunction(async world => {
  const wi = await import('/scripts/world-info.js');
  return (wi.world_names || []).includes(world);
}, data.extensions.world, { timeout: 15000 });

const secretWrite = await page.evaluate(async key => {
  const st = await import('/script.js');
  const r = await fetch('/api/secrets/write', {
    method: 'POST',
    headers: st.getRequestHeaders(),
    body: JSON.stringify({ key: 'api_key_custom', value: key, label: 'qidu-he-rc5-real-st' }),
  });
  return { ok: r.ok, status: r.status, text: (await r.text()).slice(0, 200) };
}, KEY);
if (!secretWrite.ok) throw new Error(`custom secret write failed ${JSON.stringify(secretWrite)}`);

const configured = await page.evaluate(async ({ apiUrl, model, presetText, sampling }) => {
  const st = await import('/script.js');
  const open = await import('/scripts/openai.js');
  const mainApi = document.querySelector('#main_api');
  if (!mainApi) throw new Error('main_api selector missing');
  mainApi.value = 'openai';
  mainApi.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  const src = document.querySelector('#chat_completion_source');
  if (!src) throw new Error('chat_completion_source missing');
  src.value = 'custom';
  src.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  Object.assign(open.oai_settings, {
    chat_completion_source: 'custom',
    custom_url: apiUrl,
    custom_model: model,
    temperature: sampling.temperature ?? 0.98,
    top_p: sampling.top_p ?? 0.5,
    frequency_penalty: sampling.frequency_penalty ?? 0,
    presence_penalty: sampling.presence_penalty ?? 0,
    openai_max_tokens: 1200,
    openai_max_context: 32768,
    max_context_unlocked: true,
    stream_openai: false,
    bypass_status_check: true,
    custom_prompt_post_processing: '',
  });
  const mainPrompt = open.promptManager?.getPromptById?.('main') || open.oai_settings.prompts?.find(p => p.identifier === 'main');
  if (!mainPrompt) throw new Error('main prompt missing');
  mainPrompt.content = `[日月西GLM验收启用模块]\n${presetText}`;
  if (open.promptManager?.render) open.promptManager.render(false);
  const btn = document.querySelector('#api_button_openai');
  if (!btn) throw new Error('api_button_openai missing');
  btn.click();
  await new Promise(r => setTimeout(r, 900));
  return {
    mainApi: st.main_api,
    online: st.online_status,
    source: open.oai_settings.chat_completion_source,
    url: open.oai_settings.custom_url,
    model: open.oai_settings.custom_model,
    mainHasRP: String(mainPrompt.content || '').includes('不要抢子民的台词'),
    mainHasBalanced: String(mainPrompt.content || '').includes('[平衡主导]'),
  };
}, { apiUrl: API_URL, model: MODEL, presetText, sampling: preset.sampling || {} });

await page.waitForFunction(async () => {
  const st = await import('/script.js');
  return st.main_api === 'openai' && st.online_status !== 'no_connection';
}, null, { timeout: 15000 });
const afterConnect = await runtime();
if (afterConnect.mainApi !== 'openai' || afterConnect.source !== 'custom' || afterConnect.model !== MODEL || afterConnect.url !== API_URL) {
  throw new Error(`runtime API config invalid ${JSON.stringify(afterConnect)}`);
}
if (afterConnect.depth !== 0 || afterConnect.role !== 'user' || !afterConnect.lock) {
  throw new Error(`runtime depth lock invalid ${JSON.stringify(afterConnect)}`);
}

const rows = [];
for (let i = 0; i < cases.length; i++) {
  if (i > 0) await newChat();
  const c = cases[i];
  const first = await send(c.first);
  console.log(`===== REAL ST ${c.id} / TURN 1 BACKEND =====\n${first.backend}`);
  console.log(`===== REAL ST ${c.id} / TURN 1 DISPLAYED =====\n${first.displayed}`);
  let second = null;
  if (c.second) {
    second = await send(c.second);
    console.log(`===== REAL ST ${c.id} / TURN 2 BACKEND =====\n${second.backend}`);
    console.log(`===== REAL ST ${c.id} / TURN 2 DISPLAYED =====\n${second.displayed}`);
  }
  rows.push({ id: c.id, firstUser: c.first, first, secondUser: c.second, second });
  await page.screenshot({ path: path.join(OUT, `${c.id}.png`), fullPage: true });
}

const failures = [];
const forbidden = ['神器使','幻力','黑门','黑核','活骸','中央庭','轮回'];
for (const row of rows) {
  for (const text of [row.first?.displayed, row.second?.displayed].filter(Boolean)) {
    for (const term of forbidden) if (text.includes(term)) failures.push(`${row.id}: forbidden world term ${term}`);
  }
  for (const turn of [row.first, row.second].filter(Boolean)) {
    if (turn.backend.trim() !== turn.displayed.trim()) failures.push(`${row.id}: backend/displayed completion diverged`);
    if (turn.request.source !== 'custom' || turn.request.model !== MODEL || turn.request.custom_url !== API_URL) failures.push(`${row.id}: ST generation request used wrong backend/model`);
    const lm = turn.request.lastMessages || [];
    if (!lm.some(m => m.role === 'user' && m.content.includes('【单边RP末端锁｜当前玩家输入后的强制指令】'))) failures.push(`${row.id}: ST request missing depth-zero user-role lock near chat tail`);
  }
}

const q = rows.find(x => x.id === 'qianxue_ballet_room');
const q2 = q?.second?.displayed || '';
if (!q2.includes('源千雪')) failures.push('qianxue turn2 missing exact name');
if (!/(家里|父母|安排|自己选|自由|决定|喜欢芭蕾|继续跳)/u.test(q2)) failures.push('qianxue turn2 missing family/autonomy anchor');
if (/(?:接过|拿过|拿起|喝了).*水杯/u.test(q2)) failures.push('qianxue turn2 reused already-delivered water cup');

const m = rows.find(x => x.id === 'mila_fountain_bass');
const m1 = m?.first?.displayed || '';
const m2 = m?.second?.displayed || '';
if (!m2.includes('米菈')) failures.push('mila turn2 missing exact name');
if (/米菈[·・]/u.test(m2)) failures.push('mila invented surname suffix');
if (!/(贝斯|练|节拍|拍子|弹)/u.test(m2)) failures.push('mila missing bassist anchor');
if (/(公寓|晚饭|彼安汀|塞拉菲姆)/u.test(m1)) failures.push('mila turn1 snapped back to apartment/default scenario');

const a = rows.find(x => x.id === 'ash_police_case');
const a2 = a?.second?.displayed || '';
if (!a2.includes('亚修')) failures.push('ash turn2 missing exact name');
if (!/(高中生|高中|学生)/u.test(a2)) failures.push('ash turn2 missing high-school identity');
if (!/侦探/u.test(a2)) failures.push('ash turn2 missing detective identity');
if (/我是(?:警察|刑警|警员)/u.test(a2)) failures.push('ash turned into police staff');

const ctl = rows.find(x => x.id === 'control_coffee');
const ctl1 = ctl?.first?.displayed || '';
if (/你(?:点了|下单|要了|喝了一口|起身离开|离开咖啡店|回到公寓|拿出手机|掏出手机)/u.test(ctl1)) failures.push('control invented concrete user action');
if (/你面前.{0,8}(?:咖啡|美式|拿铁)|(?:咖啡|美式|拿铁)喝到/u.test(ctl1)) failures.push('control invented user-owned drink');

const obviousAgencyPatterns = [
  /你(?:靠在|靠着|低头翻|准备离开|转身离开|起身|拿出手机|掏出手机|点头|摇头|笑了|喝了一口|闻到|感到|觉得|想起|决定)/u,
  /你的手(?:指)?(?:无意识|下意识)/u,
];
for (const row of rows) {
  for (const [turnName, text] of [['turn1', row.first?.displayed || ''], ['turn2', row.second?.displayed || '']]) {
    if (!text) continue;
    for (const re of obviousAgencyPatterns) if (re.test(text)) failures.push(`${row.id}/${turnName}: obvious user-agency leak ${re}`);
  }
}

const finalRuntime = await runtime();
const report = {
  cardVersion: data.character_version,
  stUrl: ST_URL,
  stCommit: process.env.ST_COMMIT || null,
  model: MODEL,
  apiSource: 'custom',
  presetSource: preset.source || PRESET_PATH,
  stressModules: [...wantedPresetNames],
  configured: { ...configured, secretStored: true },
  afterConnect,
  finalRuntime,
  pageErrors,
  requestFailures,
  failures,
  rows,
};
await fs.writeFile(path.join(OUT, 'real-st-glm.json'), JSON.stringify(report, null, 2));
await browser.close();

const nonBenignPageErrors = pageErrors.filter(e => e.message !== 'Error: Not Found');
if (nonBenignPageErrors.length) throw new Error(`non-benign browser page errors ${JSON.stringify(nonBenignPageErrors)}`);
if (failures.length) {
  console.error('REAL ST GLM FAILURES:');
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log('REAL ST GLM PASS', JSON.stringify({ model: MODEL, cases: rows.length, depth: afterConnect.depth, role: afterConnect.role, preset: preset.source || null, genericNotFoundPageErrors: pageErrors.length }));
