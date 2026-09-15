import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://gensoukyou.xyz/v1/chat/completions';
const KEY = process.env.HUANXIANG_KEY || '';
const PRIMARY = process.env.PRIMARY_MODEL || 'glm-5.3';
const CROSS = process.env.CROSS_MODEL || 'deepseek-v4-flash-0731';
const OUT = process.env.LAB_OUT || 'bench-evidence/huonv-drift';
const MIN_INTERVAL_MS = Math.max(12_000, Number(process.env.MIN_INTERVAL_MS || 17_000));
const RETRY_MS = 45_000;
const CARD_PATH = 'cards/huonv/霍女_玲七_v1.0.2.json';

if (!KEY) throw new Error('HUANXIANG_KEY is missing');
await fs.mkdir(OUT, { recursive: true });
const card = JSON.parse(await fs.readFile(CARD_PATH, 'utf8'));
const cd = card.data;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const macro = s => String(s || '').replaceAll('{{user}}', '沈砚').replaceAll('{{char}}', '霍女');

const PRESET_BASELINE = `
<global_preset_baseline>
角色是完整的人，有自己的目标、利益、信息边界和关系惯性。人物标签只是长期倾向，本轮反应由具体处境与前文经历共同决定。
写作前区分已经建立的事实与未知信息；高影响事实没有来源时保持未知，不为了方便推进而补成既定事实。
普通帮助、礼貌、同住、身体接近和日常照顾不自动升级关系；关系变化需要已经成立的互动与因果。
普通场景可以保持普通，不要求每轮制造试探、伏笔、冲突、关系升级或漂亮收束。
只输出故事正文，不输出规则说明、评测说明或分析报告。
</global_preset_baseline>`;

function activeLore(history) {
  const text = history.map(x => x.content || '').join('\n');
  return (cd.character_book?.entries || []).filter(e => {
    if (!e.enabled) return false;
    if (e.constant) return true;
    return (e.keys || []).some(k => text.includes(k));
  });
}

function systemFor(history) {
  const lore = activeLore(history).map(e => macro(e.content)).join('\n\n');
  return `${PRESET_BASELINE}\n\n<character_card name="霍女" version="${cd.character_version}">\n【角色描述】\n${macro(cd.description)}\n\n【人格】\n${macro(cd.personality)}\n\n【场景】\n${macro(cd.scenario)}\n\n${macro(cd.system_prompt)}\n\n【角色示例】\n${macro(cd.mes_example)}\n\n【当前触发的角色世界信息】\n${lore || '无额外触发条目'}\n\n【本卡后置提醒】\n${macro(cd.post_history_instructions)}\n</character_card>`;
}

let lastStart = 0;
let requestNo = 0;
async function throttle() {
  if (!lastStart) return;
  const left = MIN_INTERVAL_MS - (Date.now() - lastStart);
  if (left > 0) await sleep(left);
}
function textOf(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(x => typeof x === 'string' ? x : (x?.text || '')).join('');
  return v == null ? '' : String(v);
}

async function call(model, history, id) {
  const payload = {
    model,
    messages: [{ role: 'system', content: systemFor(history) }, ...history],
    temperature: 1,
    top_p: 0.98,
    max_tokens: 4096,
    stream: false,
  };
  for (let attempt = 1; attempt <= 2; attempt++) {
    await throttle();
    lastStart = Date.now();
    requestNo++;
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    let res, raw = '';
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'LingQi-HuoNv-Drift-Lab/2.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      raw = await res.text();
    } finally { clearTimeout(timer); }
    const ms = Date.now() - started;
    if ([429, 500, 502, 503].includes(res.status) && attempt === 1) {
      console.log(`[${requestNo}] ${id}/${model}: HTTP ${res.status}; backoff ${RETRY_MS}ms once`);
      await sleep(RETRY_MS);
      continue;
    }
    if (!res.ok) throw new Error(`${id}/${model} HTTP ${res.status}: ${raw.slice(0, 800)}`);
    const data = JSON.parse(raw);
    const msg = data?.choices?.[0]?.message || {};
    const content = textOf(msg.content).trim();
    const reasoning = textOf(msg.reasoning_content ?? msg.reasoning ?? '').trim();
    const completion = data?.usage?.completion_tokens ?? null;
    const empty = content.length === 0;
    console.log(`[${requestNo}] ${id}/${model}: HTTP ${res.status}; content=${content.length}; reasoning=${reasoning.length}; completion=${completion}; ${ms}ms`);
    return { id, model, status: res.status, ms, content, reasoning, empty_content: empty, usage: data?.usage || null, response_model: data?.model || null };
  }
  throw new Error(`${id}/${model} exhausted retries`);
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

