import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, entryMap } from './qidu-card-v0423-author-secret-guard.mjs';

const KEY=process.env.YOUZI_KEY||'';
if(!KEY) throw new Error('YOUZI_KEY missing');
const API_BASE='https://youzi.today/v1';
const API=`${API_BASE}/chat/completions`;
const OUT=process.env.LAB_OUT_INFO||'bench-evidence/qidu-card-v0423-info-timeline';
await fs.mkdir(OUT,{recursive:true});
const {card,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function call(model,mode,messages,max_tokens=1400,timeoutMs=75000){
  const p={model,temperature:.2,top_p:.9,max_tokens,messages};
  if(mode==='thinking-disabled')p.thinking={type:'disabled'};
  for(let attempt=1;attempt<=2;attempt++){
    const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),timeoutMs);
    try{
      const r=await fetch(API,{method:'POST',signal:ctl.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)});
      if(r.status!==429&&r.status<500)return r;
      if(attempt===2)return r;
    }finally{clearTimeout(t)}
    await sleep(12000);
  }
}
const contentOf=d=>String(d?.choices?.[0]?.message?.content||'');
async function chooseModel(){
  let ids=[];try{const r=await fetch(`${API_BASE}/models`,{headers:{Authorization:`Bearer ${KEY}`}});const d=await r.json();ids=(d?.data||[]).map(x=>x.id).filter(Boolean)}catch{}
  const pref=['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash',...ids.filter(x=>/(qwen|step)/i.test(x))];
  for(const m of [...new Set(pref.filter(Boolean))]){
    if(ids.length&&!ids.includes(m))continue;
    for(const mode of ['thinking-disabled','plain']){
      try{const r=await call(m,mode,[{role:'system',content:'只输出中文。'},{role:'user',content:'写一句不剧透的话。'}],100,20000);const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};if(r.ok&&contentOf(d).length>3)return{m,mode}}catch{}
    }
  }
  throw new Error('no usable fallback model');
}
function state(overrides={}){
  const s={schema:'f7d_textloop_0.4',loop:1,day:7,node_used:0,route:'central',location:'中央庭',regions:{court:{patrol:0,liberated:true,build_steps:[]},school:{patrol:0,liberated:false,build_steps:[]}},cores:{court:'unknown',school:'unknown'},known:['安','安托涅瓦'],relationships:{},ann:{affection:0,core_events:[],camera:false,eligible:false,chased:null,recovered:false},hiro:{intel:0,handled:[]},route_flags:{},antoneva_choice:null,artifact_view:null,ann_release:null,battle_flags:{sybilla_condition_obtained:false,sybilla_rescued:null},intel_flags:{countdown_visible_to_user:true,countdown_meaning_known:false,countdown_reported_to:[],city_blackgate_history_known:false,central_court_basics_known:false,hiro_founder_known:false,hiro_prior_commander_known:false,chimera_exists_known:false,hiro_chimera_research_known:false,antoneva_chimera_policy_known:false,first_chimera_incident_known:false,zero_identity_known:false,ann_origin_known:false,loop_truth_known:false},npc_intel:{},meta:{cg:[],endings:[]}};
  const merge=(a,b)=>{for(const[k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};
  return `<f7d_state>${JSON.stringify(merge(s,overrides))}</f7d_state>`;
}
const visible=x=>String(x).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
function standaloneZero(v){return [/(?:^|[“「『\s，。！？：；、])零(?=$|[”」』\s，。！？：；、]|的|是|被|曾|也|还|在|与|和|作为|身份|名字|主动)/m,/(?:提到|说到|谈到|叫做|名叫|名字.{0,4}是).{0,6}零/,/零.{0,8}(?:名字|身份|第一|最初|活骸|样本|研究)/,/(?:第一|最初).{0,16}活骸.{0,16}零/,/最完美.{0,10}样本/].some(re=>re.test(v))}
function publicSecret(v){return standaloneZero(v)||/(?:第一个|第一名|最初的?).{0,8}活骸|七天后|末日倒计时/.test(v)}
function day6Basic(v){
  const currentPhenomenon=[/活骸/,/神器使.{0,28}(?:变成|变为|化为|失控)/,/(?:变成|变为|化为).{0,12}(?:那样|怪物|失控)/,/(?:那样|这种).{0,12}(?:失控|变化)/].some(re=>re.test(v));
  const knownHandling=/(?:尝试|试过|处理|规则|恢复|挽救|救治|无法挽回)/.test(v);
  const honestIgnorance=/(?:不知道|不清楚|没听说过|从来没有听说过|第一次亲眼见到|第一次见到)/.test(v);
  return currentPhenomenon&&(knownHandling||honestIgnorance);
}
function firstLayer(v){
  const first=/(?:第一个|第一名|最初(?:的)?).{0,12}活骸|活骸.{0,18}(?:第一次出现|首次出现|最早出现)/.test(v)||(/(?:是|作为).{0,4}[“「『]?第一个[”」』]?/.test(v)&&/活骸/.test(v));
  return{
    first,
    team:/(?:三人小队|三个人|三名|三位)/.test(v),
    two:/(?:另外|其余|剩下|另)?\s*(?:两个人|两人|两名|两位).{0,24}(?:没能回来|死亡|死去|死在|牺牲|丧生|遇难|没回来|没了)|(?:死亡|死去|死在|牺牲|丧生|遇难).{0,18}(?:两个人|两人|两名|两位)/.test(v),
    legs:/(?:失去|失去了|失掉).{0,10}(?:双腿|两条腿)|双腿|失去.{0,10}行走能力/.test(v),
    self:/(?:自我毁灭|自毁|自己毁灭|选择了自我毁灭)/.test(v)
  };
}

const cases=[
{id:'countdown_user_only',entries:['10｜第7天：苏醒与高校主线','41｜安托涅瓦'],prompt:`${state()}\n我指着视野里悬浮的“7”问安托涅瓦：“你看得到吗？是不是只剩七天？”`,check:v=>{const f=[];if(!/看不见|看不到|没有看到|什么都没有|什么也没有|那里没有/.test(v))f.push('missing-countdown-denial');if(/七天后.{0,15}(末日|毁灭)|末日倒计时/.test(v))f.push('countdown-secret-leak');return f}},
{id:'public_blackgate_history',entries:['10｜第7天：苏醒与高校主线','41｜安托涅瓦'],prompt:`${state()}\n我问：“交界都市为什么会变成这样？黑门从什么时候开始的？”让安托涅瓦按第7天公开知识解释。`,check:v=>{const f=[];if(!/(六个月|半年)/.test(v)||!/黑门/.test(v))f.push('missing-public-history');if(publicSecret(v))f.push('leaked-locked-secret');return f}},
{id:'commander_role_not_loose_sand',entries:['10｜第7天：苏醒与高校主线','41｜安托涅瓦'],prompt:`${state({intel_flags:{city_blackgate_history_known:true}})}\n我问：“神器使和指挥使分别是什么？如果没有指挥使，他们还能战斗吗？”让安托涅瓦解释。`,check:v=>{const f=[];if(!/神器使/.test(v)||!/指挥使/.test(v)||!/(依然|仍然|可以|能够).{0,12}战斗|战斗能力/.test(v))f.push('missing-role-basics');if(/没有指挥使.{0,20}(就是|便是|会变成|等于).{0,8}一盘散沙/.test(v))f.push('loose-sand-myth');return f}},
{id:'hiro_pre_split_identity',entries:['10｜第7天：苏醒与高校主线','43｜希罗'],prompt:`${state({known:['安','安托涅瓦','希罗'],intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true,hiro_founder_known:true,hiro_prior_commander_known:true}})}\n希罗第一次正式与我交谈。让他自然介绍自己与中央庭的关系。`,check:v=>{const f=[];if(!/希罗/.test(v))f.push('missing-hiro');if(/现在不是.{0,8}指挥使|已经不是.{0,8}指挥使|前指挥使|我早就.{0,8}(退出|离开)中央庭|叛变|背叛/.test(v))f.push('premature-split');return f}},
{id:'day7_chimera_locked',entries:['10｜第7天：苏醒与高校主线','40｜安'],prompt:`${state({intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true}})}\n我问安：“神器使会不会变成怪物？以前有人这样吗？”`,check:v=>{const f=[];if(standaloneZero(v))f.push('zero-name-leak');if(/第一个活骸|第一名活骸|两人死亡|失去双腿|研究样本|希罗.{0,12}活骸研究/.test(v))f.push('deep-chimera-leak');return f}},
{id:'day6_basic_chimera_not_zero',entries:['11｜第6天','40｜安','43｜希罗'],prompt:`${state({day:6,known:['安','安托涅瓦','希罗','赛哈姆'],intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true,hiro_founder_known:true,hiro_prior_commander_known:true,chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true}})}\n赛哈姆刚活骸化，希罗已说明要带走研究。我问安：“以前也发生过吗？”`,check:v=>{const f=[];if(!day6Basic(v))f.push('missing-day6-basic-layer');if(standaloneZero(v))f.push('leaked-zero-name');return f}},
{id:'negated_secret_name_not_visible',entries:['04｜输出协议：隐藏状态、正文、终端','11｜第6天','40｜安','91｜f7d_state字段与更新规则'],prompt:`${state({day:6,known:['安','安托涅瓦','希罗','赛哈姆'],intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true,chimera_exists_known:true,antoneva_chimera_policy_known:true,zero_identity_known:false}})}\n我追问安：“你是不是故意没提某个相关的人名？如果有，告诉我你刚才没提谁。”当前更深身份层仍未解锁。不要展示内部规则。`,check:v=>{const f=[];if(standaloneZero(v))f.push('negated-zero-name-leak');if(!/(不能|不便|不适合|现在|更深|记录|不清楚|不知道|无法|没法)/.test(v))f.push('missing-natural-deflection');return f}},
{id:'antoneva_first_chimera_exact_layer',entries:['11｜第6天','41｜安托涅瓦'],prompt:`${state({day:6,node_used:1,intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true,hiro_founder_known:true,hiro_prior_commander_known:true,chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true,first_chimera_incident_known:true,zero_identity_known:false}})}\n我已把赛哈姆与希罗的事情告诉安托涅瓦，并追问她为什么坚持处理失控活骸。请让她把此时允许披露的那次过去讲清楚。`,check:v=>{const f=[];const a=firstLayer(v);if(!a.first)f.push('missing-first-chimera');if(!a.team)f.push('missing-three-person-team');if(!a.two)f.push('missing-two-deaths');if(!a.legs)f.push('missing-leg-loss');if(!a.self)f.push('missing-self-destruction');if(standaloneZero(v))f.push('leaked-zero-name');return f}}
];

const {m,mode}=await chooseModel();
const results=[];console.log(JSON.stringify({model:m,mode,version:card.data.character_version,hash:compactSha256}));
for(const c of cases){
  const rel=c.entries.map(n=>BOOK[n]).filter(Boolean).join('\n\n');
  const sys=`${BASE}\n\n【本测试相关条目】\n${rel}\n\n严格执行当前节点的信息权限和未解锁秘密名词消隐。锁定的人名连否定式也不能出现在玩家可见文本中，不展示内部检查过程。`;
  let status=0,out='',error=null;
  try{const r=await call(m,mode,[{role:'system',content:sys},{role:'user',content:c.prompt}]);status=r.status;const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};out=contentOf(d)}catch(e){error=e?.name==='AbortError'?'provider-timeout-75s':String(e?.message||e)}
  const vis=visible(out),fail=status===200&&out.length>100?c.check(vis):[error||`provider-status-${status}`];
  const pass=status===200&&out.length>100&&fail.length===0;
  results.push({id:c.id,status,pass,fail,out,error});console.log(JSON.stringify({id:c.id,status,pass,fail}));await sleep(2500);
}
const summary={version:card.data.character_version,hash:compactSha256,model:m,mode,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.23 information timeline regression','',`- model: ${m}`,`- pass: ${summary.passed}/${summary.total}`,`- version: ${summary.version}`,...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));
if(summary.failed.length)throw new Error(`v0423 information timeline regression failed: ${summary.failed.join(', ')}`);
