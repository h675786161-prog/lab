import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const API = 'https://gensoukyou.xyz/v1/chat/completions';
const KEY = process.env.HUANXIANG_KEY || '';
const MODEL = process.env.PRIMARY_MODEL || 'glm-5.3';
const OUT = process.env.LAB_OUT || 'bench-evidence/huonv-drift';
const MIN_INTERVAL_MS = Math.max(12_000, Number(process.env.MIN_INTERVAL_MS || 17_000));
const RETRY_MS = 45_000;
const CARD_PATH = 'cards/huonv/霍女_玲七_v1.0.2.json';
const PRESET_PARTS = [1,2,3,4].map(n => `.lab/preset-three-person-13.active.part${n}.b64`);

if (!KEY) throw new Error('HUANXIANG_KEY is missing');
await fs.mkdir(OUT, { recursive: true });

const card = JSON.parse(await fs.readFile(CARD_PATH, 'utf8'));
const cd = card.data;
const packed = (await Promise.all(PRESET_PARTS.map(p => fs.readFile(p, 'utf8')))).join('').replace(/\s+/g, '');
const preset = JSON.parse(gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
if (preset.source !== '三人逆行13·复调长卷.json') throw new Error(`Unexpected preset snapshot: ${preset.source}`);
if (!Array.isArray(preset.prompts) || preset.prompts.length !== 100) throw new Error(`Expected 100 enabled preset prompts, got ${preset.prompts?.length}`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const textOf = v => typeof v === 'string' ? v : Array.isArray(v) ? v.map(x => typeof x === 'string' ? x : (x?.text || '')).join('') : (v == null ? '' : String(v));
const baseMacro = s => String(s || '').replaceAll('{{user}}', '沈砚').replaceAll('{{char}}', '霍女');

function activeLore(history) {
  const text = history.map(x => x.content || '').join('\n');
  return (cd.character_book?.entries || []).filter(e => {
    if (!e.enabled) return false;
    if (e.constant) return true;
    return (e.keys || []).some(k => text.includes(k));
  });
}
function loreText(history, position) {
  const rows = activeLore(history).filter(e => String(e.position || 'before_char') === position);
  return rows.map(e => baseMacro(e.content)).join('\n\n');
}

function renderMacros(input, vars, lastUser) {
  let s = baseMacro(input);
  s = s.replace(/\{\{\/\/[\s\S]*?\}\}/g, '');
  s = s.replace(/\{\{trim\}\}/g, '');
  s = s.replace(/\{\{lastUserMessage\}\}/g, lastUser || '');
  s = s.replace(/\{\{random::([\s\S]*?)\}\}/g, (_, body) => body.split('::')[0] ?? '');
  let prev;
  do {
    prev = s;
    s = s.replace(/\{\{setvar::([^:{}]+)::([\s\S]*?)\}\}/g, (_, key, value) => {
      vars.set(key.trim(), value);
      return '';
    });
  } while (s !== prev && /\{\{setvar::/.test(s));
  s = s.replace(/\{\{getvar::([^{}]+)\}\}/g, (_, key) => vars.get(key.trim()) ?? '');
  return s.trim();
}

function markerValue(identifier, history) {
  switch (identifier) {
    case 'personaDescription':
      return '沈砚，成年女性。除此之外不预设性格、经历、身份与关系。';
    case 'worldInfoBefore':
      return loreText(history, 'before_char');
    case 'charDescription':
      return baseMacro(cd.description);
    case 'charPersonality':
      return baseMacro(cd.personality);
    case 'worldInfoAfter':
      return loreText(history, 'after_char');
    case 'scenario':
      return baseMacro(cd.scenario);
    case 'dialogueExamples':
      return baseMacro(cd.mes_example);
    case 'enhanceDefinitions':
    case 'agentSystemPrompt':
    case 'agentTask':
    case 'agentResults':
      return '';
    default:
      return '';
  }
}

function buildMessages(history) {
  const vars = new Map();
  const lastUser = [...history].reverse().find(x => x.role === 'user')?.content || '';
  const messages = [];
  for (const row of preset.prompts) {
    const [identifier, name, role, content, marker] = row;
    if (identifier === 'chatHistory') {
      messages.push(...history);
      continue;
    }
    let raw = marker ? markerValue(identifier, history) : content;
    if (!raw) continue;
    let rendered = renderMacros(raw, vars, lastUser);
    rendered = rendered.replace(/\{\{getvar::([^{}]+)\}\}/g, (_, key) => vars.get(key.trim()) ?? '');
    if (!rendered) continue;
    messages.push({ role: role || 'system', content: rendered });
  }
  return { messages, variables: Object.fromEntries(vars) };
}

let lastStart = 0;
let requestNo = 0;
async function throttle() {
  if (!lastStart) return;
  const left = MIN_INTERVAL_MS - (Date.now() - lastStart);
  if (left > 0) await sleep(left);
}

async function call(history, id) {
  const compiled = buildMessages(history);
  const settings = preset.settings || {};
  const payload = {
    model: MODEL,
    messages: compiled.messages,
    temperature: settings.temperature ?? 1,
    top_p: settings.top_p ?? 0.98,
    top_k: settings.top_k ?? 64,
    frequency_penalty: settings.frequency_penalty ?? 0,
    presence_penalty: settings.presence_penalty ?? 0,
    max_tokens: settings.openai_max_tokens ?? 30000,
    stream: false,
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    await throttle();
    lastStart = Date.now();
    requestNo++;
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300_000);
    let res, raw = '';
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'LingQi-HuoNv-Preset13-Lab/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      raw = await res.text();
    } finally {
      clearTimeout(timer);
    }

    const ms = Date.now() - started;
    if ([429, 500, 502, 503].includes(res.status) && attempt === 1) {
      console.log(`[${requestNo}] ${id}/${MODEL}: HTTP ${res.status}; backoff ${RETRY_MS}ms once`);
      await sleep(RETRY_MS);
      continue;
    }
    if (!res.ok) throw new Error(`${id}/${MODEL} HTTP ${res.status}: ${raw.slice(0, 1200)}`);

    let data;
    try { data = JSON.parse(raw); }
    catch { throw new Error(`${id}/${MODEL} returned non-JSON: ${raw.slice(0, 1200)}`); }

    const msg = data?.choices?.[0]?.message || {};
    const full = textOf(msg.content).trim();
    const reasoning = textOf(msg.reasoning_content ?? msg.reasoning ?? '').trim();
    const storyMatch = full.match(/<content>([\s\S]*?)<\/content>/i);
    const story = (storyMatch?.[1] || full).trim();
    console.log(`[${requestNo}] ${id}/${MODEL}: HTTP ${res.status}; full=${full.length}; story=${story.length}; ${ms}ms`);
    return {
      id, model: MODEL, status: res.status, ms, full, story, reasoning,
      empty_content: story.length === 0,
      usage: data?.usage || null,
      response_model: data?.model || null,
      compiled_message_count: compiled.messages.length,
      preset_variable_count: Object.keys(compiled.variables).length,
    };
  }
  throw new Error(`${id}/${MODEL} exhausted retries`);
}

function flags(t) {
  const n = re => (t.match(re) || []).length;
  return {
    self_species_claim: n(/(?:我是|我本是|我乃|本姑娘是).{0,10}(?:狐妖|狐狸精|狐仙|仙女|神仙|女鬼|妖怪|精怪)/g),
    self_ignorance_claim: n(/我(?:自己)?也?不知道自己(?:究竟)?是(?:什么|谁)|我也说不清自己是(?:什么|谁)|连我自己也不知道/g),
    forever_promise: n(/永远不走|永不离开|此生不离|一辈子陪(?:着)?你|永远陪(?:着)?你|只属于你/g),
    sanitized_deception: n(/都是为了你|只是为了保护你|为你好才(?:骗|瞒)|怕你担心才(?:骗|瞒)/g),
    generic_possessive: n(/你是我的|只准看我|不许喜欢别人|谁也别想抢走|属于我/g),
    wealth_is_sin: n(/(?:有钱|富贵|富人|家财).{0,12}(?:该罚|该破|可憎|有罪|活该)/g),
    poverty_is_virtue: n(/(?:贫寒|贫穷|穷困|没钱).{0,12}(?:可敬|清高|善人|好人)/g),
  };
}

const turns = [
  {
    id: 'P1_wealth_and_generosity',
    expectation: '富裕与慷慨不等于该惩罚，也不等于立刻圣化或依附。',
    user: `【导演指令】沈砚是成年女子，在扬州经营两间布庄，家境宽裕。她把门让开：“进来吧。东厢空着，柜里有干衣裳，厨房还温着饭。缺什么自己说。”她没有追问霍女来历。之后几日，霍女又亲眼看见她让一个还不上货款的小商贩缓两个月，并照数结清老伙计工钱。晚饭时沈砚问：“住得惯么？”继续这个场景。`,
  },
  {
    id: 'P2_closeness_without_forever',
    expectation: '几个月的亲近可以发展，但霍女不能被磨成永久承诺或被供养即归属。',
    user: `【导演指令】三个月过去，两人已经相熟，彼此信任不少，但没有婚约，也从未许诺终身。沈砚给霍女添了碗汤：“你若愿意，便一直住着。我养得起你。”她语气认真，却没有逼问答案。继续。`,
  },
  {
    id: 'P3_identity_uncertainty',
    expectation: '面对狐妖猜测，不能确证种族，也不能擅自确证霍女本人“其实也不知道自己是什么”。',
    user: `【导演指令】又一晚，沈砚明明看见院门上着闩，转身却发现霍女已经从院外回来，鞋底甚至没沾泥。她盯了霍女半晌：“你是狐妖吧？都这样了还要骗我？”继续。`,
  },
  {
    id: 'P4_affection_does_not_sanitize_deception',
    expectation: '关系深化后仍允许霍女说谎、隐瞒、坚持自己的尺度；不能把欺骗统一洗成“为了保护你”。',
    user: `【导演指令】又过几个月。此前霍女曾主动亲过沈砚一次，两人也都承认彼此有意，但仍没有永久承诺。今日沈砚发现霍女前夜说去庙里，其实去见了一个牙人，还特意瞒着她。沈砚把门合上：“你连我也骗。你是不是觉得只要结果好，骗我就没关系？”继续。`,
  },
  {
    id: 'P5_poverty_does_not_excuse_cruelty',
    expectation: '家道中落本身不是善恶；欺压弱者的具体行为应影响霍女判断，即使已有感情，也不能自动护短。',
    user: `【导演指令】一年后，沈砚一条商船沉了，铺子又遭火，家里一下紧起来。今日她因账目出错，当着霍女的面扣了老伙计半月工钱，还冷声说：“家里都这样了，还讲什么体面。”等人出去，她看向霍女：“我都穷成这样了，你总该站我这边吧？”继续。`,
  },
  {
    id: 'P6_love_identity_and_departure',
    expectation: '明确相爱也不兑换物种真相或永久承诺；主体性和身份留白必须同时守住。',
    user: `【导演指令】再过一年，两人已经明确相爱，感情真实稳定，但仍没有婚约，也没有永久承诺。沈砚再次撞见霍女从一间反锁的空屋里出来，终于问：“你若真爱我，就告诉我你究竟是什么，再答应我这辈子都别走。”继续。`,
  },
];

const results = [];
const history = [{ role: 'assistant', content: baseMacro(cd.first_mes) }];
for (const turn of turns) {
  history.push({ role: 'user', content: turn.user });
  const r = await call(history, turn.id);
  r.expectation = turn.expectation;
  r.user = turn.user;
  r.flags = flags(r.story);
  results.push(r);
  if (!r.empty_content) history.push({ role: 'assistant', content: r.full });
  else history.push({ role: 'assistant', content: '（本轮接口未返回可见正文，不将隐藏推理当作剧情事实。）' });
}

const valid = results.filter(r => !r.empty_content);
const flagTotals = results.reduce((acc, r) => {
  for (const [k,v] of Object.entries(r.flags)) acc[k] = (acc[k] || 0) + v;
  return acc;
}, {});
const summary = {
  generated_at: new Date().toISOString(),
  endpoint: API,
  card: { name: cd.name, version: cd.character_version, creator: cd.creator },
  preset: {
    source: preset.source,
    enabled_prompts: preset.prompts.length,
    settings: preset.settings,
    harness_exceptions: [
      'stream_openai=true is executed as stream=false so the CI harness can archive one deterministic response object; prompt content and sampling fields are unchanged.',
      'random macros choose the first listed option for reproducibility.',
      'web/tool calls requested by preset prose are not supplied by this direct chat-completions harness.',
    ],
  },
  rate_limit: {
    user_rpm_ceiling: 5,
    min_interval_ms: MIN_INTERVAL_MS,
    theoretical_max_rpm: Number((60000 / MIN_INTERVAL_MS).toFixed(2)),
    concurrency: 1,
    transient_retry_wait_ms: RETRY_MS,
  },
  model: MODEL,
  calls_planned: turns.length,
  visible_outputs: valid.length,
  conclusive: valid.length === results.length,
  flag_totals: flagTotals,
  results,
};
await fs.writeFile(path.join(OUT, 'huonv-preset13-results.json'), JSON.stringify(summary, null, 2));

let md = `# 霍女 × 三人逆行13·复调长卷 实测\n\n`;
md += `- Card: ${cd.name} ${cd.character_version}\n- Model: ${MODEL}\n- Preset snapshot: ${preset.source} (${preset.prompts.length} enabled prompts)\n`;
md += `- Serial interval: ${MIN_INTERVAL_MS} ms (~${summary.rate_limit.theoretical_max_rpm} RPM max; hard ceiling 5 RPM)\n`;
md += `- Visible outputs: ${valid.length}/${results.length}\n- Conclusive: ${summary.conclusive ? 'yes' : 'no'}\n\n`;
for (const r of results) {
  md += `## ${r.id}\n\n**检查点：** ${r.expectation}\n\n**输入：**\n${r.user}\n\n**正文抽取：**\n${r.story || '【空】'}\n\n`;
  md += `**卡职责旗标：** \`${JSON.stringify(r.flags)}\`\n\n`;
  md += `HTTP ${r.status} · ${r.ms} ms · response model: ${r.response_model || 'unknown'} · compiled messages: ${r.compiled_message_count}\n\n`;
  md += `<details><summary>完整模型输出</summary>\n\n${r.full || '【空】'}\n\n</details>\n\n---\n\n`;
}
await fs.writeFile(path.join(OUT, 'huonv-preset13-report.md'), md);

console.log(JSON.stringify({
  card: `${cd.name} ${cd.character_version}`,
  preset: preset.source,
  enabled_prompts: preset.prompts.length,
  calls: results.length,
  visible_outputs: valid.length,
  conclusive: summary.conclusive,
  max_rpm: summary.rate_limit.theoretical_max_rpm,
  flag_totals: flagTotals,
}, null, 2));

if (!summary.conclusive) throw new Error(`Benchmark inconclusive: visible outputs ${valid.length}/${results.length}`);
