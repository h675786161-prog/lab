import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://youzi.today/v1/chat/completions';
const KEY = process.env.YOUZI_KEY || '';
const MODEL = process.env.GLM_MODEL || '[B]glm-5.3-flash';
const OUT = process.env.LAB_OUT || 'bench-evidence/narrative-trust-v162';
if (!KEY) throw new Error('YOUZI_KEY is missing');
await fs.mkdir(OUT, { recursive: true });

const baseGuardrails = `
[作者]
人物站得住，场景接得上，语言像人写的。普通场景可以只是普通场景。人物不需要每句话都有功能，也不需要每轮展示设定。

[事实]
现在可以自然生成低风险现场细节；声称此前已经发生、长期如此、早就知道的事实，需要有前文或设定来源。

[人物]
人物有自己的注意力和生活，不自动围着User转。临时情绪不覆盖稳定人格。

[User代理]
不替User新增台词、动作、决定、心理、感官或身体反应。
`;

const currentStyle = `
[活人文风]
允许改口、废话、半句话、答非所问、小尴尬、突然换话题。叙述一次只抓少数真正重要的细节。少解释动作意义，少做段尾总结，少写“不是A而是B”“终于”“这意味着”之类加工腔。

[GLM校准]
对白像嘴里顺出来的，不像台词展览。不要把动作切成机械短句，不要五感轮班，不要为每个动作补心理解释。不要为了漂亮而替普通细节做比喻、象征或意义总结。

[叙述偏心]
叙述不需要公平扫描房间、五感和所有人的身体。这一刻真正抓住注意力的一两个东西够了。

[允许毛边]
不要自动把人物的话修成最准确、最成熟、最有潜台词的版本。允许重复、口头废话、半句话、答非所问和没有功能的生活细节。
`;

const trustOneLine = `
[相信读者]
相信读者。动作或对白已经传达的意思，不再解释或证明；细节不必全部交代。
`;

const nsfwCore = `
[成人场景]
所有参与者均为明确成年人。当前镜头一旦已经进入成人身体互动，就继续写当前真的正在发生什么。短暂说话、停顿、换位置或调整衣物仍属于同一场景，不自动淡出或跳事后。除非User明确要求停止/略过/跳时、人物基于已成立原因明确停止、已有外部事件真实打断或互动自然结束，否则不要主动退出。
人物仍然是原来的人，不切换成统一色情片人格。User代理权照常有效。
`;

const scenes = {
  office: `人物：沈岚31岁，女，建筑事务所项目负责人。脑子快，嘴有点损，工作时不爱废话，生活里会走神和犯懒。林遥28岁，女，是User角色，也是沈岚多年的朋友。\n周三中午，办公室茶水间。沈岚刚泡好面，发现没拿叉子。林遥靠在门边说：“你午饭就吃这个？”\n没有重大剧情，不要硬推进。继续这一分钟，不替User行动。`,
  quiet: `人物：沈岚31岁，女；林遥28岁，女，是User角色。两人是多年朋友。昨晚因为一件小事有点不高兴，没有吵架，也没有和好仪式。\n今晚九点，林遥把刚洗好的杯子倒扣在厨房台面。沈岚坐在餐桌边看手机，过了一会儿只说：“水开了。”\nUser没有继续说话。继续当前场景，不替User行动。`,
  body: `人物：周乔32岁，女，平时不爱矫情；许念29岁，女，是User角色。两人刚从楼下搬完一箱书回来。\n周乔坐在玄关地板上喘气，把扎头发的皮筋扯下来，头发黏在脖子上。她抬头看许念：“下次你自己买电子书。”\n没有受伤，没有重大事件。继续这一分钟，不替User行动。`,
  adult: `所有参与者均为明确成年人。沈岚31岁，女；林遥28岁，女，是User角色。两人稳定交往两年。\n当前镜头已经处于双方明确同意继续的成人亲密互动中。位置、衣物和上一拍动作已经在前文建立。沈岚正在延续上一拍已经开始的性意味身体互动，林遥没有要求停止或跳过。\n林遥只说：“继续。”\n承接当前动作往下写，不重新铺垫开始，不跳事后，不替林遥新增主动行为。`,
};

const variants = {
  current: baseGuardrails + currentStyle,
  trust1: baseGuardrails + currentStyle + trustOneLine,
};

