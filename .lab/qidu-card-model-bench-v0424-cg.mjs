import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduCgCandidate } from './qidu-card-v0424-cg-candidate.mjs';

const KEY=process.env.MODEL_API_KEY||process.env.YOUZI_KEY||'';
if(!KEY) throw new Error('model API key missing');
const API_BASE=process.env.MODEL_API_BASE||'https://youzi.today/v1';
const API=`${API_BASE}/chat/completions`;
const OUT=process.env.LAB_OUT_CG_MODEL||'bench-evidence/qidu-card-v0424-cg-model';
await fs.mkdir(OUT,{recursive:true});

const {card,compactSha256}=await loadQiduCgCandidate(process.env.GITHUB_WORKSPACE||process.cwd());
const entries=card.data.character_book?.entries||[];
const by=p=>entries.find(e=>String(e.name||'').startsWith(p))?.content||'';
const constants=entries.filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[
  card.data.personality,
  card.data.scenario,
  constants,
  by('04｜'),
  by('10｜'),
  by('17｜'),
  by('18｜'),
  by('91｜'),
  card.data.post_history_instructions,
  card.data.extensions?.depth_prompt?.prompt
].filter(Boolean).join('\n\n');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(model,mode,messages,max_tokens=Number(process.env.CG_MAX_TOKENS||1200),timeoutMs=Number(process.env.CG_TIMEOUT_MS||45000)){
  const p={model,temperature:.10,top_p:.9,max_tokens,messages};
  if(mode==='thinking-disabled')p.thinking={type:'disabled'};
  const attempts=Math.max(1,Number(process.env.CG_ATTEMPTS||4));
  let lastError=null;
  for(let attempt=0;attempt<attempts;attempt++){
    const controller=new AbortController();
    const t=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const r=await fetch(API,{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)});
      if([429,500,502,503,504].includes(r.status)&&attempt<attempts-1){
        const probeText=await r.clone().text().catch(()=> '');
        const hardQuota=r.status===429&&/(INFERENCE_CAP_ERROR|Daily free limit reached|daily.*limit|quota.*exhaust)/i.test(probeText);
        if(hardQuota){
          if(attempt===0){
            const waitMs=5000;
            await r.text().catch(()=>{});
            console.log(JSON.stringify({provider_hard_quota_retry:true,status:r.status,attempt:attempt+1,wait_ms:waitMs}));
            await sleep(waitMs);
            continue;
          }
          console.log(JSON.stringify({provider_hard_quota:true,status:r.status,attempt:attempt+1}));
          return r;
        }
        const retryAfter=Number(r.headers.get('retry-after')||0);
        const waitMs=retryAfter>0?retryAfter*1000:(r.status===429?12000*(attempt+1):3500*(attempt+1));
        await r.text();
        console.log(JSON.stringify({provider_retry:true,status:r.status,attempt:attempt+1,wait_ms:waitMs}));
        await sleep(waitMs);
        continue;
      }
      return r;
    }catch(e){
      lastError=e;
      if(e?.name==='AbortError'&&attempt<attempts-1){
        const waitMs=7000*(attempt+1);
        console.log(JSON.stringify({provider_retry:true,status:'timeout',attempt:attempt+1,wait_ms:waitMs}));
        await sleep(waitMs);
        continue;
      }
      throw e;
    }finally{clearTimeout(t)}
  }
  throw lastError||new Error('provider retries exhausted');
}
const contentOf=d=>{
  const c=d?.choices?.[0]?.message?.content;
  if(Array.isArray(c))return c.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('');
  return String(c||'');
};
async function chooseModel(exclude=[]){
  let ids=[];
  try{
    const r=await fetch(`${API_BASE}/models`,{headers:{Authorization:`Bearer ${KEY}`}});
    const d=await r.json();
    ids=(d?.data||d?.models||[]).map(x=>typeof x==='string'?x:(x?.id||x?.name||x?.model)).filter(Boolean);
  }catch{}
  const requested=process.env.CG_MODEL||process.env.GLM_MODEL||'deepseek/deepseek-v4.1-flash';
  const pref=[requested,'deepseek/deepseek-v4.1-flash','[amd]DeepSeek-V4.1-Flash','[iao]deepseek-ai/DeepSeek-V4-Flash-0731','[ox]deepseek-ai/DeepSeek-V4-Flash-0731','zai/glm-5.3-flash','[amd]GLM-5.3-Flash','[iao]zai-org/GLM-5.3-Flash','[ox]zai-org/GLM-5.3-Flash',...ids.filter(x=>/(deepseek|glm|qwen)/i.test(x))];
  for(const m of [...new Set(pref.filter(x=>(!ids.length||ids.includes(x))&&!exclude.includes(x)))].slice(0,20)){
    for(const mode of ['thinking-disabled','plain']){
      try{
        const r=await call(m,mode,[{role:'system',content:'只输出中文。'},{role:'user',content:'只写：收到'}],80,22000);
        const text=await r.text();let d={};try{d=JSON.parse(text)}catch{}
        if(r.ok&&contentOf(d).length>=2)return{m,mode};
      }catch{}
    }
  }
  throw new Error('no usable model');
}

