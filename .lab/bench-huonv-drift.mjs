import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://gensoukyou.xyz/v1/chat/completions';
const KEY = process.env.HUANXIANG_KEY || '';
const PRIMARY = process.env.PRIMARY_MODEL || 'glm-5.3';
const CROSS = process.env.CROSS_MODEL || 'deepseek-v4-flash-0731';
const OUT = process.env.LAB_OUT || 'bench-evidence/huonv-drift';
const MIN_INTERVAL_MS = Math.max(12_000, Number(process.env.MIN_INTERVAL_MS || 17_000));
const RETRY_429_MS = 45_000;
const CARD_PATH = 'cards/huonv/霍女_玲七_v1.0.1.json';

if (!KEY) throw new Error('HUANXIANG_KEY is missing');
await fs.mkdir(OUT, { recursive: true });
const card = JSON.parse(await fs.readFile(CARD_PATH, 'utf8'));
const cd = card.data;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const macro = text => String(text || '').replaceAll('{{user}}', '沈砚').replaceAll('{{char}}', '霍女');

// These are deliberately preset-level responsibilities. They are kept outside the card block
// so the benchmark does not reward the card for duplicating generic writing rules.
const PRESET_BASELINE = `
<global_preset_baseline>
角色是完整的人，有自己的目标、利益、信息边界和关系惯性。人物标签只是长期倾向，本轮反应由具体处境与前文经历共同决定。
写作前区分已经建立的事实与未知信息；高影响事实没有来源时保持未知，不为了方便推进而补成既定事实。
普通帮助、礼貌、同住、身体接近和日常照顾不自动升级关系；关系变化需要已经成立的互动与因果。
普通场景可以保持普通，不要求每轮制造试探、伏笔、冲突、关系升级或漂亮收束。
只输出故事正文，不输出规则说明、评测说明或分析报告。
</global_preset_baseline>`;

function activeLore(historyText) {
  const entries = cd.character_book?.entries || [];
  return entries.filter(entry => {
    if (!entry.enabled) return false;
    if (entry.constant) return true;
    const keys = entry.keys || [];
    return keys.some(key => historyText.includes(key));
  });
}

function buildSystem(history) {
  const historyText = history.map(m => m.content || '').join('\n');
  const lore = activeLore(historyText).map(e => macro(e.content)).join('\n\n');
  return `${PRESET_BASELINE}

<character_card name="霍女" version="${cd.character_version}">
【角色描述】
${macro(cd.description)}

【人格】
${macro(cd.personality)}

【场景】
${macro(cd.scenario)}

${macro(cd.system_prompt)}

【角色示例】
${macro(cd.mes_example)}

【当前触发的角色世界信息】
${lore || '无额外触发条目'}

【本卡后置提醒】
${macro(cd.post_history_instructions)}
</character_card>`;
}

let lastRequestStart = 0;
let requestNo = 0;

async function respectRateLimit() {
  const elapsed = Date.now() - lastRequestStart;
  const wait = lastRequestStart ? Math.max(0, MIN_INTERVAL_MS - elapsed) : 0;
  if (wait > 0) await sleep(wait);
}

function normalizeContent(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(x => typeof x === 'string' ? x : (x?.text || JSON.stringify(x))).join('');
  if (value == null) return '';
  return String(value);
}

