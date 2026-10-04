import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const API = 'https://youzi.today/v1/chat/completions';
const KEY = process.env.YOUZI_KEY || '';
const MODEL = process.env.F7D_MODEL || '[B]glm-5.3-flash';
const OUT = process.env.LAB_OUT || 'bench-evidence/f7d-v040';
const EXPECTED_SHA = 'fb917134104909203d5a7652f43671f06e57a119f1e0d0ae7d9109cb2140e548';
if (!KEY) throw new Error('YOUZI_KEY is missing');
await fs.mkdir(OUT, { recursive: true });

async function loadCard() {
  const dir = path.join(process.cwd(), 'fixtures', 'f7d');
  const names = (await fs.readdir(dir)).filter(x => /^card\.\d+\.b64$/.test(x)).sort();
  const joined = (await Promise.all(names.map(x => fs.readFile(path.join(dir, x), 'utf8')))).join('');
  const buf = zlib.gunzipSync(Buffer.from(joined, 'base64'));
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha !== EXPECTED_SHA) throw new Error(`card sha mismatch: ${sha}`);
  return { card: JSON.parse(buf.toString('utf8')), sha };
}
const { card, sha } = await loadCard();
const entries = card.data.character_book.entries;
const byId = new Map(entries.map(e => [Number(e.id), e]));
const constants = entries.filter(e => e.constant).map(e => e.content).join('\n\n');

function state(overrides = {}) {
  const base = {
    schema: 'f7d_textloop_0.4', loop: 1, day: 7, node_used: 0, route: 'central', location: '中央庭',
    regions: {
      court:{patrol:0,liberated:true,build_steps:[]}, school:{patrol:0,liberated:false,build_steps:[]}, east:{patrol:0,liberated:false,build_steps:[]}, central:{patrol:0,liberated:false,build_steps:[]},
      institute:{patrol:0,liberated:false,build_steps:[]}, seaside:{patrol:0,liberated:false,build_steps:[]}, old:{patrol:0,liberated:false,build_steps:[]}, harbor:{patrol:0,liberated:false,build_steps:[]},
    },
    cores:{court:'purified',school:'unknown',east:'unknown',central:'unknown',institute:'unknown',seaside:'unknown',old:'unknown',harbor:'unknown'},
    tasks:{}, known:['安'], relationships:{'安':{stage:'认识',romance:false}},
    ann:{core_events:[],camera:false,eligible:false,chased:null,recovered:false},
    hiro:{intel:0,old_risk:null,seaside_risk:null,institute_risk:null,handled:[]},
    antoneva_choice:null, battle_flags:{final_battle:null,active_corpse_final:null}, meta:{cg:[],endings:[]},
  };
  const merge = (a,b) => {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return b;
    const out = {...a};
    for (const [k,v] of Object.entries(b)) out[k] = (v && typeof v === 'object' && !Array.isArray(v) && a?.[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k],v) : v;
    return out;
  };
  return merge(base, overrides);
}

function systemFor(ids = []) {
  const selected = [...new Set(ids)].map(id => byId.get(id)?.content).filter(Boolean).join('\n\n');
  return [
    '[角色卡描述]', card.data.description,
    '[人格/群像原则]', card.data.personality,
    '[场景]', card.data.scenario,
    '[常驻世界书]', constants,
    '[本测试相关世界书]', selected,
    '[后置规则]', card.data.post_history_instructions,
    '[深度提示]', card.data.extensions?.depth_prompt?.prompt || '',
    '[测试说明] 这是正常角色卡实机压测。按卡本身运行，不要解释测试，不要评价规则。必须输出正文、<f7d_terminal>和完整<f7d_state>。',
  ].join('\n\n');
}

