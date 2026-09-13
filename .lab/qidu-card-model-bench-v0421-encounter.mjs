import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, entryMap } from './qidu-card-v0421-encounter-focus.mjs';

const KEY=process.env.YOUZI_KEY||'';
if(!KEY) throw new Error('YOUZI_KEY missing');
const API_BASE='https://youzi.today/v1';
const API=`${API_BASE}/chat/completions`;
const OUT=process.env.LAB_OUT_ENCOUNTER||'bench-evidence/qidu-card-v0421-encounter';
await fs.mkdir(OUT,{recursive:true});
const {card,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function call(model,mode,messages,max_tokens=1300,timeoutMs=60000){
  const p={model,temperature:.18,top_p:.9,max_tokens,messages};
  if(mode==='thinking-disabled') p.thinking={type:'disabled'};
  const c=new AbortController();
  const t=setTimeout(()=>c.abort(),timeoutMs);
  try{return await fetch(API,{method:'POST',signal:c.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)});}
  finally{clearTimeout(t)}
}
const contentOf=d=>{
  const c=d?.choices?.[0]?.message?.content;
  if(Array.isArray(c)) return c.map(x=>typeof x==='string'?x:(x?.text||'')).join('');
  return String(c||'');
};
async function getIds(){try{const r=await fetch(`${API_BASE}/models`,{headers:{Authorization:`Bearer ${KEY}`}});const d=await r.json();return(d?.data||[]).map(x=>x.id).filter(Boolean)}catch{return[]}}
async function usable(model){
  for(const mode of ['thinking-disabled','plain']){
    try{const r=await call(model,mode,[{role:'system',content:'只输出中文。'},{role:'user',content:'写一句话。'}],80,25000);const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};if(r.ok&&contentOf(d).length>2)return mode}catch{}
  }
  return null;
}
function isVisionVariant(id,version){return new RegExp(`${version.replace('.','\\.')}v(?:ision)?(?:$|[-_])`,'i').test(id)||/vision/i.test(id)}
async function chooseTargets(){
  const ids=await getIds();
  const exact=[];
  const m53=ids.filter(x=>/glm[^\n]*5\.3/i.test(x)).find(x=>!isVisionVariant(x,'5.3'));
  const m46=ids.filter(x=>/glm[^\n]*4\.6(?!\d)/i.test(x)).find(x=>!isVisionVariant(x,'4.6'));
  for(const m of [m53,m46]) if(m&&!exact.includes(m)) exact.push(m);
  const fallback=[process.env.GLM_MODEL,'[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash',...ids.filter(x=>/(qwen|step|glm)/i.test(x))].filter(Boolean);
  const wanted=[...new Set([...exact,...fallback])];
  const out=[];
  for(const m of wanted){
    const mode=await usable(m);
    if(mode){
      out.push({model:m,mode,kind:exact.includes(m)?'requested-glm':'fallback'});
      if(out.some(x=>x.kind==='requested-glm')&&out.some(x=>x.kind==='fallback'))break;
      if(out.length>=2&&!exact.length)break;
    }
  }
  if(!out.length) throw new Error('no usable model');
  return {ids,targets:out,exactRequested:exact};
}

