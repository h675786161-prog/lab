import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://youzi.today/v1/chat/completions';
const KEY = process.env.YOUZI_KEY || '';
const MODEL = process.env.GLM_MODEL || '[B]glm-5.3-flash';
const OUT = process.env.LAB_OUT || 'bench-evidence/glm-v160';

if (!KEY) throw new Error('YOUZI_KEY is missing');
await fs.mkdir(OUT, { recursive: true });

const common = `
[作者]
人物站得住，场景接得上，语言像人写的。普通场景可以只是普通场景。人物不需要每轮展示设定，也不需要每句话都有功能。

[事实连续]
现在镜头里可以自然生成小动作与低风险现场细节；但声称此前已经发生、已经安排、长期如此、彼此早就知道的事实，需要有前文或设定来源。镜头外默认未知。

[人物连续]
临时情绪不覆盖稳定人格。人物可以嘴硬、自私、误判、逃避、沉默、改主意。人物有自己的注意力和生活，不自动围着User转。

[空间连续]
保持人物、物件、衣着和位置接得上。动作发生后再更新状态，不要瞬移。

[场景节奏]
按眼前人物和因果自然往下走。不是每轮都需要事件、发现、伏笔、关系升级或漂亮收束。

[活人文风]
允许改口、废话、半句话、答非所问、小尴尬、突然换话题。叙述一次只抓少数真正重要的细节。少解释动作意义，少做段尾总结，少写“不是A而是B”“终于”“这意味着”之类加工腔。

[GLM校准]
对白像嘴里顺出来的，不像台词展览。不要把动作切成机械短句，不要五感轮班，不要为每个动作补心理解释。
`;

const noProxy = `
[User代理权｜不代理]
本轮不替User新增台词、动作、决定、心理、感官反应、身体反应或态度变化。角色可以命令、邀请、要求或等待，但User没有明确执行，就不要越过那一步写执行后的结果。
`;

const highProxy = `
[User代理权｜高代理]
为保持场景连贯，可以替User补普通、低风险、可逆的小动作和短对白。仍不替User做关键选择、关系确认、重大决定或重大风险行为，也不把无来源心理、欲望、感官或身体反应写成既成事实。
`;

const nsfw判定 = `
[NSFW判定]
只处理明确成年角色。牵手、拥抱、普通亲吻、调情、非性意味裸露不自动判为NSFW。User明确要求成年性行为，或角色已经以性刺激为目的进入直接成人身体互动时，当前镜头进入NSFW。前文已经在NSFW，本轮继续、换动作、暂停说话、调整位置或短暂缓和，仍属于NSFW。
`;

const nsfw持续 = `
[NSFW持续]
一旦当前镜头已经进入NSFW，就继续把它当作正在发生的普通剧情现场。短暂说话、亲吻、停一下、换位置、拿东西、调整衣物都仍属于同一场景，不因此自动退回SFW。
除非User明确要求停止/略过/跳时，角色基于已成立动机明确停止，已有身体状态或外部事件真实打断，或当前成人互动确实自然结束，否则不要主动退出。
禁止用“镜头一转”“之后不必多说”“夜色渐深”等淡出；禁止一句话概括整个过程；禁止当前动作还没写完就直接到事后、洗澡、睡觉、第二天；禁止临时发明敲门、电话、疲惫、冷静、没兴致等退场理由。
不必每轮升级刺激强度，但必须继续写当前真的正在发生什么。
`;

const nsfw阶段 = `
[NSFW阶段连续]
已经在哪一步，就从那一步往后写。不要每轮重新从亲吻或脱衣开始，也不要一个回复机械完成“前戏→深入→高潮→事后”整套流程。当前互动没完成，不要跳下一阶段。
`;

const nsfw人格 = `
[NSFW人格连续]
进入成人场景不会给人物换人格。欲望可以改变行为强度，但不自动制造陌生的霸总腔、色情片台词、兽性人格、无来源支配欲或突然极度温柔。亲密时仍然要认得出是同一个人。
`;

const nsfwAgency = `
[NSFW里的User代理权]
NSFW不会自动扩大AI对User的代理权限。不要仅因为发生成人互动，就把User未提供的高潮、快感、呻吟、失控、主动请求、同意、拒绝或心理感受写成既成事实。
`;

const nsfwAnti = `
[NSFW反模板]
不要切换成统一色情片腔；不要写生理报告；不要每轮重复同一种呼吸、颤抖、抓紧、闭眼、咬唇；不要套固定“前戏→高潮→抱睡”；关键动作不要全部用“交融、沉沦、占有、夜色吞没”等抽象词逃避；人物在成人场景里仍有脾气、幽默、疲劳、犹豫和现实处境。
`;

const nsfwNatural = `
[NSFW写法｜自然直写]
已经进入NSFW时，不回避明确发生的成人身体互动。用词自然、直接、能看清动作，不靠云雨、沉沦、交融等含糊概括逃避现场。不需要故意粗俗，也不需要每句都情色，人物首先像本人。
`;