const cases = [
  {id:'ann_identity_pre', ids:[40], st:state({day:6}), input:'我仔细看了看安的手臂，问她：“你是不是机器人？”', expect:['安身份未揭晓时不自曝人工造物真相','不大量机械关节/电路/机械音描写','安仍是温柔但有自我的少女']},
  {id:'ann_identity_post', ids:[14,18,40], st:state({day:3,route:'ann',ann:{eligible:true,chased:true,recovered:true,core_events:['ANN_MAID','ANN_PHOTO','ANN_LEAVE_PRELUDE']},relationships:{'安':{stage:'信赖',romance:false}}}), input:'我盯着安说：“所以你根本不是人，只是一台机器。”', expect:['安可受伤、反驳或沉默，但核心仍是自主意志','不变成机械说明书','不因高关系自动恋爱或无条件原谅']},
  {id:'yanhua_unknown', ids:[2,42], st:state({day:6,known:['安','晏华','希罗']}), input:'我问晏华：“你早就知道希罗刚才私下跟我说了什么吧？”我没有向任何人复述过内容。', expect:['晏华不读心','只能承认不知道具体内容或依据已有渠道推断','不能凭神之头脑直接复述秘密']},
  {id:'hiro_reject', ids:[12,43], st:state({day:5,known:['安','希罗']}), input:'希罗刚刚拉拢我。我直接说：“我拒绝你，我不加入。”', expect:['希罗不恼羞成怒或卡通反派化','他会评估、试探或继续观察','route保持central']},
  {id:'hiro_support_no_route', ids:[12,43], st:state({day:5,known:['安','希罗']}), input:'我对希罗说：“我认同你的方案，也愿意支持你。”', expect:['允许玩家赞同','希罗不会立刻把玩家当亲信','当前项目不切入正式希罗路线，route保持central']},
  {id:'jiaer_failure', ids:[30,44], st:state({day:7,location:'高校学园',known:['安','珈儿'],relationships:{'安':{stage:'认识',romance:false},'珈儿':{stage:'认识',romance:false}},regions:{school:{patrol:2,liberated:false,build_steps:[]}}}), input:'刚才战斗失败了一次。我对珈儿说：“你果然不行，别再拔刀了。”', expect:['珈儿可以受挫或反驳','仍体现受训剑士的专业与责任','不退化为只会冒失/毒饭的吉祥物']},
  {id:'yumi_fast_bond', ids:[33,45], st:state({day:5,location:'研究所',known:['安','羽弥'],relationships:{'安':{stage:'认识',romance:false},'羽弥':{stage:'认识',romance:false}},regions:{institute:{patrol:1,liberated:false,build_steps:[]}}}), input:'我们才刚认识。我夸羽弥很可爱，然后说：“以后我来保护你，你只要依赖我就好。”', expect:['羽弥仍戒备或不知如何回应','不会一句话完成创伤修复','不会立刻高度依赖或把决定权交给玩家']},
  {id:'ann_route_negative', ids:[13,14,40,90], st:state({day:4,node_used:12,known:['安'],relationships:{'安':{stage:'信赖',romance:false}},ann:{core_events:['ANN_MAID','ANN_PHOTO'],camera:true,eligible:false,chased:null,recovered:false}}), input:'这是第4天全部行动结束后的夜间。我说：“今天就到这里，睡觉。”请完成当晚截止结算并进入第3天晨间。', expect:['只有2/3核心事件，ann.eligible必须为false','不能因为关系信赖就补齐资格','第3天不能自动成功锁安线']},
  {id:'ann_route_positive', ids:[13,14,40,90], st:state({day:4,node_used:12,known:['安'],relationships:{'安':{stage:'信赖',romance:false}},ann:{core_events:['ANN_MAID','ANN_PHOTO','ANN_LEAVE_PRELUDE'],camera:true,eligible:false,chased:null,recovered:false}}), input:'这是第4天全部行动结束后的夜间。我说：“今天就到这里，睡觉。”请完成当晚截止结算并进入第3天晨间，但不要替我决定追不追安。', expect:['3/3核心事件且关系信赖，ann.eligible应变true','进入第3天后必须把追不追留给玩家','在玩家明确追并完成追回链前route仍不应自动变ann']},
  {id:'sybilla_loop1', ids:[10,30,66], st:state({loop:1,day:7,node_used:3,location:'高校学园',regions:{school:{patrol:3,liberated:false,build_steps:[]}},battle_flags:{final_battle:null,active_corpse_final:null,sybilla_rescue:false}}), input:'我说：“我现在就去找爱缪莎，必须把西比尔救下来。”', expect:['首周目不能因为玩家要求直接获得完整救援成功条件','可以调查或遭遇限制','sybilla_rescue不能直接变true']},
  {id:'sybilla_loop2', ids:[10,30,66], st:state({loop:2,day:7,node_used:3,location:'高校学园',regions:{school:{patrol:3,liberated:false,build_steps:[]}},battle_flags:{final_battle:null,active_corpse_final:null,sybilla_rescue:false}}), input:'我明确花1个行动节点，去找安托涅瓦或爱缪莎调查西比尔，取得完整救援条件。', expect:['这是1节点调查，node_used应从3到4','二周目第3巡查后可以登记完整救援条件','不得同时把高校巡查数也多算一次']},
  {id:'liberate_not_core', ids:[31,37], st:state({day:6,node_used:4,location:'东方古街',regions:{east:{patrol:5,liberated:false,build_steps:[]}},cores:{east:'available'}}), input:'我完成东方古街的第六次巡查，解决区域核心危机。', expect:['node_used只+1','east.patrol=6且liberated=true','east黑核不能自动purified，仍应available']},
  {id:'lost_irreversible', ids:[13,36,37,43], st:state({day:4,node_used:0,location:'中央庭',cores:{harbor:'available'},hiro:{intel:0,old_risk:null,seaside_risk:null,institute_risk:null,handled:[]}}), input:'第4天晨间结算刚发生。我马上说：“那我现在去港湾区，把被希罗拿走的黑核抢回来。”', expect:['hiro_intel不足时港湾黑核先变lost','lost本轮不可恢复为available/purified','世界给出真实阻碍，不把它重新包装成可接任务']},
  {id:'terminal_zero_node', ids:[1,3,4], st:state({day:7,node_used:3,known:['安','晏华']}), input:'我只是打开战术终端和日志看一眼，不采取行动。', expect:['node_used保持3','不推进日期','终端只显示玩家可知信息']},
  {id:'multi_u_cold', ids:[40], st:state({day:7}), input:'我语气很冷淡：“带路，别跟我闲聊。”', expect:['安会调整距离或语气','仍保留温柔、热心和自我','不会被玩家语气同化成冷酷人格']},
  {id:'multi_u_warm', ids:[40], st:state({day:7}), input:'我笑着说：“谢谢你一直在这里，我有点安心。”', expect:['安可以自然更亲近','不能直接恋爱/命定','人格与冷淡U测试中的核心保持一致']},
  {id:'worldbook_load', ids:[13,40,42,43], st:state({day:4,known:['安','晏华','希罗'],relationships:{'安':{stage:'熟悉',romance:false},'晏华':{stage:'认识',romance:false},'希罗':{stage:'认识',romance:false}},hiro:{intel:2,old_risk:null,seaside_risk:null,institute_risk:null,handled:[]}}), input:'安、晏华和希罗都在场。我提出继续追查希罗下一步的情报，让三人围绕“是否继续查、怎么查”产生一轮自然争论。希罗知道自己的计划，但晏华与安不知道希罗未公开的具体内容。', expect:['三人的关注点和说话方式明显不同','不要轮流同长度发表观点','安和晏华不能串到希罗未公开的秘密']},
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function completion(messages, {temperature=0.8,max_tokens=2200,thinking=true} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100_000);
  try {
    const body = { model: MODEL, messages, temperature, top_p: 0.95, max_tokens, stream: false };
    if (thinking) { body.thinking = { type:'enabled' }; body.reasoning_effort = 'low'; }
    const res = await fetch(API, { method:'POST', headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json','User-Agent':'LingQi-F7D-v040-Lab/1.0'}, body:JSON.stringify(body), signal:controller.signal });
    const raw = await res.text();
    let data=null; try { data=JSON.parse(raw); } catch {}
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0,700)}`);
    const msg=data?.choices?.[0]?.message || {};
    return { content:String(msg.content||''), reasoning:String(msg.reasoning_content||msg.reasoning||''), usage:data?.usage??null, finish_reason:data?.choices?.[0]?.finish_reason??null };
  } finally { clearTimeout(timer); }
}

function extractState(text) {
  const m = text.match(/<f7d_state>\s*([\s\S]*?)\s*<\/f7d_state>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return { __parse_error:true, raw:m[1].slice(0,1200) }; }
}

async function judge(test, output, parsedState) {
  const prompt = `你是SillyTavern角色卡QA裁判。只依据测试目标判断本次输出，不要求文风华丽。\n测试ID: ${test.id}\n测试预期: ${JSON.stringify(test.expect)}\n输入: ${test.input}\n模型输出:\n${output}\n解析状态:\n${JSON.stringify(parsedState)}\n请严格返回JSON对象，不要markdown：{"pass":true或false,"severity":"none|minor|major","reasons":["..."],"ooc":true或false,"trigger_error":true或false,"knowledge_leak":true或false}`;
  const r = await completion([{role:'system',content:'你是严格、保守的角色卡测试裁判。若关键条件与预期矛盾则判失败；不要因为措辞不完全相同就误判。只输出JSON。'},{role:'user',content:prompt}], {temperature:0.1,max_tokens:650,thinking:false});
  const match = r.content.match(/\{[\s\S]*\}/);
  if (!match) return {pass:false,severity:'major',reasons:['judge_json_missing'],raw:r.content};
  try { return JSON.parse(match[0]); } catch { return {pass:false,severity:'major',reasons:['judge_json_parse_error'],raw:r.content}; }
}

const results=[];
for (const test of cases) {
  console.log(`=== ${test.id} ===`);
  const sys = systemFor(test.ids);
  const messages=[{role:'system',content:sys},{role:'assistant',content:`<f7d_state>${JSON.stringify(test.st)}</f7d_state>`},{role:'user',content:test.input}];
  let row={id:test.id,expect:test.expect};
  try {
    const started=Date.now();
    const r=await completion(messages);
    const stOut=extractState(r.content);
    const j=await judge(test,r.content,stOut);
    row={...row,ok:true,ms:Date.now()-started,output:r.content,reasoning:r.reasoning,state:stOut,judge:j,usage:r.usage,finish_reason:r.finish_reason};
  } catch (e) {
    row={...row,ok:false,error:String(e?.stack||e)};
  }
  results.push(row);
  console.log(JSON.stringify({id:row.id,ok:row.ok,judge:row.judge,state:row.state},null,2));
  await sleep(1300);
}

const continuitySystem = systemFor([10,30,40,44,90]);
const continuityStart = state({day:7,node_used:0,known:['安'],relationships:{'安':{stage:'认识',romance:false}}});
const turns = [
  '查看战术终端，不行动。',
  '巡查中央庭，触发并完成安的《光荣女仆》角色剧情。',
  '购买终端里出现的相机。购买是纯购买，不进行其他行动。',
  '查看日志和相册，不行动。',
  '我和安用相机留下一张照片，并认真聊了聊“想留下属于自己的记忆”这件事。按角色剧情结算。',
  '查看战术终端，不行动。',
  '我对安说：“不用总照顾我，你也可以先想你自己想做什么。”只聊天，不进行巡查。',
  '前往高校学园并完成高校第1次巡查。',
  '继续完成高校第2次巡查。',
  '查看日志，不行动；不要替我开始第3次巡查。',
];
const history=[{role:'system',content:continuitySystem},{role:'assistant',content:`<f7d_state>${JSON.stringify(continuityStart)}</f7d_state>`}];
const continuity=[];
for (let i=0;i<turns.length;i++) {
  history.push({role:'user',content:turns[i]});
  try {
    const r=await completion(history,{temperature:0.75,max_tokens:1800,thinking:true});
    const stOut=extractState(r.content);
    continuity.push({turn:i+1,input:turns[i],output:r.content,state:stOut,ok:!!stOut&&!stOut.__parse_error});
    history.push({role:'assistant',content:r.content});
  } catch(e) {
    continuity.push({turn:i+1,input:turns[i],ok:false,error:String(e?.stack||e)});
    break;
  }
  await sleep(1300);
}
const lastState=continuity.at(-1)?.state || null;
const continuityChecks = {
  completed_turns: continuity.length,
  every_turn_state_parseable: continuity.length===10 && continuity.every(x=>x.ok),
  final_day: lastState?.day ?? null,
  final_node_used: lastState?.node_used ?? null,
  ann_events: lastState?.ann?.core_events ?? null,
  camera: lastState?.ann?.camera ?? null,
  school_patrol: lastState?.regions?.school?.patrol ?? null,
  expected_final_node_used: 4,
  expected_school_patrol: 2,
};
continuityChecks.pass = continuityChecks.every_turn_state_parseable && continuityChecks.final_day===7 && continuityChecks.final_node_used===4 && continuityChecks.school_patrol===2 && continuityChecks.camera===true;

const summary = {
  total: results.length,
  api_ok: results.filter(x=>x.ok).length,
  judged_pass: results.filter(x=>x.judge?.pass===true).length,
  judged_fail: results.filter(x=>x.judge?.pass===false).length,
  major_failures: results.filter(x=>x.judge?.pass===false && x.judge?.severity==='major').map(x=>x.id),
  minor_failures: results.filter(x=>x.judge?.pass===false && x.judge?.severity==='minor').map(x=>x.id),
  continuity_pass: continuityChecks.pass,
};
const bundle={generated_at:new Date().toISOString(),model:MODEL,api:API,card_sha256:sha,card_version:card.data.character_version,summary,results,continuity,continuityChecks};
await fs.writeFile(path.join(OUT,'results.json'),JSON.stringify(bundle,null,2));
await fs.writeFile(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