function state(overrides={}){
  const s={schema:'f7d_textloop_0.4',loop:1,day:7,node_used:1,route:'central',location:'高校学园',regions:{school:{patrol:0,liberated:false,build_steps:[]}},cores:{court:'purified',school:'unknown'},known:['安','安托涅瓦','晏华','希罗'],relationships:{},route_flags:{},battle_flags:{sybilla_condition_obtained:false,sybilla_rescued:null},intel_flags:{countdown_visible_to_user:true,countdown_meaning_known:false},meta:{cg:[],endings:[]}};
  const merge=(a,b)=>{for(const[k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};
  return `<f7d_state>${JSON.stringify(merge(s,overrides))}</f7d_state>`;
}
const visible=x=>String(x).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
function stateBlocks(out){return [...String(out).matchAll(/<f7d_state>([\s\S]*?)<\/f7d_state>/gi)]}
function parseState(out){const bs=stateBlocks(out);if(bs.length!==1)return null;try{return JSON.parse(bs[0][1])}catch{return null}}
function stateFailures(out){const bs=stateBlocks(out),f=[];if(bs.length!==1)f.push(`state-block-count:${bs.length}`);else{try{JSON.parse(bs[0][1])}catch{f.push('state-invalid-json')}}return f}
function firstDialogueKajiIndex(v){
  const res=[];
  for(const re of [/“[^”\n]{0,80}珈儿[^”\n]{0,80}”/g,/「[^」\n]{0,80}珈儿[^」\n]{0,80}」/g,/^[^\n：:]{0,20}[：:][^\n]{0,80}珈儿/gm]) for(const m of v.matchAll(re)) res.push(m.index??-1);
  return res.filter(x=>x>=0).sort((a,b)=>a-b)[0]??-1;
}

const cases=[
  {
    id:'first_sighting_no_visual_autorecognition',
    entries:['04｜输出协议：隐藏状态、正文、终端','10｜第7天：苏醒与高校主线','30｜高校学园：六巡查与黑核','44｜珈儿','67｜泰丝拉','91｜f7d_state字段与更新规则'],
    prompt:`${state({regions:{school:{patrol:1,liberated:false,build_steps:[]}}})}\n这是高校第一次正面看见两名陌生少女的瞬间。求救信里虽然出现过“珈儿”这个名字，但当前只写目击镜头：眼前两人还没有开口，也没人叫过彼此名字，我也没有主动查看求救信或提问身份。只写到她们发现我们为止，停在任何自我介绍之前。`,
    check(out){const v=visible(out),f=[...stateFailures(out)];if(/珈儿|泰丝拉/.test(v))f.push('name-before-source');return f}
  },
  {
    id:'school_second_patrol_pair_and_intro_order',
    entries:['04｜输出协议：隐藏状态、正文、终端','10｜第7天：苏醒与高校主线','30｜高校学园：六巡查与黑核','44｜珈儿','67｜泰丝拉','91｜f7d_state字段与更新规则'],
    prompt:`${state({node_used:2,regions:{school:{patrol:1,liberated:false,build_steps:[]}}})}\n继续高校第2次巡查。两名少女必须都在现场。求救信里只有“珈儿”这个名字，没有照片。按现场身份链推进：先保持两人未命名；另一名少女先在对话里叫出“珈儿”；粉发持刀少女再确认自己是珈儿，并由珈儿介绍另一名少女是泰丝拉；随后开始组织幸存学生撤离。身份确认完成后，本轮状态known同时加入珈儿和泰丝拉。`,
    check(out){
      const v=visible(out),f=[...stateFailures(out)];
      const iK=v.indexOf('珈儿'),iT=v.indexOf('泰丝拉'),iCallK=firstDialogueKajiIndex(v);
      if(iK<0)f.push('kaji-missing');
      if(iT<0)f.push('tesla-missing');
      if(iT>=0&&(iCallK<0||iCallK>iT))f.push('tesla-before-kaji-dialogue-source');
      if(/(一眼.{0,8}(认出|确定)|看见.{0,12}就知道|粉发.{0,10}(就是|正是)).{0,12}珈儿/.test(v))f.push('kaji-autorecognized');
      const s=parseState(out),known=s?.known||[];
      if(!known.includes('珈儿')||!known.includes('泰丝拉'))f.push(`known-not-atomic:${JSON.stringify(known)}`);
      return f;
    }
  },
  {
    id:'tesla_continuity_after_intro',
    entries:['04｜输出协议：隐藏状态、正文、终端','10｜第7天：苏醒与高校主线','30｜高校学园：六巡查与黑核','44｜珈儿','67｜泰丝拉','91｜f7d_state字段与更新规则'],
    prompt:`${state({node_used:3,known:['安','安托涅瓦','晏华','希罗','珈儿','泰丝拉'],regions:{school:{patrol:2,liberated:false,build_steps:[]}}})}\n上一轮已经认识珈儿和泰丝拉，两人都在撤离现场。继续第3次巡查到强敌出现、珈儿为了保护众人受伤；泰丝拉不能无缘无故消失，必须有行动或明确去向。`,
    check(out){const v=visible(out),f=[...stateFailures(out)];if(!/珈儿/.test(v))f.push('kaji-missing');if(!/泰丝拉/.test(v))f.push('tesla-continuity-missing');return f}
  }
];

async function runCase(target,c,sys){
  const modes=[...new Set([target.mode,target.mode==='plain'?'thinking-disabled':'plain'])];
  const attempts=[];
  for(const mode of modes){
    let status=0,out='',error=null,finish=null;
    try{
      const r=await call(target.model,mode,[{role:'system',content:sys},{role:'user',content:c.prompt}],1300,60000);
      status=r.status;
      const t=await r.text();let d={};try{d=JSON.parse(t)}catch{}
      out=contentOf(d);finish=d?.choices?.[0]?.finish_reason||null;
      if(!r.ok)error=`http-${r.status}:${t.slice(0,500)}`;
    }catch(e){error=e?.name==='AbortError'?'provider-timeout-60s':String(e?.message||e)}
    attempts.push({mode,status,out,error,finish});
    if(status===200&&out.length>80) return {...attempts.at(-1),attempts,providerIssue:null};
    if(error?.startsWith('provider-timeout')) return {...attempts.at(-1),attempts,providerIssue:error};
    await sleep(250);
  }
  const best=attempts.find(a=>a.out.length)||attempts.at(-1)||{mode:target.mode,status:0,out:'',error:'no-attempt',finish:null};
  let providerIssue='provider-empty-content';
  if(best.status!==200) providerIssue=best.error?.startsWith('provider-timeout')?best.error:`provider-error:${best.error||`status-${best.status}`}`;
  return {...best,attempts,providerIssue};
}

const esc=s=>String(s).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');
const {ids,targets,exactRequested}=await chooseTargets();
const results=[];
console.log(JSON.stringify({availableModelCount:ids.length,targets,exactRequested,hash:compactSha256}));
for(const target of targets){
  for(const c of cases){
    const rel=c.entries.map(n=>BOOK[n]).filter(Boolean).join('\n\n');
    const sys=`${BASE}\n\n【本测试相关条目】\n${rel}\n\n严格执行当前轮回的识别门禁、高校姓名顺序、必出人物连续性、首次目击去标签与每轮状态提交；不要展示内部规则。`;
    const rr=await runCase(target,c,sys);
    const fail=rr.providerIssue?[rr.providerIssue]:c.check(rr.out);
    const pass=!rr.providerIssue&&rr.status===200&&rr.out.length>80&&fail.length===0;
    results.push({model:target.model,kind:target.kind,id:c.id,status:rr.status,mode:rr.mode,pass,fail,out:rr.out,error:rr.error,finish:rr.finish,attempts:rr.attempts.map(a=>({mode:a.mode,status:a.status,length:a.out.length,error:a.error,finish:a.finish}))});
    console.log(JSON.stringify({model:target.model,id:c.id,status:rr.status,mode:rr.mode,pass,fail}));
    if(!pass){const excerpt=visible(rr.out).slice(0,1600);console.error(`::error title=v0421 ${esc(target.model)} / ${esc(c.id)}::status=${rr.status}; fail=${esc(fail.join('; ')||'unknown')}; excerpt=${esc(excerpt)}`)}
    await sleep(350);
  }
}
const failed=results.filter(x=>!x.pass);
const providerFailures=failed.filter(x=>x.fail.some(y=>y.startsWith('provider-')));
const behaviorFailures=failed.filter(x=>!x.fail.some(y=>y.startsWith('provider-')));
const requestedGlmAvailable=targets.filter(x=>x.kind==='requested-glm').map(x=>x.model);
const requestedGlmInconclusive=[...new Set(providerFailures.filter(x=>x.kind==='requested-glm').map(x=>x.model))];
const summary={version:card.data.character_version,hash:compactSha256,targets,requestedGlmAvailable,requestedGlmInconclusive,total:results.length,passed:results.filter(x=>x.pass).length,providerFailures:providerFailures.map(x=>`${x.model}:${x.id}`),behaviorFailures:behaviorFailures.map(x=>`${x.model}:${x.id}`),failed:failed.map(x=>`${x.model}:${x.id}`)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.21 encounter regression','',`- targets: ${targets.map(x=>`${x.model} (${x.kind})`).join(', ')}`,`- pass: ${summary.passed}/${summary.total}`,`- requested GLM inconclusive: ${requestedGlmInconclusive.join(', ')||'none'}`,`- provider failures: ${summary.providerFailures.join(', ')||'none'}`,`- behavior failures: ${summary.behaviorFailures.join(', ')||'none'}`,...results.flatMap(x=>['',`## ${x.model} / ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));
if(behaviorFailures.length) throw new Error(`encounter behavior regression failed: ${summary.behaviorFailures.join(', ')}`);
if(!results.some(x=>x.pass)) throw new Error('encounter regression produced no usable passing model result');