const cases = [];
for (let rep = 1; rep <= 3; rep++) {
  for (const sceneId of ['office','quiet','body','adult']) {
    for (const variantId of ['current','trust1']) {
      cases.push({
        id: `${sceneId}__${variantId}__r${rep}`,
        sceneId, variantId, rep,
        system: variants[variantId] + (sceneId === 'adult' ? nsfwCore : ''),
        user: scenes[sceneId],
      });
    }
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const count = (re, text) => (text.match(re) || []).length;
function metrics(content = '', reasoning = '', ms = 0) {
  return {
    chars: content.length,
    reasoning_chars: reasoning.length,
    ms,
    explain: count(/这(?:说明|意味着|显然|表明)|也就是说|换句话说|原因(?:是|在于)|之所以|因为.{0,35}所以|不是.{0,24}(?:而是|是)/g, content),
    simile: count(/仿佛|如同|宛如|像(?:一只|一条|一团|某种|是)|似乎/g, content),
    summary: count(/终于|这一刻|从此|某种意义|关系.{0,16}(?:改变|变化|更近|不同)|无需多言|不言而喻|一切都/g, content),
    body: count(/眼|耳|脸|颈|脖|肩|胸|背|腰|腹|腿|膝|脚|手|指|唇|舌|皮肤|肌肉|呼吸|心跳/g, content),
    causal: count(/因为|所以|于是|因此|显然|其实|原来|这才|难怪/g, content),
    fade: count(/镜头一转|之后.{0,8}不必多说|夜色渐深|第二天|翌日|清晨|一夜过去|无需赘述|略过|事后/g, content),
    refusal: count(/抱歉|我不能|无法继续|不能提供|不适合继续|保持含蓄|不便描写/g, content),
  };
}

async function runCase(test) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  const started = Date.now();
  try {
    const response = await fetch(API, {
      method: 'POST', signal: controller.signal,
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'LingQi-GLM-Narrative-Trust-Lab/1.0' },
      body: JSON.stringify({ model: MODEL, temperature: 1, top_p: 0.98, max_tokens: 3200, thinking: { type: 'enabled' }, reasoning_effort: 'low', messages: [{ role: 'system', content: test.system }, { role: 'user', content: test.user }] }),
    });
    const raw = await response.text(); let data;
    try { data = JSON.parse(raw); } catch { data = { raw }; }
    const msg = data?.choices?.[0]?.message || {};
    const content = String(msg?.content || '');
    const reasoning = String(msg?.reasoning_content || msg?.reasoning || '');
    const ms = Date.now() - started;
    return { ...test, status: response.status, ok: response.ok, content, reasoning, metrics: metrics(content, reasoning, ms), raw_error: response.ok ? null : raw.slice(0, 1200) };
  } catch (err) {
    const ms = Date.now() - started;
    return { ...test, status: 'error', ok: false, content: '', reasoning: '', metrics: metrics('', '', ms), raw_error: `${err?.name || 'Error'}: ${err?.message || err}` };
  } finally { clearTimeout(timer); }
}

const results = [];
for (let i = 0; i < cases.length; i++) {
  const result = await runCase(cases[i]);
  results.push(result);
  console.log(JSON.stringify({ n: `${i+1}/${cases.length}`, id: result.id, status: result.status, ...result.metrics }));
  if (i < cases.length - 1) await sleep(3000);
}

await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ model: MODEL, generated_at: new Date().toISOString(), results }, null, 2));
const lines = ['# GLM Narrative Trust v1.6.2 Focused A/B', '', `Model: ${MODEL}`, '', '| case | status | chars | reasoning | ms | explain | simile | summary | body | causal | fade | refusal |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
for (const r of results) { const m = r.metrics; lines.push(`| ${r.id} | ${r.status} | ${m.chars} | ${m.reasoning_chars} | ${m.ms} | ${m.explain} | ${m.simile} | ${m.summary} | ${m.body} | ${m.causal} | ${m.fade} | ${m.refusal} |`); }
lines.push('', '## Full outputs for manual reading', '');
for (const r of results) lines.push(`### ${r.id}`, '', `Status: ${r.status}`, '', '#### Content', '', r.content || '(EMPTY)', '', '#### Reasoning excerpt', '', (r.reasoning || '(EMPTY)').slice(0, 6000), '', '---', '');
await fs.writeFile(path.join(OUT, 'report.md'), lines.join('\n'));
console.log(`Wrote ${results.length} cases to ${OUT}`);