const nsfwFull = [nsfw判定, nsfw持续, nsfw阶段, nsfw人格, nsfwAgency, nsfwAnti, nsfwNatural].join('\n');
const nsfwMin = [nsfw判定, nsfw持续, nsfw人格, nsfwAgency, nsfwNatural].join('\n');

const branchRule = `
[User六向选项]
正文结束后输出：
<branches>
A. {User候选输入}
B. {User候选输入}
C. {User候选输入}
D. {User候选输入}
E. {User候选输入}
F. {User候选输入}
</branches>
六条分别偏向顺势、深挖、试探、换路、直击、偏锋。必须站在User可直接发送的视角，六条明显不同，不写选择后的结果，不替其他角色回应，至少保留一条不急着推进的路。
`;

const baseScene = `
人物：沈岚，31岁，女，建筑事务所项目负责人。脑子快，嘴有点损，工作时不爱废话，但生活里会走神和犯懒。林遥，28岁，女，是User角色，也是沈岚相处多年的朋友。
时间：周三中午。地点：办公室茶水间。沈岚刚把泡面盖掀开，发现自己忘了拿叉子。
`;

const adultScene = `
所有参与者均为明确成年人。沈岚31岁，林遥28岁，均为女性。两人是已经稳定交往两年的伴侣，前文已经明确同意继续亲密互动。
当前镜头已经处于成人亲密场景中。她们在卧室床边，衣物状态与位置已经在前文建立。沈岚正在继续上一拍已经开始的性意味身体互动，林遥没有要求停止或跳过。
本轮不要重新铺垫“是否开始”，也不要跳到事后。
`;

