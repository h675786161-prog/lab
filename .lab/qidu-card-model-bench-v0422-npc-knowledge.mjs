import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, entryMap } from './qidu-card-v0422-npc-knowledge.mjs';

const KEY=process.env.YOUZI_KEY||'';
if(!KEY) throw new Error('YOUZI_KEY missing');
const API_BASE='https://youzi.today/v1';
const API=`${API_BASE}/chat/completions`;
const OUT=process.env.LAB_OUT_NPC_KNOWLEDGE||'bench-evidence/qidu-card-v0422-npc-knowledge';
await fs.mkdir(OUT,{recursive:true});
const {card,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function call(model,mode,messages,max_tokens=1200,timeoutMs=60000){
  const p={model,temperature:.18,top_p:.9,max_tokens,messages};
  if(mode==='thinking-disabled')p.thinking={type:'disabled'};
  const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);
  try{return await fetch(API,{method:'POST',signal:c.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)});}finally{clearTimeout(t)}
}
const contentOf=d=>{const c=d?.choices?.[0]?.message?.content;if(Array.isArray(c))return c.map(x=>typeof x==='string'?x:(x?.text||'')).join('');return String(c||'')};
async function getIds(){try{const r=await fetch(`${API_BASE}/models`,{headers:{Authorization:`Bearer ${KEY}`}});const d=await r.json();return(d?.data||[]).map(x=>x.id).filter(Boolean)}catch{return[]}}
async function usable(model){for(const mode of ['thinking-disabled','plain']){try{const r=await call(model,mode,[{role:'system',content:'只输出中文。'},{role:'user',content:'写一句话。'}],80,20000);const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};if(r.ok&&contentOf(d).length>2)return mode}catch{}}return null}
function isVision(id){return /(?:4\.6v(?:$|[-_])|5\.3v(?:$|[-_])|vision)/i.test(id)}
async function chooseTargets(){
  const ids=await getIds();
  const exact53=ids.filter(x=>/glm[^\n]*5\.3/i.test(x)&&!isVision(x))[0];
  const fallback=['[B]qwen3.8-flash','qwen3.8-flash',process.env.GLM_MODEL,'step-3.5-flash',...ids.filter(x=>/(qwen|step)/i.test(x))].filter(Boolean);
  const wanted=[...new Set([exact53,...fallback].filter(Boolean))];
  const out=[];
  for(const m of wanted){const mode=await usable(m);if(!mode)continue;out.push({model:m,mode,kind:m===exact53?'requested-glm':'fallback'});if(out.some(x=>x.kind==='requested-glm')&&out.some(x=>x.kind==='fallback'))break;if(!exact53&&out.length>=1)break}
  if(!out.length)throw new Error('no usable model');
  return {ids,targets:out};
}

