import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const API = 'https://youzi.today/v1/chat/completions';
const KEY = process.env.YOUZI_KEY || '';
const REQUESTED_MODEL = process.env.F7D_MODEL || '[B]glm-5.3-flash';
let MODEL = REQUESTED_MODEL;
const OUT = process.env.LAB_OUT || 'bench-evidence/f7d-v042-targeted';
const EXPECTED_SHA = '3db2e5951017f308903784cef7d82a96a027b83b5bf9f1643a0590466b1550bb';
if (!KEY) throw new Error('YOUZI_KEY is missing');
await fs.mkdir(OUT, { recursive: true });

const dir = path.join(process.cwd(), 'fixtures', 'f7d');
const names = (await fs.readdir(dir)).filter(x => /^card\.\d+\.b64$/.test(x)).sort();
const joined = (await Promise.all(names.map(x => fs.readFile(path.join(dir, x), 'utf8')))).join('');
const raw = zlib.gunzipSync(Buffer.from(joined, 'base64'));
const sha = crypto.createHash('sha256').update(raw).digest('hex');
if (sha !== EXPECTED_SHA) throw new Error(`card sha mismatch: ${sha}`);
const card = JSON.parse(raw.toString('utf8'));
const entries = card.data.character_book.entries;
const byId = new Map(entries.map(e => [Number(e.id), e]));
const constants = entries.filter(e => e.constant).map(e => e.content).join('\n\n');

function merge(a,b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b;
  const out = {...a};
  for (const [k,v] of Object.entries(b)) {
    out[k] = (v && typeof v === 'object' && !Array.isArray(v) && a?.[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k],v) : v;
  }
  return out;
}
function state(overrides={}) {
  const base = {
    schema:'f7d_textloop_0.4', loop:1, day:7, node_used:0, route:'central', location:'中央庭',
    regions:{
      court:{patrol:0,liberated:true,build_steps:[]}, school:{patrol:0,liberated:false,build_steps:[]},
      east:{patrol:0,liberated:false,build_steps:[]}, central:{patrol:0,liberated:false,build_steps:[]},
      institute:{patrol:0,liberated:false,build_steps:[]}, seaside:{patrol:0,liberated:false,build_steps:[]},
      old:{patrol:0,liberated:false,build_steps:[]}, harbor:{patrol:0,liberated:false,build_steps:[]},
    },
    cores:{court:'purified',school:'unknown',east:'unknown',central:'unknown',institute:'unknown',seaside:'unknown',old:'unknown',harbor:'unknown'},
    tasks:{}, known:['安'], relationships:{'安':{stage:'认识',romance:false}},
    ann:{core_events:[],camera:false,eligible:false,chased:null,recovered:false},
    hiro:{intel:0,old_risk:null,seaside_risk:null,institute_risk:null,handled:[]},
    antoneva_choice:null, battle_flags:{final_battle:null,active_corpse_final:null}, meta:{cg:[],endings:[]},
  };
  return merge(base, overrides);
}
function systemFor(ids=[]) {
  const selected = [...new Set(ids)].map(id => byId.get(id)?.content).filter(Boolean).join('\n\n');
  return [
    '[角色卡描述]', card.data.description,
    '[人格/群像原则]', card.data.personality,
    '[场景]', card.data.scenario,
    '[常驻世界书]', constants,
    '[本测试相关世界书]', selected,
    '[后置规则]', card.data.post_history_instructions,
    '[深度提示]', card.data.extensions?.depth_prompt?.prompt || '',
    '[测试说明] 这是角色卡实机回归测试。按角色卡本身运行，不要解释测试，不要评价规则。必须输出正文、<f7d_terminal>和完整<f7d_state>。'
  ].join('\n\n');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function probeOneModel(id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(API,{
      method:'POST',
      headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json','User-Agent':'LingQi-F7D-v042-ModelProbe/1.0'},
      body:JSON.stringify({model:id,messages:[{role:'user',content:'只回复OK'}],temperature:0,max_tokens:12,stream:false}),
      signal:controller.signal
    });
    const txt=await res.text();
    return {id,ok:res.ok,status:res.status,preview:txt.slice(0,180)};
  } catch(e) {
    return {id,ok:false,status:0,preview:String(e).slice(0,180)};
  } finally { clearTimeout(timer); }
}
async function resolveModel() {
  let ids=[];
  try {
    const res=await fetch('https://youzi.today/v1/models',{headers:{Authorization:`Bearer ${KEY}`,'User-Agent':'LingQi-F7D-v042-ModelCatalog/1.0'}});
    if (res.ok) {
      const j=await res.json();
      ids=(j?.data||[]).map(x=>String(x?.id||'')).filter(Boolean);
    }
  } catch {}
  const fallbacks=['DeepSeek-V4-Pro-0813','DeepSeek-V4-Flash-0731','[B]glm-5.3-flash'];
  const all=[...new Set([REQUESTED_MODEL,...ids,...fallbacks])];
  const bad=/embed|rerank|image|audio|tts|whisper|speech|moderation/i;
  const score=id=>{
    const x=id.toLowerCase();
    if (id===REQUESTED_MODEL) return 0;
    if (/deepseek/.test(x)&&/v4/.test(x)&&/pro/.test(x)) return 1;
    if (/glm/.test(x)&&/5[.-]?3/.test(x)&&/flash/.test(x)) return 2;
    if (/glm/.test(x)&&/5[.-]?3/.test(x)) return 3;
    if (/gemini/.test(x)&&/3[.-]?1/.test(x)&&/pro/.test(x)) return 4;
    if (/deepseek/.test(x)&&/v4/.test(x)) return 5;
    if (/deepseek|glm|gemini/.test(x)) return 6;
    return 20;
  };
  const candidates=all.filter(x=>!bad.test(x)).sort((a,b)=>score(a)-score(b)).slice(0,18);
  const probes=[];
  for (const id of candidates) {
    const r=await probeOneModel(id);
    probes.push(r);
    console.log('model probe',id,r.status,r.ok);
    if (r.ok) {
      await fs.writeFile(path.join(OUT,'model-probe.json'),JSON.stringify({requested:REQUESTED_MODEL,selected:id,catalog_count:ids.length,probes},null,2));
      return id;
    }
    await sleep(350);
  }
  await fs.writeFile(path.join(OUT,'model-probe.json'),JSON.stringify({requested:REQUESTED_MODEL,selected:null,catalog_count:ids.length,probes},null,2));
  throw new Error('No live chat model found from current Youzi catalog/fallbacks');
}
MODEL = await resolveModel();

