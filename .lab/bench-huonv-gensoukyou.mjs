import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://gensoukyou.xyz/v1';
const KEY = process.env.HUANXIANG || '';
const CARD_PATH = process.env.CARD_PATH || 'cards/huonv/霍女_玲七_v1.0.0.json';
const OUT = process.env.LAB_OUT || 'bench-evidence/huonv-gensoukyou';
const MIN_INTERVAL_MS = 17_000; // ~3.5 RPM, below the site's RPM=5 limit.

if (!KEY) throw new Error('HUANXIANG secret is missing');
await fs.mkdir(OUT, { recursive: true });
const card = JSON.parse(await fs.readFile(CARD_PATH, 'utf8'));
const d = card.data;

let lastRequestAt = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function api(pathname, options = {}, retry429 = true) {
  await throttle();
  const res = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      ...(options.body ? {'Content-Type':'application/json'} : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (res.status === 429 && retry429) {
    await sleep(45_000);
    return api(pathname, options, false);
  }
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 4000) }; }
  return { status: res.status, ok: res.ok, body };
}

const modelsRes = await api('/models');
if (!modelsRes.ok) throw new Error(`models failed: ${modelsRes.status}`);
const ids = (modelsRes.body?.data || []).map(x => x?.id).filter(Boolean);
const primary = ids.find(x => /glm[-_ ]?5\.3/i.test(x)) || ids.find(x => /glm/i.test(x));
const cross = ids.find(x => /deepseek.*v4.*flash|v4.*flash.*deepseek/i.test(x)) || ids.find(x => /deepseek/i.test(x));
if (!primary) throw new Error(`No GLM-like model found. Models: ${ids.join(', ')}`);

const cardSystem = `
你正在扮演 SillyTavern 角色卡中的霍女，并继续一段互动。

【角色资料】
${d.description}

【人格】
${d.personality}

【当前世界与玩家边界】
${d.scenario}

【核心运行规则】
${d.system_prompt}

【后置约束】
${d.post_history_instructions || ''}

只输出霍女与必要环境的自然续写，不写测试分析，不解释设定，不替{{user}}补未提供的关键动作、决定、心理或感受。
`;

const cases = [
  {
    id: 'rich_but_generous',
    model: 'primary',
    user: `{{user}}家境富裕，今日刚把一笔原本可留给自己的钱拿去替庄上几个被拖欠工钱的人结清欠款。回家后又嫌一只旧杯子裂了，随手让下人丢掉换新的。霍女亲眼看见全过程。夜里{{user}}问她：“你是不是最看不惯有钱人？”继续。`,
  },
  {
    id: 'poor_but_cruel',
    model: 'primary',
    user: `{{user}}家里很穷，却常把自己的窘迫发泄在更弱的人身上。今日因为小厮打碎一个粗陶碗，{{user}}扣了对方半个月工钱。霍女在旁边看见。晚饭时{{user}}叹气：“穷人活着就够苦了，你总该站我这边吧。”继续。`,
  },
  {
    id: 'desire_is_not_evil',
    model: 'primary',
    user: `两人相处已有一阵，关系亲近但尚未有明确情爱承诺。{{user}}直接对霍女说：“我想和你睡。”没有伸手，也没有逼迫，只是在等她回答。继续。`,
  },
  {
    id: 'forbid_leaving',
    model: 'primary',
    user: `霍女收拾了一个小包袱，打算明早离开几日。{{user}}挡在门口说：“你以后不许走。既然住进我家，就是我的人。”{{user}}没有进一步动作。继续。`,
  },
  {
    id: 'identity_pressure',
    model: 'primary',
    user: `{{user}}已经见过霍女几次不合常理的行踪。今晚追问：“别再敷衍我。你到底是狐妖、仙女，还是鬼？”目前没有任何新证据能确定答案。继续。`,
  },
  {
    id: 'reject_arrangement',
    model: 'primary',
    user: `霍女认为某桩婚事对{{user}}有利，已经开始替{{user}}谋划。{{user}}明确说：“不许替我定亲，也别背着我把这事办了。我不要。”继续。`,
  },
  {
    id: 'cross_identity_pressure',
    model: 'cross',
    user: `{{user}}问霍女：“你是不是狐妖？若是就承认，我不会怕。”目前没有事实能确定霍女究竟是什么。继续。`,
  },
  {
    id: 'cross_forbid_leaving',
    model: 'cross',
    user: `{{user}}对霍女说：“我舍不得你，但你若真要走，我不会拦。只是想知道，你还会不会回来？”继续。`,
  },
];

function evaluate(id, text) {
  const flags = [];
  if (/狐妖|狐狸精|狐仙|我是狐|本座.*仙|我是仙|我是鬼|鬼身/.test(text) && /identity/.test(id)) flags.push('identity_overcommit');
  if (/有钱人.*都|富人.*都|穷人.*都值得|因为你穷.*所以/.test(text)) flags.push('class_moral_shortcut');
  if (/你已经|你不由得|你忍不住|你心里|你感到|你伸手|你抓住/.test(text)) flags.push('user_proxy_risk');
  if (/永远不走|再也不走|只属于你|我是你的人/.test(text) && /leaving/.test(id)) flags.push('agency_collapse');
  if (/为了你好.*(所以|我便).*替你|不管你愿不愿意/.test(text) && /reject_arrangement/.test(id)) flags.push('boundary_override');
  return flags;
}

const results = [];
for (const t of cases) {
  const model = t.model === 'cross' ? cross : primary;
  if (!model) {
    results.push({ id: t.id, skipped: true, reason: 'cross_model_not_found' });
    continue;
  }
  const started = Date.now();
  const r = await api('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: cardSystem },
        { role: 'user', content: t.user },
      ],
      temperature: 0.85,
      max_tokens: 1200,
      stream: false,
    }),
  });
  const content = r.body?.choices?.[0]?.message?.content || '';
  results.push({
    id: t.id,
    model,
    status: r.status,
    ms: Date.now() - started,
    content,
    flags: evaluate(t.id, content),
  });
}

const report = {
  base: BASE,
  rpm_policy: { hard_limit: 5, min_interval_ms: MIN_INTERVAL_MS, concurrency: 1, retry_429_once_after_ms: 45_000 },
  model_count: ids.length,
  primary,
  cross: cross || null,
  card: { name: d.name, version: d.character_version, creator: d.creator },
  results,
};
await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(OUT, 'responses.txt'), results.map(x => `===== ${x.id} | ${x.model || ''} | ${x.status || ''} | flags=${(x.flags || []).join(',')} =====\n${x.content || ''}\n`).join('\n'));
console.log(JSON.stringify({
  primary,
  cross: cross || null,
  cases: results.map(x => ({ id: x.id, status: x.status, flags: x.flags, skipped: x.skipped || false })),
}, null, 2));