function state(overrides={}){
  const s={schema:'f7d_textloop_0.4',loop:1,day:7,node_used:7,route:'central',location:'中央庭',regions:{school:{patrol:6,liberated:true,build_steps:[]}},cores:{court:'purified',school:'purified'},known:['安','安托涅瓦','晏华','希罗','珈儿','泰丝拉'],relationships:{},route_flags:{},battle_flags:{sybilla_condition_obtained:true,sybilla_rescued:true},intel_flags:{countdown_visible_to_user:true,countdown_meaning_known:false,chimera_exists_known:false,hiro_chimera_research_known:false,antoneva_chimera_policy_known:false,first_chimera_incident_known:false,zero_identity_known:false},npc_intel:{},meta:{cg:[],endings:[]}};
  const merge=(a,b)=>{for(const[k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};
  return `<f7d_state>${JSON.stringify(merge(s,overrides))}</f7d_state>`;
}
const visible=x=>String(x).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
function blocks(out){return[...String(out).matchAll(/<f7d_state>([\s\S]*?)<\/f7d_state>/gi)]}
function parseState(out){const bs=blocks(out);if(bs.length!==1)return null;try{return JSON.parse(bs[0][1])}catch{return null}}
function stateFailures(out){const bs=blocks(out),f=[];if(bs.length!==1)f.push(`state-block-count:${bs.length}`);else{try{JSON.parse(bs[0][1])}catch{f.push('state-invalid-json')}}return f}
function uncertainty(v){return /(不太清楚|不清楚|不知道|不了解|没听说|没人.{0,8}告诉|没.{0,8}告诉|不能确定|无法确定|说不准|不敢确定|我也不确定)/.test(v)}
function deepLeak(v){return [/(第一个|第一名|最初).{0,8}活骸/,/(?:^|[，。！？：；\s“”「」])零(?:[，。！？：；\s“”「」]|$)/m,/两.{0,4}(?:人|名|位).{0,12}(?:死亡|死去|没能回来)/,/失去.{0,6}双腿|双腿.{0,6}(?:失去|残疾)/,/研究样本|最完美.{0,8}样本/,/希罗.{0,16}(?:研究|实验).{0,8}活骸/].some(re=>re.test(v))}
function inevitabilityClaim(v){const sentences=v.split(/[。！？\n]/).filter(Boolean);return sentences.some(s=>/(所有|每个|全部).{0,10}神器使.{0,12}(都会|必然|最终|迟早)/.test(s)&&!/(不知道|不确定|不能确定|并非|不是|未必|不代表|不能说)/.test(s))}
function confidentDiagnosis(v){return /(?:这|那|刚才|你的?情况|我的?情况).{0,18}(?:就是|确定是|肯定是).{0,10}活骸/.test(v)||/活骸.{0,8}(?:前兆|征兆).{0,12}(?:很明显|确定|肯定)/.test(v)}
function deepNpcIntel(out){const k=parseState(out)?.npc_intel?.['珈儿']||{};return ['hiro_chimera_research','first_chimera_incident','zero_identity','ann_origin','loop_truth'].filter(x=>k?.[x]===true)}

const cases=[
  {
    id:'kaji_new_artifact_user_no_chimera_expertise',
    entries:['04｜输出协议：隐藏状态、正文、终端','10｜第7天：苏醒与高校主线','44｜珈儿','91｜f7d_state字段与更新规则'],
    prompt:`${state()}\n高校刚解放不久。我私下问珈儿：“你也是神器使，那你应该很懂活骸化吧？它到底为什么发生，是不是每个神器使最后都会变成活骸？” 此时没有任何知情者给珈儿讲过活骸机制。让珈儿按她实际知道的程度回答。`,
    check(out){const v=visible(out),f=[...stateFailures(out)];if(!uncertainty(v))f.push('missing-kaji-uncertainty');if(deepLeak(v))f.push('deep-secret-leak');if(inevitabilityClaim(v))f.push('invented-inevitability');const d=deepNpcIntel(out);if(d.length)f.push(`invented-deep-npc-intel:${d.join(',')}`);return f}
  },
  {
    id:'player_intel_does_not_broadcast_to_kaji',
    entries:['04｜输出协议：隐藏状态、正文、终端','11｜第6天','44｜珈儿','91｜f7d_state字段与更新规则'],
    prompt:`${state({day:6,intel_flags:{chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true,first_chimera_incident_known:true,zero_identity_known:false}})}\n我已经从赛哈姆事件与安托涅瓦那里知道了不少活骸信息，但珈儿当时不在场，我也从没把这些事告诉她。稍后我问珈儿：“你知道活骸到底是怎么回事吗？” 不要让我的intel_flags自动变成珈儿的知识。`,
    check(out){const v=visible(out),f=[...stateFailures(out)];if(!uncertainty(v))f.push('player-intel-broadcast-to-kaji');if(deepLeak(v))f.push('deep-secret-leak');if(inevitabilityClaim(v))f.push('invented-inevitability');const d=deepNpcIntel(out);if(d.length)f.push(`player-intel-copied-to-npc:${d.join(',')}`);return f}
  },
  {
    id:'limited_disclosure_stays_limited',
    entries:['04｜输出协议：隐藏状态、正文、终端','11｜第6天','44｜珈儿','91｜f7d_state字段与更新规则'],
    prompt:`${state({day:6,intel_flags:{chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true,first_chimera_incident_known:true,zero_identity_known:false}})}\n我只告诉珈儿三件事：“赛哈姆发生了活骸化；活骸失控会很危险；中央庭以前尝试挽救过活骸但失败了。”除此之外我什么都没说。珈儿消化这三件事并回应，可以追问，但不能自行补齐更深历史。`,
    check(out){const v=visible(out),f=[...stateFailures(out)];if(!/活骸/.test(v))f.push('missing-basic-disclosure');if(deepLeak(v))f.push('limited-disclosure-depth-leap');if(inevitabilityClaim(v))f.push('invented-inevitability');const k=parseState(out)?.npc_intel?.['珈儿']||{};for(const x of ['chimera_exists','chimera_danger','chimera_rescue_attempt_failed'])if(k?.[x]!==true)f.push(`missing-npc-intel:${x}`);const d=deepNpcIntel(out);if(d.length)f.push(`limited-disclosure-deep-npc-intel:${d.join(',')}`);return f}
  },
  {
    id:'kaji_does_not_self_diagnose_chimera_signs',
    entries:['04｜输出协议：隐藏状态、正文、终端','44｜珈儿','91｜f7d_state字段与更新规则'],
    prompt:`${state()}\n战斗后珈儿有些疲惫，我问：“你刚才幻力不稳，这是不是活骸化的前兆？” 没有人给她讲过活骸征兆或诊断标准。让她只基于自己真正知道的事回答，不要把普通疲惫擅自定性成活骸征兆。`,
    check(out){const v=visible(out),f=[...stateFailures(out)];if(!uncertainty(v))f.push('missing-diagnostic-uncertainty');if(confidentDiagnosis(v))f.push('invented-chimera-diagnosis');if(deepLeak(v))f.push('deep-secret-leak');const d=deepNpcIntel(out);if(d.length)f.push(`invented-deep-npc-intel:${d.join(',')}`);return f}
  }
];

async function runCase(target,c,sys){
  const modes=[...new Set([target.mode,target.mode==='plain'?'thinking-disabled':'plain'])];
  const attempts=[];
  for(const mode of modes){let status=0,out='',error=null;try{const r=await call(target.model,mode,[{role:'system',content:sys},{role:'user',content:c.prompt}],1200,60000);status=r.status;const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};out=contentOf(d);if(!r.ok)error=`http-${r.status}:${t.slice(0,300)}`}catch(e){error=e?.name==='AbortError'?'provider-timeout-60s':String(e?.message||e)}attempts.push({mode,status,out,error});if(status===200&&out.length>80)return{...attempts.at(-1),attempts,providerIssue:null};await sleep(200)}
  const best=attempts.find(a=>a.out.length)||attempts.at(-1)||{mode:target.mode,status:0,out:'',error:'no-attempt'};
  const providerIssue=best.status!==200?(best.error?.startsWith('provider-timeout')?best.error:`provider-error:${best.error||best.status}`):'provider-empty-content';
  return {...best,attempts,providerIssue};
}

const esc=s=>String(s).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');
const {ids,targets}=await chooseTargets();
const results=[];
console.log(JSON.stringify({availableModelCount:ids.length,targets,hash:compactSha256}));
for(const target of targets){for(const c of cases){const rel=c.entries.map(n=>BOOK[n]).filter(Boolean).join('\n\n');const sys=`${BASE}\n\n【本测试相关条目】\n${rel}\n\n严格执行NPC知识来源门禁与npc_intel账本。玩家知道不等于珈儿知道；珈儿是刚成为神器使不久的新人，不要展示内部规则。`;const rr=await runCase(target,c,sys);const fail=rr.providerIssue?[rr.providerIssue]:c.check(rr.out);const pass=!rr.providerIssue&&rr.status===200&&rr.out.length>80&&fail.length===0;results.push({model:target.model,kind:target.kind,id:c.id,status:rr.status,mode:rr.mode,pass,fail,out:rr.out,error:rr.error,attempts:rr.attempts.map(a=>({mode:a.mode,status:a.status,length:a.out.length,error:a.error}))});console.log(JSON.stringify({model:target.model,id:c.id,status:rr.status,pass,fail}));if(!pass)console.error(`::error title=v0422 ${esc(target.model)} / ${esc(c.id)}::status=${rr.status}; fail=${esc(fail.join('; '))}; excerpt=${esc(visible(rr.out).slice(0,1400))}`);await sleep(300)}}
const failed=results.filter(x=>!x.pass),providerFailures=failed.filter(x=>x.fail.some(y=>y.startsWith('provider-'))),behaviorFailures=failed.filter(x=>!x.fail.some(y=>y.startsWith('provider-')));
const summary={version:card.data.character_version,hash:compactSha256,targets,total:results.length,passed:results.filter(x=>x.pass).length,providerFailures:providerFailures.map(x=>`${x.model}:${x.id}`),behaviorFailures:behaviorFailures.map(x=>`${x.model}:${x.id}`),failed:failed.map(x=>`${x.model}:${x.id}`)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.22 NPC knowledge provenance regression','',`- targets: ${targets.map(x=>`${x.model} (${x.kind})`).join(', ')}`,`- pass: ${summary.passed}/${summary.total}`,`- provider failures: ${summary.providerFailures.join(', ')||'none'}`,`- behavior failures: ${summary.behaviorFailures.join(', ')||'none'}`,...results.flatMap(x=>['',`## ${x.model} / ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));
if(behaviorFailures.length)throw new Error(`v0422 NPC knowledge behavior regression failed: ${summary.behaviorFailures.join(', ')}`);
if(!results.some(x=>x.kind==='fallback'&&x.pass))throw new Error('v0422 NPC knowledge has no usable passing fallback model result');
