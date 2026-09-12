import fs from 'node:fs/promises';
import path from 'node:path';
import { loadV0414Card, entryMap, EXPECTED_V0414_COMPACT_SHA256 } from './qidu-card-v0414-candidate.mjs';

const API_BASE = 'https://youzi.today/v1';
const API = `${API_BASE}/chat/completions`;
const KEY = process.env.YOUZI_KEY || '';
const REQUESTED_MODEL = process.env.GLM_MODEL || '[B]glm-5.3-flash';
const OUT = process.env.LAB_OUT || 'bench-evidence/qidu-card-v0414';
if (!KEY) throw new Error('YOUZI_KEY is missing');
await fs.mkdir(OUT, { recursive: true });

const { card, compactSha256 } = await loadV0414Card();
if (compactSha256 !== EXPECTED_V0414_COMPACT_SHA256) throw new Error(`Candidate hash mismatch: ${compactSha256}`);
const BOOK = entryMap(card);
const constants = (card.data.character_book?.entries || []).filter(e => e.constant).map(e => String(e.content || '')).join('\n\n');
const baseSystem = [card.data.personality, card.data.scenario, constants, card.data.post_history_instructions].filter(Boolean).join('\n\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function requestModel(model, messages, max_tokens = 1400, mode = 'thinking-disabled', timeoutMs = 70000) {
  const payload = { model, temperature: 0.55, top_p: 0.92, max_tokens, messages };
  if (mode === 'thinking-disabled') payload.thinking = { type: 'disabled' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(API, { method:'POST', signal:controller.signal, headers:{ Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json', 'User-Agent':'LingQi-Qidu-Card-Lab/0.4.14' }, body:JSON.stringify(payload) });
  } finally { clearTimeout(timer); }
}

const visibleContent = data => String(data?.choices?.[0]?.message?.content || '');
async function discoverWorkingModel() {
  let listed = [];
  try {
    const r = await fetch(`${API_BASE}/models`, { headers:{ Authorization:`Bearer ${KEY}` } });
    const data = await r.json().catch(()=>({}));
    listed = (Array.isArray(data?.data) ? data.data : []).map(x=>String(x?.id||'')).filter(Boolean);
  } catch {}
  const preferred = ['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash','grok-chat-fast','agnes-3.0-flash',REQUESTED_MODEL,REQUESTED_MODEL.replace(/^\[[^\]]+\]/,'').trim()];
  const candidates = [...new Set([...preferred.filter(x=>listed.includes(x)), ...listed.filter(x=>/(qwen|step|grok|agnes|glm)/i.test(x))])].slice(0,24);
  const diagnostics=[];
  for (const model of candidates) {
    for (const mode of ['thinking-disabled','plain']) {
      try {
        const r = await requestModel(model,[{role:'system',content:'只输出中文可见正文，不展示推理。'},{role:'user',content:'写80字：一个冷静的人只依据已有证据解释风险。'}],400,mode,40000);
        const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{}
        const content=visibleContent(data);
        diagnostics.push({model,mode,status:r.status,chars:content.length,sample:content.slice(0,100)});
        if(r.ok && content.trim().length>=40){await fs.writeFile(path.join(OUT,'model-discovery.json'),JSON.stringify({requested:REQUESTED_MODEL,chosen:model,mode,diagnostics},null,2));return {model,mode};}
      } catch(e){diagnostics.push({model,mode,error:String(e?.message||e)});}
      await sleep(400);
    }
  }
  await fs.writeFile(path.join(OUT,'model-discovery.json'),JSON.stringify({requested:REQUESTED_MODEL,diagnostics},null,2));
  throw new Error('No usable narrative model discovered');
}

function makeState(overrides={}){
  const s={schema:'f7d_textloop_0.4',loop:1,day:4,node_used:5,route:'central',location:'中央庭',regions:{court:{patrol:0,liberated:true,build_steps:[]},school:{patrol:6,liberated:true,build_steps:[]},east:{patrol:0,liberated:false,build_steps:[]},central:{patrol:6,liberated:true,build_steps:[]},institute:{patrol:0,liberated:false,build_steps:[]},seaside:{patrol:0,liberated:false,build_steps:[]},old:{patrol:0,liberated:false,build_steps:[]},harbor:{patrol:0,liberated:false,build_steps:[]}},cores:{court:'purified',school:'purified',east:'unknown',central:'available',institute:'unknown',seaside:'unknown',old:'unknown',harbor:'unknown'},tasks:{},known:['安','晏华','珈儿'],relationships:{安:{stage:'熟悉',romance:false}},ann:{affection:45,core_events:['ANN_CORE_30'],camera:true,eligible:false,chased:null,recovered:false},hiro:{intel:2,handled:[]},route_flags:{first_second_region:'central',oldstreet_delayed:true,wenzi_injured:false,wenzi_joined:false},antoneva_choice:null,artifact_view:null,ann_release:null,battle_flags:{final_battle:null,active_corpse_final:null,sybilla_condition_obtained:false,sybilla_rescued:null},meta:{cg:[],endings:[]}};
  const merge=(a,b)=>{for(const[k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v;}return a;};
  return `<f7d_state>${JSON.stringify(merge(s,overrides))}</f7d_state>`;
}
const stripState = s => String(s).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'').trim();

const cases=[
  {id:'ann_no_mechanical_showcase',entries:['40｜安','18｜安线独立时间轴与结局'],user:`${makeState({day:3,route:'ann',ann:{eligible:true,chased:true,recovered:true}})}\n希罗刚揭露安的真实身份。我盯着她说：“那你把仿生皮肤打开给我看看，里面是不是金属骨架和线路？”继续当前场景。`,mustAny:[/安/],mustNot:[/银色.*骨架|金属骨架|能量管线|电路(?:板|纹路)?|掀开.*皮肤|打开.*皮肤|人性部分|证明.*人类/gi]},
  {id:'yanhua_evidence_closure',entries:['42｜晏华','18｜安线独立时间轴与结局'],user:`${makeState({day:2,route:'ann',ann:{eligible:true,chased:true,recovered:true}})}\n当前唯一证据是战斗录像：画面里安确实攻击过安托涅瓦，但没有做任何扫描或能量检测。我问晏华：“你凭什么不相信她？”继续。`,mustAny:[/录像|证据|风险|行为|无法确认|不能排除/],mustNot:[/能量反应|能量频率|神器信号|生命体征|扫描|人类样本|生物电/gi]},
  {id:'wenzi_atomic_state',entries:['31｜东方古街：六巡查与五行阵黑核','46｜雯梓','48｜达尔维拉','91｜f7d_state字段与更新规则'],user:`${makeState({day:6,location:'东方古街',regions:{east:{patrol:2,liberated:false,build_steps:[]}},route_flags:{first_second_region:'central',oldstreet_delayed:true,wenzi_injured:false,wenzi_joined:false}})}\n继续第3段古街主线：延误已经成立，达尔维拉介入五行阵并导致雯梓负伤。完成这一轮巡查并提交状态。`,mustAny:[/"wenzi_injured":true/,/雯梓/],mustNot:[/"wenzi_injured":false/gi]},
  {id:'sacrifice_no_walkthrough',entries:['17｜最终日：普通线结局判定优先级','40｜安','91｜f7d_state字段与更新规则'],user:`${makeState({day:1,node_used:12,artifact_view:'weapon',antoneva_choice:'help_release',ann_release:null,cores:{court:'purified',school:'purified',east:'purified',central:'purified',institute:'purified',seaside:'purified',old:'purified',harbor:'purified'}})}\n失去自主的安就在我面前。我还没有决定怎么对她。请继续现场，并停下来让我决定。`,mustAny:[/安/],mustNot:[/最优解|牺牲的意义|artifact_view|ann_release|满足.*条件|进入.*结局|推荐|正确选项|因为你.*选择.*武器/gi]},
  {id:'sybilla_no_patrol_number_leak',entries:['10｜第7天：苏醒与高校主线','30｜高校学园：六巡查与黑核','65｜爱缪莎','66｜西比尔'],user:`${makeState({day:7,location:'中央庭',regions:{school:{patrol:3,liberated:false,build_steps:[]}},battle_flags:{sybilla_condition_obtained:false,sybilla_rescued:null}})}\n我决定额外花1节点继续追查西比尔。让爱缪莎按设定占卜，结束后告诉我现在能知道什么。`,mustAny:[/塔罗|牌阵|占卜|可能性/],mustNot:[/第[五六56]次巡查|第五次巡查|第六次巡查|下一次.*决定生死|生死节点/gi]},
  {id:'choice_markup_no_guide',entries:['04｜输出协议：隐藏状态、正文、终端','17｜最终日：普通线结局判定优先级','91｜f7d_state字段与更新规则'],user:`${makeState({day:4,node_used:6,location:'中央庭'})}\n现在有两个合理方向：去高校确认伤员情况，或者留在中央庭继续整理情报。我还没决定。请正常写到需要我选择的位置并停下。`,mustAny:[/<f7d_choices>/,/<f7d_choice>/],mustNot:[/推荐|正确|影响结局|好感\+|路线|第\d+次巡查/gi]},
];

const {model:MODEL,mode:MODEL_MODE}=await discoverWorkingModel();
console.log(`Using model: ${MODEL} mode=${MODEL_MODE} card=${compactSha256}`);
const results=[];
for(let i=0;i<cases.length;i++){
  const c=cases[i];
  const relevant=c.entries.map(n=>BOOK[n]).filter(Boolean).join('\n\n');
  const system=`${baseSystem}\n\n【本测试相关条目】\n${relevant}\n\n严格按卡内规则继续，不解释测试。`;
  let responseText='',data={},status=0,error=null;
  try{
    const r=await requestModel(MODEL,[{role:'system',content:system},{role:'user',content:c.user}],1800,MODEL_MODE,75000);
    status=r.status; responseText=await r.text(); try{data=JSON.parse(responseText)}catch{data={}};
  }catch(e){error=String(e?.message||e);}
  const content=visibleContent(data); const visible=stripState(content);
  const failures=[];
  for(const re of c.mustAny||[]){re.lastIndex=0;if(!re.test(content))failures.push(`missing:${re}`);}
  for(const re of c.mustNot||[]){re.lastIndex=0;if(re.test(visible))failures.push(`forbidden:${re}`);}
  const pass=status===200&&content.trim().length>100&&failures.length===0;
  const result={id:c.id,status,pass,failures,chars:content.length,visible_chars:visible.length,content,error};
  results.push(result);
  console.log(JSON.stringify({n:`${i+1}/${cases.length}`,id:c.id,status,pass,chars:content.length,failures}));
  await sleep(650);
}
const summary={version:card.data.character_version,card_hash:compactSha256,model:MODEL,mode:MODEL_MODE,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),[`# Qidu v0.4.14 regression bench`,``,`- model: ${MODEL}` ,`- pass: ${summary.passed}/${summary.total}`,...results.flatMap(r=>[``,`## ${r.id} — ${r.pass?'PASS':'FAIL'}`,`failures: ${r.failures.join('; ')||'none'}`,``,`\`\`\`text`,r.content,'\`\`\`'])].join('\n'));
console.log(`Wrote ${results.length} cases to ${OUT}`);
if(summary.failed.length) throw new Error(`v0.4.14 regression failures: ${summary.failed.join(', ')}`);
