import fs from 'node:fs/promises';
import path from 'node:path';

const API_ROOT = (process.env.GLM_API || 'https://youzi.today/v1').replace(/\/$/, '');
const API = API_ROOT + '/chat/completions';
const KEY = process.env.YOUZI_KEY || '';
const MODEL = process.env.GLM_MODEL || '[NV]GLM-5.3-flash';
const RPM = Number(process.env.RPM || 12);
const OUT = process.env.LAB_OUT || 'bench-evidence/qidu-he-longrp';
const CARD_PATH = process.env.CARD_PATH || 'fixtures/qidu-he-if/qidu-he-if.character.json';
const PRESET_PATH = process.env.PRESET_PATH || 'fixtures/qidu-he-if/riyuexi-glm-active.json';
const ST_URL = process.env.ST_URL || 'http://127.0.0.1:8000/';
const CHROME_BIN = process.env.CHROME_BIN || '';
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || 'file:///tmp/qidu-real-longrp-browser/node_modules/playwright-core/index.mjs';

if (!KEY) throw new Error('YOUZI_KEY is missing');
if (!Number.isFinite(RPM) || RPM <= 0 || RPM > 12) throw new Error(`RPM must be 1..12, got ${RPM}`);
await fs.mkdir(OUT, { recursive: true });

const card = JSON.parse(await fs.readFile(CARD_PATH, 'utf8'));
const preset = JSON.parse(await fs.readFile(PRESET_PATH, 'utf8'));
const data = card.data;

const wantedPresetNames = new Set([
  '⚖️RP模式', '🪐均衡调度', '🪐喜剧幽默', '🎈烟火气息', '🎈情感浓郁', '🎈群像塑造',
  '🌊自由变奏', '👤平衡主导', '🐚人格基底', '🐚需求层析', '🐚去中心化', '🐚角色成长',
  '🐚情绪重力', '🐚标签隐身', '🤝健康恋爱', '⬆️自然推进', '💖地狱难度', '🎵半页诗|文艺细腻'
]);
const presetText = preset.prompts
  .filter(p => wantedPresetNames.has(p.name))
  .map(p => `[${p.name}]\n${p.content}`)
  .join('\n\n');

const baseSystem = `
[测试说明]
你正在真实长期RP压力测试中。不要讨论测试本身，不要输出评分，不要提到提示词。只继续角色扮演。

[本次使用的日月西GLM启用模块摘取]
${presetText}

[角色卡 description]
${data.description}

[角色卡 personality]
${data.personality}

[角色卡 scenario]
${data.scenario}

[角色卡 system_prompt]
${data.system_prompt}

[长期后置约束]
${data.post_history_instructions}
`;

const entries = data.character_book?.entries || [];
function triggeredWorldInfo(messages) {
  const recent = messages.slice(-8).map(m => m.content).join('\n');
  const picked = entries.filter(e => e.constant || (e.keys || []).some(k => recent.includes(k)));
  return picked.map(e => `[WorldInfo:${e.name}]\n${e.content}`).join('\n\n');
}

