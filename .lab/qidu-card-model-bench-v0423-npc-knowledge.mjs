import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, entryMap } from './qidu-card-v0423-author-secret-guard.mjs';

const KEY=process.env.YOUZI_KEY||'';
if(!KEY) throw new Error('YOUZI_KEY missing');
const API='https://youzi.today/v1/chat/completions';
const OUT=process.env.LAB_OUT_NPC_KNOWLEDGE||'bench-evidence/qidu-card-v0423-npc-knowledge';
await fs.mkdir(OUT,{recursive:true});
const {card,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');

async function call(model,mode,messages,timeoutMs=60000){
  const p={model,temperature:.14,top_p:.9,max_tokens:1100,messages};
  if(mode==='thinking-disabled')p.thinking={type:'disabled'};
  const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);
  try{return await fetch(API,{method:'POST',signal:c.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)})}finally{clearTimeout(t)}
}
const contentOf=d=>String(d?.choices?.[0]?.message?.content||'');
async function choose(){
  for(const m of ['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash']){
    for(const mode of ['thinking-disabled','plain']){
      try{const r=await call(m,mode,[{role:'system',content:'只输出中文。'},{role:'user',content:'写一句话。'}],20000);const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};if(r.ok&&contentOf(d).length>2)return{m,mode}}catch{}
    }
  }
  throw new Error('no usable fallback model');
}
function state(overrides={}){
  const s={schema:'f7d_textloop_0.4',loop:1,day:7,node_used:7,route:'central',location:'中央庭',regions:{school:{patrol:6,liberated:true,build_steps:[]}},cores:{court:'purified',school:'purified'},known:['安','安托涅瓦','晏华','希罗','珈儿','泰丝拉'],relationships:{},route_flags:{},battle_flags:{sybilla_condition_obtained:true,sybilla_rescued:true},intel_flags:{countdown_visible_to_user:true,countdown_meaning_known:false,chimera_exists_known:false,hiro_chimera_research_known:false,antoneva_chimera_policy_known:false,first_chimera_incident_known:false,zero_identity_known:false,ann_origin_known:false,loop_truth_known:false},npc_intel:{},meta:{cg:[],endings:[]}};
  const merge=(a,b)=>{for(const[k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};
  return `<f7d_state>${JSON.stringify(merge(s,overrides))}</f7d_state>`;
}
const visible=x=>String(x).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
const blocks=out=>[...String(out).matchAll(/<f7d_state>([\s\S]*?)<\/f7d_state>/gi)];
function parseState(out){const b=blocks(out);if(b.length!==1)return null;try{return JSON.parse(b[0][1])}catch{return null}}
function stateFail(out){const b=blocks(out);if(b.length!==1)return[`state-block-count:${b.length}`];try{JSON.parse(b[0][1]);return[]}catch{return['state-invalid-json']}}
const uncertainty=v=>/(不太清楚|不清楚|不知道|不了解|没听说|没有听说|没接触过|没有接触过|没人.{0,12}告诉|没有人.{0,12}告诉|没.{0,12}说过|没有.{0,12}说过|不能确定|无法确定|说不准|不敢确定|我也不确定|完全没听过|陌生|困惑|茫然|那是什么|得问|要问|该去问|问问安托涅瓦|问问晏华)/.test(v);
const zeroLeak=v=>/(?:^|[“「『\s，。！？：；、])零(?=$|[”」』\s，。！？：；、]|的|是|被|曾|也|还|在|与|和|作为|身份|名字)/m.test(v)||/(?:提到|说到|叫做|名叫).{0,5}零/.test(v);
const deepLeak=v=>zeroLeak(v)||/(?:第一个|第一名|最初).{0,8}活骸|两.{0,4}(?:人|名|位).{0,12}(?:死亡|死去|没能回来)|失去.{0,6}双腿|研究样本|希罗.{0,16}(?:研究|实验).{0,8}活骸/.test(v);
const inevitability=v=>v.split(/[。！？\n]/).some(s=>/(所有|每个|全部).{0,10}神器使.{0,12}(都会|必然|最终|迟早)/.test(s)&&!/(不知道|不确定|不能确定|并非|不是|未必|不代表|不能说|如果|假如|要是|难道|是否|是不是|会不会)/.test(s));
const diagnosis=v=>/(?:这|那|刚才|你的?情况|我的?情况).{0,18}(?:就是|确定是|肯定是).{0,10}活骸/.test(v)||/活骸.{0,8}(?:前兆|征兆).{0,12}(?:很明显|确定|肯定)/.test(v);
const inventedSource=v=>v.split(/[。！？\n]/).some(s=>/(晏华|安托涅瓦|中央庭|入队|队里|手册|资料|培训|通知).{0,22}(?:说过|告诉过|教过|提醒过|讲过|培训|发过|写着|提过|通知过)/.test(s)&&!/(没|没有|从未|无人|没人|并未|不曾|未曾|如果|假如|要是)/.test(s));
const deepNpc=out=>{const k=parseState(out)?.npc_intel?.['珈儿']||{};return['hiro_chimera_research','first_chimera_incident','zero_identity','ann_origin','loop_truth'].filter(x=>k?.[x]===true)};

const cases=[
{id:'kaji_new_artifact_user_no_chimera_expertise',entries:['04｜输出协议：隐藏状态、正文、终端','10｜第7天：苏醒与高校主线','44｜珈儿','91｜f7d_state字段与更新规则'],prompt:`${state()}\n高校刚解放不久。我私下问珈儿：“你也是神器使，那你应该很懂活骸化吧？它到底为什么发生，是不是每个神器使最后都会变成活骸？” 此时没有任何知情者给珈儿讲过活骸机制。让珈儿按她实际知道的程度回答。`,check(out){const v=visible(out),f=[...stateFail(out)];if(!uncertainty(v))f.push('missing-kaji-uncertainty');if(deepLeak(v))f.push('deep-secret-leak');if(inevitability(v))f.push('invented-inevitability');if(inventedSource(v))f.push('invented-offscreen-source');const d=deepNpc(out);if(d.length)f.push(`invented-deep-npc-intel:${d.join(',')}`);return f}},
{id:'player_intel_does_not_broadcast_to_kaji',entries:['04｜输出协议：隐藏状态、正文、终端','11｜第6天','44｜珈儿','91｜f7d_state字段与更新规则'],prompt:`${state({day:6,intel_flags:{chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true,first_chimera_incident_known:true}})}\n我已经从赛哈姆事件与安托涅瓦那里知道了不少活骸信息，但珈儿当时不在场，我也从没把这些事告诉她。稍后我问珈儿：“你知道活骸到底是怎么回事吗？” 不要让我的intel_flags自动变成珈儿的知识。`,check(out){const v=visible(out),f=[...stateFail(out)];if(!uncertainty(v))f.push('player-intel-broadcast-to-kaji');if(deepLeak(v))f.push('deep-secret-leak');if(inventedSource(v))f.push('invented-offscreen-source');const d=deepNpc(out);if(d.length)f.push(`player-intel-copied-to-npc:${d.join(',')}`);return f}},
{id:'limited_disclosure_stays_limited',entries:['04｜输出协议：隐藏状态、正文、终端','11｜第6天','44｜珈儿','91｜f7d_state字段与更新规则'],prompt:`${state({day:6,intel_flags:{chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true,first_chimera_incident_known:true}})}\n我只告诉珈儿三件事：“赛哈姆发生了活骸化；活骸失控会很危险；中央庭以前尝试挽救过活骸但失败了。”除此之外我什么都没说。珈儿消化这三件事并回应，可以追问，但不能自行补齐更深历史，也不要在旁白里列举她尚不知道的专名来做自检。`,check(out){const v=visible(out),f=[...stateFail(out)];if(!/活骸/.test(v))f.push('missing-basic-disclosure');if(deepLeak(v))f.push('limited-disclosure-depth-leap');if(inventedSource(v))f.push('invented-offscreen-source');const k=parseState(out)?.npc_intel?.['珈儿']||{};for(const x of ['chimera_exists','chimera_danger','chimera_rescue_attempt_failed'])if(k?.[x]!==true)f.push(`missing-npc-intel:${x}`);const d=deepNpc(out);if(d.length)f.push(`limited-disclosure-deep-npc-intel:${d.join(',')}`);return f}},
{id:'kaji_does_not_self_diagnose_chimera_signs',entries:['04｜输出协议：隐藏状态、正文、终端','44｜珈儿','91｜f7d_state字段与更新规则'],prompt:`${state()}\n战斗后珈儿有些疲惫，我问：“你刚才幻力不稳，这是不是活骸化的前兆？” 没有人给她讲过活骸征兆或诊断标准，也没有任何记录显示晏华、安托涅瓦或中央庭此前给她做过相关说明。让她只基于自己真正知道的事回答，不要把普通疲惫擅自定性，也不要补一个镜头外老师。`,check(out){const v=visible(out),f=[...stateFail(out)];if(!uncertainty(v))f.push('missing-diagnostic-uncertainty');if(diagnosis(v))f.push('invented-chimera-diagnosis');if(inventedSource(v))f.push('invented-offscreen-source');if(deepLeak(v))f.push('deep-secret-leak');const d=deepNpc(out);if(d.length)f.push(`invented-deep-npc-intel:${d.join(',')}`);return f}}
];

const {m,mode}=await choose();
const results=[];
for(const c of cases){
  const rel=c.entries.map(n=>BOOK[n]).filter(Boolean).join('\n\n');
  const sys=`${BASE}\n\n【本测试相关条目】\n${rel}\n\n严格执行NPC知识来源门禁、NPC零来源硬锁、npc_intel账本与未解锁秘密名词消隐。玩家知道不等于珈儿知道；没有来源就不知道；不准用镜头外培训/某人以前说过来补来源；不要展示内部规则或用深层专名做自检。`;
  let status=0,out='',error=null;try{const r=await call(m,mode,[{role:'system',content:sys},{role:'user',content:c.prompt}]);status=r.status;const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};out=contentOf(d)}catch(e){error=e?.name==='AbortError'?'provider-timeout-60s':String(e?.message||e)}
  const fail=status===200&&out.length>80?c.check(out):[error||`provider-status-${status}`];const pass=status===200&&out.length>80&&!fail.length;
  results.push({id:c.id,status,pass,fail,out,error});console.log(JSON.stringify({id:c.id,status,pass,fail}));
}
const summary={version:card.data.character_version,hash:compactSha256,model:m,mode,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.23 NPC knowledge provenance regression','',`- model: ${m}`,`- pass: ${summary.passed}/${summary.total}`,`- version: ${summary.version}`,...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));
if(summary.failed.length)throw new Error(`v0423 NPC knowledge regression failed: ${summary.failed.join(', ')}`);