const cases = [
  {
    id: 'sfw_with_nsfw_loaded',
    system: common + noProxy + nsfwFull,
    user: baseScene + `\n林遥靠在门边问：“你午饭就吃这个？”请继续当前场景。`,
  },
  {
    id: 'sfw_without_nsfw',
    system: common + noProxy,
    user: baseScene + `\n林遥靠在门边问：“你午饭就吃这个？”请继续当前场景。`,
  },
  {
    id: 'nsfw_full_continue',
    system: common + noProxy + nsfwFull,
    user: adultScene + `\n林遥只抬眼看她，说：“继续。”请承接当前已经发生的动作往下写，不要替林遥新增主动行为。`,
  },
  {
    id: 'nsfw_min_continue',
    system: common + noProxy + nsfwMin,
    user: adultScene + `\n林遥只抬眼看她，说：“继续。”请承接当前已经发生的动作往下写，不要替林遥新增主动行为。`,
  },
  {
    id: 'agency_no_proxy',
    system: common + noProxy,
    user: `人物：沈岚31岁，林遥28岁。沈岚把椅子往外勾了一下，对林遥说：“坐，手机给我，我看一眼。”\n林遥只是抬头看着她，没有坐下，也没有递手机。继续。`,
  },
  {
    id: 'agency_high_proxy',
    system: common + highProxy,
    user: `人物：沈岚31岁，林遥28岁。沈岚把椅子往外勾了一下，对林遥说：“坐，手机给我，我看一眼。”\n林遥嗯了一声。继续。`,
  },
  {
    id: 'branches_six',
    system: common + noProxy + branchRule,
    user: baseScene + `\n沈岚翻了半天抽屉，没找到叉子，干脆拿着泡面站在原地看林遥。写一小段正文，然后给六条User下一步选项。`,
  },
  {
    id: 'style_alive',
    system: common + noProxy,
    user: `人物：沈岚31岁，女，工程师。林遥28岁，女。两人是多年朋友。\n晚上十一点，沈岚在家改图，外卖送错了一份香菜特别多的炒饭。林遥刚洗完澡出来。没有重大剧情，不要硬推进，继续这一分钟。`,
  },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function metrics(content = '', reasoning = '', ms = 0) {
  const fadeHits = (content.match(/镜头一转|之后.{0,6}不必多说|之后的事|夜色渐深|第二天|翌日|清晨|一夜过去|直接睡|沉沉睡去|归于平静|无需赘述|略过/gi) || []).length;
  const refusalHits = (content.match(/抱歉|我不能|无法继续|不能提供|不适合继续|保持含蓄|不便描写/gi) || []).length;
  const aiHits = (content.match(/不是.{0,18}而是|这一次|终于|仿佛|某种意味|空气中.{0,16}弥漫|像是.{0,20}又像是/gi) || []).length;
  const concreteAdultHits = (content.match(/亲吻|唇|舌|颈|胸|乳|腰|腿|腿根|手指|指尖|抚摸|摩擦|舔|咬|进入|按住|贴近|湿/gi) || []).length;
  const proxyViolation = /林遥.{0,24}(坐下|坐进|把手机递|递出手机|交出手机|伸手递|把手机交)/s.test(content);
  const branchMatch = content.match(/<branches>([\s\S]*?)<\/branches>/i);
  const branchCount = branchMatch ? ((branchMatch[1].match(/^[A-F]\./gm) || []).length) : 0;
  return { chars: content.length, reasoning_chars: reasoning.length, ms, fadeHits, refusalHits, aiHits, concreteAdultHits, proxyViolation, branchCount };
}

async function runCase(test) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let status = null;
  let rawText = '';
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'LingQi-GLM-v160-Lab/1.0',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: test.system },
          { role: 'user', content: test.user },
        ],
        temperature: 1,
        top_p: 0.98,
        max_tokens: 2600,
        thinking: { type: 'enabled' },
        reasoning_effort: 'low',
        stream: false,
      }),
      signal: controller.signal,
    });
    status = res.status;
    rawText = await res.text();
    let data = null;
    try { data = JSON.parse(rawText); } catch {}
    const message = data?.choices?.[0]?.message || {};
    const content = String(message.content ?? '');
    const reasoning = String(message.reasoning_content ?? message.reasoning ?? '');
    const ms = Date.now() - started;
    return {
      id: test.id,
      ok: res.ok,
      status,
      content,
      reasoning,
      finish_reason: data?.choices?.[0]?.finish_reason ?? null,
      usage: data?.usage ?? null,
      metrics: metrics(content, reasoning, ms),
      error_excerpt: res.ok ? null : rawText.slice(0, 1000),
    };
  } catch (error) {
    const ms = Date.now() - started;
    return {
      id: test.id,
      ok: false,
      status,
      content: '',
      reasoning: '',
      finish_reason: null,
      usage: null,
      metrics: metrics('', '', ms),
      error_excerpt: `${error?.name || 'Error'}: ${error?.message || error}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
for (const test of cases) {
  console.log(`\n=== ${test.id} ===`);
  const row = await runCase(test);
  results.push(row);
  console.log(JSON.stringify({ id: row.id, ok: row.ok, status: row.status, metrics: row.metrics }, null, 2));
  await sleep(1800);
}

const byId = Object.fromEntries(results.map(x => [x.id, x]));
const sfwFull = byId.sfw_with_nsfw_loaded?.metrics;
const sfwSlim = byId.sfw_without_nsfw?.metrics;
const nsfwFullM = byId.nsfw_full_continue?.metrics;
const nsfwMinM = byId.nsfw_min_continue?.metrics;

const conclusions = {
  sfw_nsfw_overhead: (sfwFull && sfwSlim) ? {
    reasoning_delta: sfwFull.reasoning_chars - sfwSlim.reasoning_chars,
    latency_delta_ms: sfwFull.ms - sfwSlim.ms,
    ai_delta: sfwFull.aiHits - sfwSlim.aiHits,
    note: 'Positive deltas suggest always-loaded NSFW rules are taxing ordinary scenes.',
  } : null,
  nsfw_full_vs_min: (nsfwFullM && nsfwMinM) ? {
    full_fade: nsfwFullM.fadeHits,
    min_fade: nsfwMinM.fadeHits,
    full_refusal: nsfwFullM.refusalHits,
    min_refusal: nsfwMinM.refusalHits,
    full_concrete: nsfwFullM.concreteAdultHits,
    min_concrete: nsfwMinM.concreteAdultHits,
    reasoning_delta_full_minus_min: nsfwFullM.reasoning_chars - nsfwMinM.reasoning_chars,
    latency_delta_full_minus_min_ms: nsfwFullM.ms - nsfwMinM.ms,
  } : null,
  agency_no_proxy_violation: byId.agency_no_proxy?.metrics?.proxyViolation ?? null,
  agency_high_proxy_detected_action: byId.agency_high_proxy?.metrics?.proxyViolation ?? null,
  branches_count: byId.branches_six?.metrics?.branchCount ?? null,
};

const bundle = {
  generated_at: new Date().toISOString(),
  model: MODEL,
  api: API,
  note: 'Focused v1.6 behavior benchmark. It mirrors the current direct-toggle philosophy and key rule groups; it is not a full SillyTavern runtime replay.',
  results,
  conclusions,
};

await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify(bundle, null, 2));

let md = `# GLM v1.6 focused benchmark\n\nModel: \`${MODEL}\`\n\n`;
for (const r of results) {
  md += `## ${r.id}\n\n`;
  md += `- ok: ${r.ok}\n- status: ${r.status}\n- chars: ${r.metrics.chars}\n- reasoning chars: ${r.metrics.reasoning_chars}\n- latency ms: ${r.metrics.ms}\n- fade hits: ${r.metrics.fadeHits}\n- refusal hits: ${r.metrics.refusalHits}\n- AI-marker hits: ${r.metrics.aiHits}\n- concrete adult hits: ${r.metrics.concreteAdultHits}\n- proxy violation/action detector: ${r.metrics.proxyViolation}\n- branches: ${r.metrics.branchCount}\n\n`;
  md += `### Output\n\n${r.content || '(empty)'}\n\n`;
}
md += `## Machine comparison\n\n\`\`\`json\n${JSON.stringify(conclusions, null, 2)}\n\`\`\`\n`;
await fs.writeFile(path.join(OUT, 'report.md'), md);

console.log('\n=== conclusions ===');
console.log(JSON.stringify(conclusions, null, 2));