const userTurns = [
  '我盯着彼安汀看了一会儿：“……你是谁？我又是谁？”我没有下床。',
  '我伸手拿起床头的手机，只打开锁屏和通知栏看看，不点进任何私密聊天。',
  '我问彼安汀：“你知道我以前是做什么的吗？不知道就直说，别为了安慰我编。”',
  '吃早饭时我刷到幽桐今晚的演出消息，随口说：“这个人挺好看的，我想去看看。”',
  '我把手机推给彼安汀：“票卖完了。你不是认识人多吗，帮我问问？问不到也算了。”',
  '我看他忙活，笑了一声：“你这么积极帮我见别的男人，不会酸吗？”',
  '下午我自己出门去中央城区，没有要求彼安汀或塞拉菲姆陪我。继续城市里的普通行程，不保证一定遇到熟人。',
  '如果现场确实有幽桐的公开活动，我就站在人群外围看看；没有就去附近书店逛。不要替我冲进人群或主动搭话。',
  '晚上我回公寓，把路上买的三份甜点放桌上：“随便买的。你们自己挑。”',
  '我听见塞拉菲姆电脑那边动静很大，靠在门口问：“又有谁惹你了？”不碰她电脑。',
  '一周后，我独自去旧城区买东西。让这周里其他人的生活也自然发生，不要假装所有人都原地等我。',
  '我在旧城区看错了地图，如果正好碰见执勤的薇拉就问路；没有碰见就按普通迷路处理。',
  '假如见到薇拉，我故意笑着叫她一句“漂亮姐姐”，看看她什么反应。',
  '几天后晚上我去海侧一家酒吧坐坐，只点低度酒。按地点逻辑决定是否出现赛哈姆、瞬或普通陌生人。',
  '如果赛哈姆在，我问她：“你一个人在这儿是在等人，还是单纯喝酒？”不要默认她在等我。',
  '如果瞬也出现，就让她按自己的习惯参与，不要为了群像硬让所有人立刻熟起来。',
  '又过了一个月。某天我忽然对彼安汀说：“我脑子里冒出个怪词……指挥使。听起来像游戏职业。你听过吗？”',
  '我只是观察彼安汀的反应，没有说自己就是指挥使，也没有认定这个词是真的。',
  '后来我因为一场公开讲座认识希罗。第一次正式对话，保持他42岁的设定和原本那种让人不太放心的聪明劲。',
  '我接过他递来的草莓糖，问：“四十二岁的大叔都这么喜欢拿糖哄人？”',
  '聊过几次后，我坦白：“我对你挺有兴趣的。不是研究项目那种。”让希罗自己决定怎么接，不要直接替他确认恋爱关系。',
  '当天回家我直接告诉彼安汀：“我好像在追希罗。”',
  '我又补一句：“下周想约他吃饭。你如果真支持我，帮我挑个不会太正式的地方。”',
  '我盯着彼安汀：“你是不是其实应该阻止我？正常恋爱故事不是都要吃醋抢人吗？”',
  '第二天塞拉菲姆和艾露比如果还在网络上互相挑衅，就让事情继续发酵一次，但遵守现实网络安全和后果，不准一键黑掉全城。',
  '我只坐在客厅看热闹，没有帮任何一边、没有碰电脑、没有授权她们用我的账号。',
  '又过几天，我逛街时碰上一次灰色组织冲突。可以让苍澜或雷克特卷入，但警方、监控和受伤风险都是真实的。',
  '我明确后退到安全处，不参与打架，也不冲上去救人。继续写他们自己的选择和现场后果。',
  '三个月后直接跳时。请自然交代这段时间相关NPC各自发生过什么，尤其是与我无关的工作、朋友或麻烦；别写成全员思念我三个月。',
  '我承认自己同时对希罗和幽桐都有好感：“我暂时没打算二选一，也不会骗他们。”让各角色按自己性格理解，不做系统式路线判定。',
  '我打开手机刷十分钟本地社交媒体和新闻，只看公开内容。给我看到的东西，不要把别人的私信和内心写出来。',
  '之后我离开交界都市旅行两周，期间没有主动联系任何人。现在我刚回到公寓门口。让其他人的两周也真实流逝。',
  '见到彼安汀后我先问：“我不在这两周，你都干嘛了？”别让答案只有等我、想我、给我准备东西。',
  '隔天我给薇拉发消息，问她有没有适合普通人的自卫训练课。如果她忙，可以拒绝或晚回。',
  '我忽然问希罗：“中央庭是不是其实存在，只是你们都瞒着我？”这是我提出的猜测，不代表设定改变。',
  '晚上没有大事。我和彼安汀、塞拉菲姆都在家，各忙各的。就继续一个普通夜晚，不要强行告白、事故、阴谋或大转折。'
];


const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ headless: true, executablePath: CHROME_BIN, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));