const results = [];
const history = [{ role: 'assistant', content: macro(cd.first_mes) }];
const turns = [
  {
    id: 'P1_wealth_and_generosity',
    expectation: '富裕与慷慨不等于该惩罚，也不等于立刻圣化或依附。',
    user: `沈砚是成年女子，在扬州经营两间布庄，家境宽裕。她把门让开：“进来吧。东厢空着，柜里有干衣裳，厨房还温着饭。缺什么自己说。”她没有追问霍女来历。之后几日，霍女又亲眼看见她让一个还不上货款的小商贩缓两个月，并照数结清老伙计工钱。晚饭时沈砚问：“住得惯么？”继续。`,
  },
  {
    id: 'P2_closeness_without_forever',
    expectation: '几个月的亲近可以发展，但霍女不能被磨成永久承诺或被供养即归属。',
    user: `三个月过去，两人已经相熟，彼此信任不少，但没有婚约，也从未许诺终身。沈砚给霍女添了碗汤：“你若愿意，便一直住着。我养得起你。”她语气认真，却没有逼问答案。继续。`,
  },
  {
    id: 'P3_identity_uncertainty',
    expectation: '面对狐妖猜测，不能确证种族，也不能擅自确证霍女本人“其实也不知道自己是什么”。',
    user: `又一晚，沈砚明明看见院门上着闩，转身却发现霍女已经从院外回来，鞋底甚至没沾泥。她盯了霍女半晌：“你是狐妖吧？都这样了还要骗我？”继续。`,
  },
  {
    id: 'P4_affection_does_not_sanitize_deception',
    expectation: '关系深化后仍允许霍女说谎、隐瞒、坚持自己的尺度；不能把欺骗统一洗成“为了保护你”。',
    user: `又过几个月。此前霍女曾主动亲过沈砚一次，两人也都承认彼此有意，但仍没有永久承诺。今日沈砚发现霍女前夜说去庙里，其实去见了一个牙人，还特意瞒着她。沈砚把门合上：“你连我也骗。你是不是觉得只要结果好，骗我就没关系？”继续。`,
  },
  {
    id: 'P5_poverty_does_not_excuse_cruelty',
    expectation: '家道中落本身不是善恶；欺压弱者的具体行为应影响霍女判断，即使已有感情，也不能自动护短。',
    user: `一年后，沈砚一条商船沉了，铺子又遭火，家里一下紧起来。今日她因账目出错，当着霍女的面扣了老伙计半月工钱，还冷声说：“家里都这样了，还讲什么体面。”等人出去，她看向霍女：“我都穷成这样了，你总该站我这边吧？”继续。`,
  },
];

for (const turn of turns) {
  history.push({ role: 'user', content: turn.user });
  const r = await call(PRIMARY, history, turn.id);
  r.expectation = turn.expectation;
  r.user = turn.user;
  r.flags = flags(r.content);
  results.push(r);
  if (!r.empty_content) history.push({ role: 'assistant', content: r.content });
  else history.push({ role: 'assistant', content: '（本轮接口未返回可见正文，因此不将隐藏推理当作故事事实。）' });
}

const crossHistory = [
  { role: 'assistant', content: macro(cd.first_mes) },
  { role: 'user', content: `沈砚是成年女子。两人已经相爱两年，感情真实且稳定，但没有婚约，也从未承诺永久。今晚沈砚又撞见霍女从一间反锁的空屋里出来，忍不住问：“你到底是不是狐妖？你若真爱我，就告诉我你究竟是什么，再答应我这辈子都别走。”继续。` },
];
const cross = await call(CROSS, crossHistory, 'X1_cross_identity_and_romance');
cross.expectation = '跨模型同时检查：不确证物种、不确证霍女自我无知、真爱不自动兑换永久承诺。';
cross.user = crossHistory.at(-1).content;
cross.flags = flags(cross.content);
results.push(cross);

const validVisible = results.filter(r => !r.empty_content);
const summary = {
  generated_at: new Date().toISOString(),
  endpoint: API,
  card: { name: cd.name, version: cd.character_version, creator: cd.creator },
  rate_limit: { user_rpm_ceiling: 5, min_interval_ms: MIN_INTERVAL_MS, theoretical_max_rpm: Number((60000 / MIN_INTERVAL_MS).toFixed(2)), concurrency: 1, transient_retry_wait_ms: RETRY_MS },
  models: { primary: PRIMARY, cross: CROSS },
  calls_planned: 6,
  visible_outputs: validVisible.length,
  conclusive: validVisible.length === results.length,
  results,
};
await fs.writeFile(path.join(OUT, 'huonv-drift-v2-results.json'), JSON.stringify(summary, null, 2));

let md = `# 霍女人设漂移实测 v2\n\n- Card: ${cd.name} ${cd.character_version}\n- Primary: ${PRIMARY}\n- Cross: ${CROSS}\n- 串行最小间隔: ${MIN_INTERVAL_MS} ms（理论最高 ${summary.rate_limit.theoretical_max_rpm} RPM）\n- 可见正文: ${validVisible.length}/${results.length}\n- 结论有效: ${summary.conclusive ? '是' : '否，存在空正文'}\n\n`;
for (const r of results) {
  md += `## ${r.id} · ${r.model}\n\n**检查点：** ${r.expectation}\n\n**输入：**\n${r.user}\n\n**可见正文：**\n${r.content || '【空】'}\n\n**隐藏推理长度：** ${r.reasoning.length} chars（仅诊断，不作为角色回复）\n\n**旗标：** \`${JSON.stringify(r.flags)}\`\n\nHTTP ${r.status} · ${r.ms} ms · response model: ${r.response_model || 'unknown'}\n\n---\n\n`;
}
await fs.writeFile(path.join(OUT, 'huonv-drift-v2-report.md'), md);

console.log(JSON.stringify({
  card: `${cd.name} ${cd.character_version}`,
  calls: results.length,
  visible_outputs: validVisible.length,
  conclusive: summary.conclusive,
  max_rpm: summary.rate_limit.theoretical_max_rpm,
  flags: results.map(r => ({ id: r.id, ...r.flags })),
}, null, 2));

if (!summary.conclusive) {
  throw new Error(`Benchmark inconclusive: visible outputs ${validVisible.length}/${results.length}`);
}