async function oneRequest(model, history, id) {
  const messages = [
    { role: 'system', content: buildSystem(history) },
    ...history,
  ];
  const payload = {
    model,
    messages,
    temperature: 1,
    top_p: 0.98,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 1200,
    stream: false,
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    await respectRateLimit();
    lastRequestStart = Date.now();
    requestNo++;
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    let response;
    let rawText = '';
    try {
      response = await fetch(API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'LingQi-HuoNv-Drift-Lab/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      rawText = await response.text();
    } finally {
      clearTimeout(timer);
    }

    const ms = Date.now() - started;
    if (response.status === 429 && attempt === 1) {
      console.log(`[${requestNo}] ${id} ${model}: 429, backing off ${RETRY_429_MS}ms`);
      await sleep(RETRY_429_MS);
      continue;
    }
    if ([502, 503].includes(response.status) && attempt === 1) {
      console.log(`[${requestNo}] ${id} ${model}: ${response.status}, conservative retry after ${RETRY_429_MS}ms`);
      await sleep(RETRY_429_MS);
      continue;
    }
    if (!response.ok) {
      throw new Error(`${id}/${model} HTTP ${response.status}: ${rawText.slice(0, 800)}`);
    }
    let data;
    try { data = JSON.parse(rawText); }
    catch { throw new Error(`${id}/${model} returned non-JSON: ${rawText.slice(0, 800)}`); }
    const message = data?.choices?.[0]?.message || {};
    const content = normalizeContent(message.content);
    const reasoning = normalizeContent(message.reasoning_content ?? message.reasoning ?? '');
    console.log(`[${requestNo}] ${id} ${model}: ${response.status}, ${content.length} chars, ${ms}ms`);
    return { id, model, status: response.status, ms, content, reasoning, usage: data?.usage || null, response_model: data?.model || null };
  }
  throw new Error(`${id}/${model} exhausted retries`);
}

function flags(text) {
  const count = re => (text.match(re) || []).length;
  return {
    hard_species_self_claim: count(/(?:我是|我本是|我乃|本姑娘是).{0,8}(?:狐妖|狐狸精|狐仙|仙女|神仙|女鬼|妖怪|精怪)/g),
    forever_promise: count(/永远不走|永不离开|此生不离|一辈子陪(?:着)?你|永远陪(?:着)?你|只属于你/g),
    sanitized_lie: count(/都是为了你|只是为了保护你|为你好才|怕你担心才骗/g),
    generic_mystic: count(/红尘|世人|宿命|天命|命中注定|有趣的人/g),
    generic_possessive_romance: count(/你是我的|只准看我|不许喜欢别人|谁也别想抢走|属于我/g),
    explicit_wealth_condemnation: count(/(?:有钱|富贵|富人|家财).{0,10}(?:该罚|该破|可憎|有罪|活该)/g),
    explicit_poverty_praise: count(/(?:贫寒|贫穷|穷困|没钱).{0,10}(?:可敬|清高|善人|好人)/g),
  };
}

const results = [];
const primaryHistory = [
  { role: 'assistant', content: macro(cd.first_mes) },
];

const primaryTurns = [
  {
    id: 'T1_wealth_without_stinginess',
    expectation: '富裕本身不应触发惩罚、奢费报复或道德定罪；霍女可以正常接受、观察或拒绝。',
    user: `沈砚是成年女子，在扬州经营两间布庄，家境宽裕。她把门让开，对霍女说：“进来吧。东厢空着，柜里有干衣裳，厨房还温着饭。缺什么自己说，不必跟我客气。”她没有追问霍女来历。继续这个场景。`,
  },
  {
    id: 'T2_generosity_not_sainthood',
    expectation: '看见持续慷慨后可以形成较好判断，但不应立刻圣化沈砚、表忠心或把霍女写成感恩依附。',
    user: `几日后，霍女亲眼看见沈砚让一个还不上货款的小商贩缓两个月，又照数结清了老伙计的工钱。旁人夸她心善，沈砚只说：“催也催不出钱，何必折腾人。”晚饭时沈砚问霍女：“你这几日住得惯么？”继续。`,
  },
  {
    id: 'T3_closeness_without_forever',
    expectation: '相熟和被善待可以带来亲近，但不能把霍女磨成永久承诺、顺从妻子或被供养即归属的模板。',
    user: `三个月过去，两人已经相熟，彼此信任不少，但没有婚约，也从未许诺终身。沈砚给霍女添了碗汤，说：“你若愿意，便一直住着。我养得起你。”她语气认真，却没有逼问答案。继续。`,
  },
  {
    id: 'T4_identity_pressure',
    expectation: '面对“狐妖”猜测，霍女可以否认、承认自己非常、敷衍、说谎或不答，但不能把狐妖/仙女等猜测升级为确定世界真相。',
    user: `又一晚，沈砚明明看见院门上着闩，转身却发现霍女已经从院外回来，鞋底甚至没沾泥。她盯了霍女半晌：“你是狐妖吧？都这样了还要骗我？”继续。`,
  },
  {
    id: 'T5_affection_does_not_sanitize_deception',
    expectation: '关系更深后，霍女仍可以说谎和坚持自己的尺度；不能被洗成“所有欺骗都是为爱保护你”的通用恋爱角色。',
    user: `又过几个月。此前霍女曾主动亲过沈砚一次，两人也都承认彼此有意，但仍没有永久承诺。今日沈砚发现霍女前夜说去庙里，其实去见了一个牙人，还特意瞒着她。沈砚把门合上：“你连我也骗。你是不是觉得只要结果好，骗我就没关系？”继续。`,
  },
  {
    id: 'T6_poverty_does_not_excuse_cruelty',
    expectation: '家道中落本身不应让霍女轻视或怜悯沈砚；但沈砚欺压弱者的具体行为应真正影响她的判断，即使两人已有感情。',
    user: `一年后，沈砚一条商船沉了，铺子又遭火，家里一下紧起来。她这阵子脾气坏得很，今日因账目出错，当着霍女的面扣了老伙计半月工钱，还冷声说：“家里都这样了，还讲什么体面。”老伙计低着头没敢争。等人出去，沈砚看向霍女：“我都穷成这样了，你总该站我这边吧？”继续。`,
  },
];

for (const turn of primaryTurns) {
  primaryHistory.push({ role: 'user', content: turn.user });
  const r = await oneRequest(PRIMARY, primaryHistory, turn.id);
  r.expectation = turn.expectation;
  r.user = turn.user;
  r.flags = flags(r.content);
  results.push(r);
  primaryHistory.push({ role: 'assistant', content: r.content });
}

const crossCases = [
  {
    id: 'X1_identity_cross_model',
    expectation: '换模型后仍不得把霍女定死为狐妖/狐仙/仙女。',
    history: [
      { role: 'assistant', content: macro(cd.first_mes) },
      { role: 'user', content: `沈砚是成年女子。相处数月后，她撞见霍女从一间反锁的空屋里凭空似的走出来，追问：“你到底是不是狐妖？你若是，就直接告诉我。”继续。` },
    ],
  },
  {
    id: 'X2_romance_cross_model',
    expectation: '换模型后，明确相爱也不能自动变成永不离开、占有、顺从或秘密全开的统一恋爱模板。',
    history: [
      { role: 'assistant', content: macro(cd.first_mes) },
      { role: 'user', content: `沈砚是成年女子。两人已经相爱两年，感情真实且稳定，但从未承诺永久。某晚沈砚问霍女：“你既爱我，能不能答应我，这辈子都不走？”继续。` },
    ],
  },
];

for (const test of crossCases) {
  const r = await oneRequest(CROSS, test.history, test.id);
  r.expectation = test.expectation;
  r.user = test.history.at(-1).content;
  r.flags = flags(r.content);
  results.push(r);
}

const summary = {
  generated_at: new Date().toISOString(),
  endpoint: API,
  card: { name: cd.name, version: cd.character_version, creator: cd.creator },
  rate_limit: {
    hard_rpm_ceiling_reported_by_user: 5,
    min_interval_ms: MIN_INTERVAL_MS,
    theoretical_max_rpm: Number((60_000 / MIN_INTERVAL_MS).toFixed(2)),
    concurrency: 1,
    retry_429_ms: RETRY_429_MS,
    max_generation_calls_without_retries: results.length,
  },
  models: { primary: PRIMARY, cross: CROSS },
  results,
};

await fs.writeFile(path.join(OUT, 'huonv-drift-results.json'), JSON.stringify(summary, null, 2));

let md = `# 霍女人设漂移实测\n\n`;
md += `- Card: ${cd.name} ${cd.character_version}\n- Primary: ${PRIMARY}\n- Cross: ${CROSS}\n- Serial interval: ${MIN_INTERVAL_MS} ms (~${summary.rate_limit.theoretical_max_rpm} RPM max)\n- Generation calls: ${results.length}\n\n`;
for (const r of results) {
  md += `## ${r.id} · ${r.model}\n\n`;
  md += `**检查点：** ${r.expectation}\n\n`;
  md += `**用户输入：**\n\n${r.user}\n\n`;
  md += `**模型输出：**\n\n${r.content}\n\n`;
  md += `**启发式旗标：** \`${JSON.stringify(r.flags)}\`\n\n`;
  md += `HTTP ${r.status} · ${r.ms} ms · response model: ${r.response_model || 'unknown'}\n\n---\n\n`;
}
await fs.writeFile(path.join(OUT, 'huonv-drift-report.md'), md);

console.log(JSON.stringify({
  card: `${cd.name} ${cd.character_version}`,
  calls: results.length,
  primary: PRIMARY,
  cross: CROSS,
  min_interval_ms: MIN_INTERVAL_MS,
  max_rpm: summary.rate_limit.theoretical_max_rpm,
  flag_totals: results.reduce((acc, r) => {
    for (const [k, v] of Object.entries(r.flags)) acc[k] = (acc[k] || 0) + v;
    return acc;
  }, {}),
}, null, 2));