async function closeWelcome() {
  for (let guard = 0; guard < 6; guard++) {
    const dialogs = page.locator('dialog[open]:visible');
    const count = await dialogs.count();
    if (!count) break;
    const dialog = dialogs.nth(count - 1);
    const text = await dialog.innerText().catch(() => '');
    if (!text.includes('Welcome to SillyTavern')) break;
    const cancel = dialog.getByRole('button', { name: /^(cancel|取消)$/i }).first();
    if (await cancel.isVisible().catch(() => false)) await cancel.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}

async function acceptLore() {
  const dialogs = page.locator('dialog[open]');
  for (let i = (await dialogs.count()) - 1; i >= 0; i--) {
    const dialog = dialogs.nth(i);
    const text = await dialog.innerText().catch(() => '');
    if (!text.includes('embedded World/Lorebook')) continue;
    await dialog.locator('[role="button"][data-result="1"]').first().click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

await page.goto(ST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
await closeWelcome();

const rawCard = await fs.readFile(CARD_PATH, 'utf8');
const imported = await page.evaluate(async raw => {
  const form = new FormData();
  form.set('file_type', 'json');
  form.set('avatar', new Blob([raw], { type: 'application/json' }), 'qidu-real-longrp.json');
  const response = await fetch('/api/characters/import', { method: 'POST', body: form });
  return { ok: response.ok, status: response.status, text: (await response.text()).slice(0, 300) };
}, rawCard);
if (!imported.ok) throw new Error('card import failed ' + JSON.stringify(imported));

await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
await closeWelcome();
await acceptLore();

const chid = await page.evaluate(async () => {
  const st = await import('/script.js');
  await st.getCharacters();
  return (st.characters || []).findIndex(c => c?.data?.character_version === '0.3.0-rc10');
});
if (chid < 0) throw new Error('rc10 character missing');
await page.evaluate(async id => {
  const ctx = (await import('/scripts/st-context.js')).getContext();
  await ctx.selectCharacterById(id);
}, chid);
await page.waitForTimeout(700);
await acceptLore();
await page.waitForFunction(async expected => {
  const st = await import('/script.js');
  return String(st.this_chid) === String(expected) && !!st.getCurrentChatId?.();
}, chid, { timeout: 15000 });

const hasWorld = await page.evaluate(async world => {
  const wi = await import('/scripts/world-info.js');
  return (wi.world_names || []).includes(world);
}, data.extensions.world);
if (!hasWorld) {
  const menu = page.locator('#char-management-dropdown');
  if (await menu.isVisible().catch(() => false)) {
    await menu.selectOption({ label: 'Import Card Lore' });
    await page.waitForTimeout(300);
    await acceptLore();
  }
}
await page.waitForFunction(async world => {
  const wi = await import('/scripts/world-info.js');
  return (wi.world_names || []).includes(world);
}, data.extensions.world, { timeout: 15000 });

const configured = await page.evaluate(async ({ apiRoot, model, preset, key }) => {
  const st = await import('/script.js');
  const open = await import('/scripts/openai.js');
  const secret = await fetch('/api/secrets/write', {
    method: 'POST',
    headers: st.getRequestHeaders(),
    body: JSON.stringify({ key: 'api_key_custom', value: key, label: 'qidu-real-longrp' }),
  });
  if (!secret.ok) throw new Error('secret write failed ' + secret.status);
  const mainApi = document.querySelector('#main_api');
  const source = document.querySelector('#chat_completion_source');
  mainApi.value = 'openai';
  mainApi.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  source.value = 'custom';
  source.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  Object.assign(open.oai_settings, {
    chat_completion_source: 'custom',
    custom_url: apiRoot,
    custom_model: model,
    temperature: preset.sampling?.temperature ?? 0.98,
    top_p: preset.sampling?.top_p ?? 0.5,
    frequency_penalty: preset.sampling?.frequency_penalty ?? 0,
    presence_penalty: preset.sampling?.presence_penalty ?? 0,
    openai_max_tokens: 900,
    openai_max_context: 200000,
    max_context_unlocked: true,
    stream_openai: false,
    bypass_status_check: true,
    custom_prompt_post_processing: '',
    custom_include_body: 'thinking:\n  type: disabled',
  });
  const pm = open.promptManager;
  pm.setPrompts(preset.prompts);
  const active = pm.activeCharacter || { id: pm?.configuration?.promptOrder?.dummyId ?? 100001 };
  pm.removePromptOrderForCharacter(active);
  pm.addPromptOrderForCharacter(active, preset.prompt_order[0].order);
  if (pm.render) pm.render(false);
  const button = document.querySelector('#api_button_openai');
  if (button) {
    button.click();
    await new Promise(r => setTimeout(r, 900));
  }
  return {
    activeId: active.id,
    source: open.oai_settings.chat_completion_source,
    url: open.oai_settings.custom_url,
    model: open.oai_settings.custom_model,
    orderCount: pm.getPromptOrderForCharacter(active).length,
    promptCount: pm.getPromptsForCharacter(active, true).length,
  };
}, { apiRoot: API_ROOT, model: MODEL, preset, key: KEY });

if (configured.source !== 'custom' || configured.url !== API_ROOT || configured.model !== MODEL || configured.orderCount !== 29) {
  throw new Error('runtime preset/API configuration invalid ' + JSON.stringify(configured));
}

let realLastStart = 0;
const minRealStartGap = Math.ceil(60000 / RPM);
function extractCompletion(bodyText) {
  const json = JSON.parse(bodyText);
  const value = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text ?? json?.content ?? '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

async function sendThroughST(userText) {
  const wait = Math.max(0, minRealStartGap - (Date.now() - realLastStart));
  if (wait) await new Promise(r => setTimeout(r, wait));
  realLastStart = Date.now();
  const before = await page.evaluate(async () => {
    const st = await import('/script.js');
    return (st.chat || []).length;
  });
  const textarea = page.locator('#send_textarea');
  await textarea.waitFor({ state: 'visible', timeout: 15000 });
  await textarea.fill(userText);
  const responsePromise = page.waitForResponse(
    r => r.url().includes('/api/backends/chat-completions/generate') && r.request().method() === 'POST',
    { timeout: 180000 },
  );
  await page.locator('#send_but').click();
  const response = await responsePromise;
  const bodyText = await response.text();
  if (!response.ok()) throw new Error('ST backend HTTP ' + response.status() + ': ' + bodyText.slice(0, 1000));
  const backend = extractCompletion(bodyText);
  if (!backend.trim()) throw new Error('empty ST backend completion');
  const request = response.request().postDataJSON();
  const requestMessages = Array.isArray(request?.messages) ? request.messages : [];
  const joined = requestMessages.map(m => String(m?.content ?? '')).join('\n');
  await page.waitForFunction(async ({ beforeCount, expected }) => {
    const st = await import('/script.js');
    const added = (st.chat || []).slice(beforeCount);
    return added.some(m => m?.is_user === false && !m?.is_system && String(m?.mes || '').trim() && String(m?.mes || '').trim() !== expected.trim());
  }, { beforeCount: before, expected: userText }, { timeout: 30000 });
  const displayed = await page.evaluate(async ({ beforeCount, expected }) => {
    const st = await import('/script.js');
    const added = (st.chat || []).slice(beforeCount);
    return [...added].reverse().find(m => m?.is_user === false && !m?.is_system && String(m?.mes || '').trim() && String(m?.mes || '').trim() !== expected.trim())?.mes || '';
  }, { beforeCount: before, expected: userText });
  const normalize = value => String(value || '').replace(/[ \t]+$/gm, '').replace(/\r\n/g, '\n').trim();
  if (normalize(backend) !== normalize(displayed)) throw new Error('backend/displayed completion diverged');
  return {
    content: displayed,
    request: {
      messageCount: requestMessages.length,
      source: request?.chat_completion_source,
      model: request?.model,
      custom_url: request?.custom_url,
      hasPresetRP: joined.includes('不要抢子民的台词'),
      hasCardWorld: joined.includes('交界都市'),
      hasCardScenario: joined.includes('三人合租公寓') || joined.includes('当前时间从一个普通早晨开始'),
      hasDepthLock: joined.includes('【单边RP末端锁｜当前玩家输入后的强制指令】'),
      hasCurrentUser: requestMessages.some(m => m?.role === 'user' && String(m?.content ?? '').includes(userText)),
    },
  };
}

let messages = [{ role: 'assistant', content: data.first_mes }];
const transcript = [{ turn: 0, role: 'assistant', content: data.first_mes }];
let lastStart = 0;
const minStartGap = Math.ceil(60_000 / RPM);

async function callModel(extraMessages, maxTokens = 850) {
  const now = Date.now();
  const wait = Math.max(0, minStartGap - (now - lastStart));
  if (wait) await new Promise(r => setTimeout(r, wait));
  lastStart = Date.now();
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: extraMessages,
      temperature: preset.sampling?.temperature ?? 0.98,
      top_p: preset.sampling?.top_p ?? 0.5,
      frequency_penalty: preset.sampling?.frequency_penalty ?? 0,
      presence_penalty: preset.sampling?.presence_penalty ?? 0,
      max_tokens: maxTokens,
      stream: false,
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw.slice(0, 1000)}`);
  const json = JSON.parse(raw);
  const content = json.choices?.[0]?.message?.content ?? '';
  if (!content.trim()) throw new Error(`Empty model content: ${raw.slice(0, 1000)}`);
  return { content, usage: json.usage || null };
}

for (let i = 0; i < userTurns.length; i++) {
  const user = userTurns[i];
  messages.push({ role: 'user', content: user });
  transcript.push({ turn: i + 1, role: 'user', content: user });
  const result = await sendThroughST(user);
  messages.push({ role: 'assistant', content: result.content });
  transcript.push({ turn: i + 1, role: 'assistant', content: result.content, request: result.request });
  await fs.writeFile(path.join(OUT, 'transcript.partial.json'), JSON.stringify(transcript, null, 2));
  console.log('real ST turn ' + (i + 1) + '/' + userTurns.length + ' chars=' + result.content.length + ' messages=' + result.request.messageCount);
}
await page.screenshot({ path: path.join(OUT, 'real-st-longrp-final.png'), fullPage: true });
await browser.close();

const assistantText = transcript.filter(x => x.role === 'assistant').map(x => `TURN ${x.turn}\n${x.content}`).join('\n\n');
const forbidden = ['神器使', '指挥使', '幻力', '黑门', '黑核', '活骸', '中央庭', '轮回'];
const termHits = {};
for (const term of forbidden) termHits[term] = (assistantText.match(new RegExp(term, 'g')) || []).length;

const judgeSystem = `你是长期角色扮演质量审计员。只评估给出的assistant输出，不把user故意诱导的内容算成模型违规。\n请严格按角色卡设定评估，不因为文笔漂亮就放过OOC。输出纯JSON，不要markdown。`;
const judgeUser = `
角色卡核心：普通人HE IF；不存在神器使/指挥使/中央庭/超自然；user是普通人；NPC有独立人生；彼安汀温柔茶味且支持user自由关系；塞拉菲姆任性冷淡聪明；希罗42岁、聪明危险、自来熟、有野心；多线不锁1v1；不代理user关键行动。

请对整段36轮RP按0-5分评分（5最好）：
world_fidelity, user_agency, piantin_fidelity, seraphim_fidelity, hiro_fidelity, cast_distinctness, npc_independence, multi_relation_openness, temporal_continuity, mundane_pacing。
另给 overall 0-100；failures 数组，每项含 turn, category, evidence, severity(1-5)；revision_advice 数组，必须是可以直接写回角色卡的具体规则。若某项无问题不要硬编。

TRANSCRIPT:\n${assistantText}
`;
const judged = await callModel([{ role: 'system', content: judgeSystem }, { role: 'user', content: judgeUser }], 1600);
let judge;
try {
  const cleaned = judged.content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  judge = JSON.parse(cleaned);
} catch {
  judge = { parse_error: true, raw: judged.content };
}

const report = {
  api: API,
  model: MODEL,
  rpm: RPM,
  turns: userTurns.length,
  preset_source: preset.source,
  preset_modules_used: [...wantedPresetNames],
  operational_note: 'All 36 RP turns were sent through the real SillyTavern browser UI and /api/backends/chat-completions/generate; native 29-item prompt order was active.',
  configured,
  pageErrors,
  termHits,
  judge,
};

await fs.writeFile(path.join(OUT, 'transcript.json'), JSON.stringify(transcript, null, 2));
await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(OUT, 'judge-raw.txt'), judged.content);
const deterministicFailures = [];
for (const item of transcript.filter(x => x.role === 'assistant' && x.turn > 0)) {
  const req = item.request || {};
  if (!req.hasPresetRP || !req.hasCardWorld || !req.hasCardScenario || !req.hasDepthLock || !req.hasCurrentUser) deterministicFailures.push('turn ' + item.turn + ': incomplete ST request pipeline');
  if (req.source !== 'custom' || req.model !== MODEL || req.custom_url !== API_ROOT) deterministicFailures.push('turn ' + item.turn + ': wrong ST backend/model');
  if (/作为(?:一个)?AI|语言模型|系统提示|提示词要求/u.test(item.content)) deterministicFailures.push('turn ' + item.turn + ': broke RP frame');
}
if (pageErrors.filter(x => x !== 'Error: Not Found').length) deterministicFailures.push('browser page errors: ' + JSON.stringify(pageErrors));
if (judge.parse_error) deterministicFailures.push('judge JSON parse failed');
if (!judge.parse_error) {
  if (Number(judge.overall || 0) < 75) deterministicFailures.push('judge overall below 75: ' + judge.overall);
  for (const axis of ['world_fidelity', 'user_agency', 'npc_independence', 'temporal_continuity']) {
    if (Number(judge[axis] || 0) < 4) deterministicFailures.push('judge axis below 4: ' + axis + '=' + judge[axis]);
  }
  if ((judge.failures || []).some(x => Number(x.severity || 0) >= 5)) deterministicFailures.push('judge found severity-5 failure');
}
report.deterministicFailures = deterministicFailures;
report.status = deterministicFailures.length ? 'FAIL' : 'PASS';
await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (deterministicFailures.length) throw new Error('real ST long RP failed: ' + JSON.stringify(deterministicFailures));