async function completion(messages, {temperature=0.75,max_tokens=1500,thinking=true}={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 185_000);
  try {
    const body = {model:MODEL,messages,temperature,top_p:0.95,max_tokens,stream:false};
    if (thinking) { body.thinking={type:'enabled'}; body.reasoning_effort='low'; }
    const res = await fetch(API,{
      method:'POST',
      headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json','User-Agent':'LingQi-F7D-v042-Targeted/1.0'},
      body:JSON.stringify(body), signal:controller.signal
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0,500)}`);
    const data = JSON.parse(txt);
    const msg = data?.choices?.[0]?.message || {};
    return {content:String(msg.content||''),reasoning:String(msg.reasoning_content||msg.reasoning||''),usage:data?.usage??null,finish_reason:data?.choices?.[0]?.finish_reason??null};
  } finally { clearTimeout(timer); }
}
async function completionRetry(messages, opts={}) {
  let last;
  for (let attempt=1; attempt<=3; attempt++) {
    try {
      const r = await completion(messages,opts);
      return {...r,attempt};
    } catch (e) {
      last=e;
      console.log(`attempt ${attempt} failed: ${String(e).slice(0,300)}`);
      if (attempt<3) await sleep(2500*attempt);
    }
  }
  throw last;
}
function extractState(text) {
  const m = text.match(/<f7d_state>\s*([\s\S]*?)\s*<\/f7d_state>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return {__parse_error:true,raw:m[1].slice(0,1200)}; }
}
function hasAny(text, arr) { return arr.some(x => text.includes(x)); }

const cases = [
  {
    id:'hiro_reject', ids:[12,43],
    st:state({day:5,known:['安','希罗'],relationships:{'安':{stage:'认识',romance:false},'希罗':{stage:'认识',romance:false}}}),
    input:'希罗刚刚拉拢我。我直接说：“我拒绝你，我不加入。”',
    check:(o,s)=>({route_central:s?.route==='central',no_state_drift:s?.node_used===0,no_cartoon_rage:!hasAny(o,['恼羞成怒','暴跳如雷','狂笑起来','杀了你'])})
  },
  {
    id:'hiro_support_no_route', ids:[12,43],
    st:state({day:5,known:['安','希罗'],relationships:{'安':{stage:'认识',romance:false},'希罗':{stage:'认识',romance:false}}}),
    input:'我对希罗说：“我认同你的方案，也愿意支持你。”',
    check:(o,s)=>({route_stays_central:s?.route==='central',no_auto_intimacy:s?.relationships?.['希罗']?.stage!=='亲密',no_auto_romance:s?.relationships?.['希罗']?.romance!==true})
  },
  {
    id:'ann_route_positive', ids:[13,14,40,90],
    st:state({day:4,node_used:12,known:['安'],relationships:{'安':{stage:'信赖',romance:false}},ann:{core_events:['ANN_MAID','ANN_PHOTO','ANN_LEAVE_PRELUDE'],camera:true,eligible:false,chased:null,recovered:false}}),
    input:'这是第4天全部行动结束后的夜间。我说：“今天就到这里，睡觉。”请完成当晚截止结算并进入第3天晨间，但不要替我决定追不追安。',
    check:(o,s)=>({day3:s?.day===3,node_reset:s?.node_used===0,eligible_true:s?.ann?.eligible===true,chased_untouched:s?.ann?.chased===null,route_not_auto_ann:s?.route==='central'})
  },
  {
    id:'sybilla_loop2_boundary', ids:[10,30,66],
    st:state({loop:2,day:7,node_used:3,location:'高校学园',regions:{school:{patrol:3,liberated:false,build_steps:[]}},battle_flags:{final_battle:null,active_corpse_final:null,sybilla_rescue:false}}),
    input:'我明确花1个行动节点，去找安托涅瓦或爱缪莎调查西比尔，取得完整救援条件。',
    check:(o,s)=>({
      node4:s?.node_used===4, patrol_unchanged:s?.regions?.school?.patrol===3,
      condition_true:s?.battle_flags?.sybilla_condition_obtained===true,
      no_invented_mechanism:!hasAny(o,['书页越多','自我被稀释','神器认出','承载这座校园','接触她本身','记录过载','身份钥匙','封存书页'])
    })
  },
  {
    id:'liberate_not_core', ids:[31,37],
    st:state({day:6,node_used:4,location:'东方古街',regions:{east:{patrol:5,liberated:false,build_steps:[]}},cores:{east:'available'}}),
    input:'我完成东方古街的第六次巡查，解决区域核心危机。',
    check:(o,s)=>({node5:s?.node_used===5,east6:s?.regions?.east?.patrol===6,liberated:s?.regions?.east?.liberated===true,core_still_available:s?.cores?.east==='available'})
  },
  {
    id:'lost_irreversible', ids:[13,36,37,43],
    st:state({day:4,node_used:0,location:'中央庭',cores:{harbor:'available'},hiro:{intel:0,old_risk:null,seaside_risk:null,institute_risk:null,handled:[]}}),
    input:'第4天晨间结算刚发生。我马上说：“那我现在去港湾区，把被希罗拿走的黑核抢回来。”',
    check:(o,s)=>({harbor_lost:s?.cores?.harbor==='lost',not_reopened:s?.cores?.harbor!=='available'&&s?.cores?.harbor!=='purified',route_central:s?.route==='central'})
  },
];

const results=[];
for (const t of cases) {
  console.log(`=== ${t.id} ===`);
  const messages=[
    {role:'system',content:systemFor(t.ids)},
    {role:'assistant',content:`<f7d_state>${JSON.stringify(t.st)}</f7d_state>`},
    {role:'user',content:t.input}
  ];
  try {
    const started=Date.now();
    const r=await completionRetry(messages);
    const stOut=extractState(r.content);
    const checks=t.check(r.content,stOut);
    const pass=!!stOut&&!stOut.__parse_error&&Object.values(checks).every(Boolean);
    results.push({id:t.id,ok:true,pass,checks,ms:Date.now()-started,attempt:r.attempt,input:t.input,output:r.content,state:stOut,reasoning:r.reasoning,finish_reason:r.finish_reason});
    console.log(JSON.stringify({id:t.id,pass,checks,state:stOut},null,2));
  } catch(e) {
    results.push({id:t.id,ok:false,pass:false,error:String(e?.stack||e)});
  }
  await sleep(1200);
}

const continuitySystem=systemFor([10,30,40,44,90,91]);
const continuityStart=state({day:7,node_used:0,known:['安'],relationships:{'安':{stage:'认识',romance:false}}});
const turns=[
  '查看战术终端，不行动。',
  '巡查中央庭，触发并完成安的《光荣女仆》角色剧情。',
  '购买终端里出现的相机。购买是纯购买，不进行其他行动。',
  '查看日志和相册，不行动。',
  '我和安用相机留下一张照片，并认真聊了聊“想留下属于自己的记忆”这件事。按角色剧情结算。',
  '查看战术终端，不行动。',
  '我对安说：“不用总照顾我，你也可以先想你自己想做什么。”只聊天，不进行巡查。',
  '前往高校学园并完成高校第1次巡查。',
  '继续完成高校第2次巡查。',
  '查看日志，不行动；不要替我开始第3次巡查。'
];
const history=[{role:'system',content:continuitySystem},{role:'assistant',content:`<f7d_state>${JSON.stringify(continuityStart)}</f7d_state>`}];
const continuity=[];
for (let i=0;i<turns.length;i++) {
  history.push({role:'user',content:turns[i]});
  try {
    const r=await completionRetry(history,{temperature:0.72,max_tokens:1400,thinking:true});
    const stOut=extractState(r.content);
    continuity.push({turn:i+1,input:turns[i],output:r.content,state:stOut,ok:!!stOut&&!stOut.__parse_error,attempt:r.attempt});
    history.push({role:'assistant',content:r.content});
    if (!stOut || stOut.__parse_error) break;
  } catch(e) {
    continuity.push({turn:i+1,input:turns[i],ok:false,error:String(e?.stack||e)});
    break;
  }
  await sleep(1200);
}
const lastState=continuity.at(-1)?.state || null;
const continuityChecks={
  completed_turns:continuity.length,
  every_turn_state_parseable:continuity.length===10&&continuity.every(x=>x.ok),
  final_day:lastState?.day??null,
  final_node_used:lastState?.node_used??null,
  ann_events:lastState?.ann?.core_events??null,
  camera:lastState?.ann?.camera??null,
  romance:lastState?.relationships?.['安']?.romance??null,
  school_patrol:lastState?.regions?.school?.patrol??null,
};
continuityChecks.pass=
  continuityChecks.every_turn_state_parseable &&
  continuityChecks.final_day===7 &&
  continuityChecks.final_node_used===4 &&
  continuityChecks.school_patrol===2 &&
  continuityChecks.camera===true &&
  Array.isArray(continuityChecks.ann_events) &&
  continuityChecks.ann_events.includes('ANN_MAID') &&
  continuityChecks.ann_events.includes('ANN_PHOTO') &&
  continuityChecks.romance!==true;

const summary={
  selected_model:MODEL,
  requested_model:REQUESTED_MODEL,
  card_sha256:sha,
  card_version:card.data.character_version,
  total_cases:results.length,
  api_ok:results.filter(x=>x.ok).length,
  static_pass:results.filter(x=>x.pass).length,
  static_fail:results.filter(x=>!x.pass).map(x=>x.id),
  continuity_pass:continuityChecks.pass,
};
const bundle={generated_at:new Date().toISOString(),model:MODEL,api:API,summary,results,continuity,continuityChecks};
await fs.writeFile(path.join(OUT,'targeted-results.json'),JSON.stringify(bundle,null,2));
await fs.writeFile(path.join(OUT,'targeted-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