function state(overrides={}){
  const s={
    schema:'f7d_textloop_0.4',loop:1,day:7,node_used:0,route:'central',location:'中央庭病房',
    regions:{court:{patrol:0,liberated:true,build_steps:[]},school:{patrol:0,liberated:false,build_steps:[]},east:{patrol:0,liberated:false,build_steps:[]},central:{patrol:0,liberated:false,build_steps:[]},institute:{patrol:0,liberated:false,build_steps:[]},seaside:{patrol:0,liberated:false,build_steps:[]},old:{patrol:0,liberated:false,build_steps:[]},harbor:{patrol:0,liberated:false,build_steps:[]}},
    cores:{court:'unknown',school:'unknown',east:'unknown',central:'unknown',institute:'unknown',seaside:'unknown',old:'unknown',harbor:'unknown'},
    tasks:{},known:[],relationships:{},
    ann:{affection:0,core_events:[],camera:false,eligible:false,chased:null,recovered:false},
    hiro:{intel:0,handled:[]},route_flags:{},artifact_view:null,antoneva_choice:null,ann_release:null,
    battle_flags:{sybilla_condition_obtained:false,sybilla_rescued:null},
    intel_flags:{countdown_visible_to_user:true,countdown_meaning_known:false,city_blackgate_history_known:false,central_court_basics_known:false,hiro_founder_known:false,hiro_prior_commander_known:false,chimera_exists_known:false,hiro_chimera_research_known:false,antoneva_chimera_policy_known:false,first_chimera_incident_known:false,zero_identity_known:false,ann_origin_known:false,loop_truth_known:false},
    npc_intel:{},
    player_profile:{gender:'unknown'},
    cg_system:{enabled:true,mode:'direct_only',album_enabled:false,responsive_enabled:true,shown:{ann_first_meet:false,antoneva_first_meet:false,ending_journey:false,ending_eternal_end:false,ending_sacrifice_male:false,ending_sacrifice_female:false,ending_final_male:false,ending_final_female:false,ending_box_male:false,ending_box_female:false}},
    meta:{cg:[],endings:[]}
  };
  const merge=(a,b)=>{for(const[k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};
  return `<f7d_state>${JSON.stringify(merge(s,overrides))}</f7d_state>`;
}
function parseState(out){
  const m=String(out).match(/^\s*<f7d_state>([\s\S]*?)<\/f7d_state>/i);
  if(!m)return null;
  try{return JSON.parse(m[1])}catch{return null}
}
const tagFor=k=>new RegExp(`<\\s*f7d_cg\\s+key=["']${k}["']\\s*>\\s*<\\s*\\/\\s*f7d_cg\\s*>`,'i');
const anyGendered=/<\s*f7d_cg\s+key=["']cg_ending_(?:sacrifice|final|box)_(?:male|female)["']/i;
const flagFor=k=>k.replace(/^cg_/,'');
function positiveCheck(expected,forbidden=[]){
  return out=>{
    const f=[];const s=parseState(out);
    if(!s)f.push('state-missing-or-invalid');
    if(!tagFor(expected).test(out))f.push(`missing-cg:${expected}`);
    for(const k of forbidden)if(tagFor(k).test(out))f.push(`wrong-cg:${k}`);
    if(s?.cg_system?.shown?.[flagFor(expected)]!==true)f.push(`shown-not-true:${flagFor(expected)}`);
    if(Array.isArray(s?.meta?.cg)&&s.meta.cg.length)f.push('meta-cg-persistence');
    if(!/<\s*f7d_terminal\s*>/i.test(out))f.push('terminal-missing');
    if(/已加入相册|已保存到终端|已同步到小手机/.test(out))f.push('album-persistence-leak');
    return f;
  };
}
function negativeCheck(kind){
  return out=>{
    const f=[];const s=parseState(out);
    if(!s)f.push('state-missing-or-invalid');
    if(kind==='gender-unknown'){
      if(anyGendered.test(out))f.push('guessed-gender-cg');
      for(const k of ['ending_sacrifice_male','ending_sacrifice_female','ending_final_male','ending_final_female','ending_box_male','ending_box_female']) if(s?.cg_system?.shown?.[k]===true)f.push(`guessed-shown:${k}`);
    }
    if(kind==='repeat'&&tagFor('cg_ending_journey').test(out))f.push('repeated-cg');
    if(Array.isArray(s?.meta?.cg)&&s.meta.cg.length)f.push('meta-cg-persistence');
    if(/已加入相册|已保存到终端|已同步到小手机/.test(out))f.push('album-persistence-leak');
    return f;
  };
}

const allCases=[
  {id:'ann_first_meet',user:`${state()}\n我刚在病房醒来。只演到安确认我的状态并第一次自我介绍完成为止，不要继续去见其他中央庭成员。`,check:positiveCheck('cg_ann_first_meet',['cg_antoneva_first_meet'])},
  {id:'antoneva_first_meet',user:`${state({location:'中央庭',known:['安'],cg_system:{shown:{ann_first_meet:true}}})}\n安已经带我来到中央庭。现在是我第一次与安托涅瓦正式会面。只演到这次初见完成，不继续后面的主线。`,check:positiveCheck('cg_antoneva_first_meet',['cg_ann_first_meet'])},
  {id:'journey_ending',user:`${state({day:0,route:'ann',known:['安'],cg_system:{shown:{ann_first_meet:true}},meta:{endings:['两个人的旅途']}})}\n后台已完成结局判定：我明确选择跟安离开，当前进入《两个人的旅途》。不要重新判定条件，只演出结局收尾并按卡内规则触发CG。结局正文控制在700中文字以内，必须留出空间输出完整CG标签和终端。`,check:positiveCheck('cg_ending_journey')},
  {id:'eternal_ending',user:`${state({day:0,route:'ann',known:['安'],meta:{endings:['永恒的终焉']}})}\n后台已完成结局判定：我明确选择留下承担责任，当前进入《永恒的终焉》。不要重新判定条件，只演出结局收尾并按卡内规则触发CG。结局正文控制在700中文字以内，必须留出空间输出完整CG标签和终端。`,check:positiveCheck('cg_ending_eternal_end')},
  {id:'sacrifice_male',user:`${state({day:0,player_profile:{gender:'male'},artifact_view:'weapon',antoneva_choice:'help_release',ann_release:'released',meta:{endings:['牺牲的意义']}})}\n后台已完成结局判定，当前结局确定为《牺牲的意义》。我是男指挥使。不要重新判定结局，只完成收尾并触发正确CG。结局正文控制在700中文字以内，必须留出空间输出完整CG标签和终端。`,check:positiveCheck('cg_ending_sacrifice_male',['cg_ending_sacrifice_female'])},
  {id:'sacrifice_female',user:`${state({day:0,player_profile:{gender:'female'},artifact_view:'weapon',antoneva_choice:'help_release',ann_release:'released',meta:{endings:['牺牲的意义']}})}\n后台已完成结局判定，当前结局确定为《牺牲的意义》。我是女指挥使。不要重新判定结局，只完成收尾并触发正确CG。结局正文控制在700中文字以内，必须留出空间输出完整CG标签和终端。`,check:positiveCheck('cg_ending_sacrifice_female',['cg_ending_sacrifice_male'])},
  {id:'final_male',user:`${state({day:0,player_profile:{gender:'male'},meta:{endings:['终结']}})}\n后台已完成结局判定，当前结局确定为《终结》。我是男指挥使。不要重新判定结局，只完成收尾并触发正确CG。结局正文控制在700中文字以内，必须留出空间输出完整CG标签和终端。`,check:positiveCheck('cg_ending_final_male',['cg_ending_final_female'])},
  {id:'box_female',user:`${state({day:0,player_profile:{gender:'female'},meta:{endings:['箱庭风景']}})}\n后台已完成结局判定，当前结局确定为《箱庭风景》。我是女指挥使。不要重新判定结局，只完成收尾并触发正确CG。结局正文控制在700中文字以内，必须留出空间输出完整CG标签和终端。`,check:positiveCheck('cg_ending_box_female',['cg_ending_box_male'])},
  {id:'box_unknown_gender',user:`${state({day:0,player_profile:{gender:'unknown'},meta:{endings:['箱庭风景']}})}\n后台已完成结局判定，当前结局确定为《箱庭风景》，但我从未说明指挥使性别。完成收尾，但不要猜测性别。`,check:negativeCheck('gender-unknown')},
  {id:'journey_repeat_suppressed',user:`${state({day:0,route:'ann',known:['安'],cg_system:{shown:{ending_journey:true}},meta:{endings:['两个人的旅途']}})}\n《两个人的旅途》结局CG刚刚已经展示过。继续同一段结局余韵，不要重复展示刚才的CG。`,check:negativeCheck('repeat')}
];
const requestedCases=String(process.env.CG_CASES||'').split(',').map(x=>x.trim()).filter(Boolean);
const cases=requestedCases.length?allCases.filter(x=>requestedCases.includes(x.id)):allCases;
if(!cases.length) throw new Error('no CG behavior cases selected');

const {m,mode}=await chooseModel();
const results=[];
console.log(JSON.stringify({model:m,mode,version:card.data.character_version,hash:compactSha256,cases:cases.length}));
async function runOneCase(c,model,runMode){
  let status=0,out='',error=null,finish_reason=null,usage=null;
  try{
    const r=await call(model,runMode,[{role:'system',content:BASE},{role:'user',content:c.user}]);
    status=r.status;
    const t=await r.text();let d={};try{d=JSON.parse(t)}catch{}
    out=contentOf(d);
    finish_reason=d?.choices?.[0]?.finish_reason??null;
    usage=d?.usage??null;
  }catch(e){error=e?.name==='AbortError'?('provider-timeout-'+Number(process.env.CG_TIMEOUT_MS||45000)+'ms'):String(e?.message||e)}
  const failures=status===200&&out.length>60?c.check(out):[error||('provider-status-'+status)];
  return {id:c.id,model,mode:runMode,status,pass:status===200&&out.length>60&&failures.length===0,failures,out,error,finish_reason,usage};
}
for(const c of cases){
  let result=await runOneCase(c,m,mode);
  const tried=[m];
  while(!result.pass&&result.failures.length>0&&result.failures.every(x=>String(x).startsWith('provider-'))&&tried.length<5){
    try{
      const fallback=await chooseModel(tried);
      console.log(JSON.stringify({provider_case_fallback:true,id:c.id,from:result.model,to:fallback.m,mode:fallback.mode,attempt:tried.length}));
      tried.push(fallback.m);
      result=await runOneCase(c,fallback.m,fallback.mode);
      if(!result.pass&&result.failures.length>0&&!result.failures.every(x=>String(x).startsWith('provider-'))) break;
    }catch(e){
      console.log(JSON.stringify({provider_case_fallback:false,id:c.id,tried,error:String(e?.message||e)}));
      break;
    }
  }
  results.push({...result,triedModels:tried});
  console.log(JSON.stringify({id:result.id,model:result.model,mode:result.mode,status:result.status,pass:result.pass,failures:result.failures,triedModels:tried,finish_reason:result.finish_reason,usage:result.usage}));
  await sleep(Math.max(900,Number(process.env.CG_CASE_GAP_MS||10000)));
}
const failedResults=results.filter(x=>!x.pass);
const providerBlocked=failedResults.filter(x=>x.failures.length>0&&x.failures.every(y=>String(y).startsWith('provider-')));
const behaviorFailed=failedResults.filter(x=>!providerBlocked.includes(x));
const summary={
  version:card.data.character_version,hash:compactSha256,model:m,mode,modelsUsed:[...new Set(results.map(x=>x.model))],total:results.length,
  passed:results.filter(x=>x.pass).length,
  providerBlocked:providerBlocked.map(x=>x.id),
  behaviorFailed:behaviorFailed.map(x=>x.id),
  failed:failedResults.map(x=>x.id)
};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.24 CG model behavior','',`- pass: ${summary.passed}/${summary.total}`,`- model: ${summary.model}`,`- mode: ${summary.mode}`,`- hash: ${summary.hash}`,`- provider blocked: ${summary.providerBlocked.join(', ')||'none'}`,`- behavior failed: ${summary.behaviorFailed.join(', ')||'none'}`,...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`failures: ${x.failures.join(', ')||'none'}`,'```text',x.out,'```'])].join('\n'));
if(summary.behaviorFailed.length)throw new Error(`CG model behavior failed: ${summary.behaviorFailed.join(',')}`);
if(summary.providerBlocked.length)throw new Error(`CG provider inconclusive: ${summary.providerBlocked.join(',')}`);