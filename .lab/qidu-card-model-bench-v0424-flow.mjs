import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduCgCandidate, entryMap } from './qidu-card-v0424-cg-candidate.mjs';

const KEY=process.env.MODEL_API_KEY||'';
if(!KEY) throw new Error('model API key missing');
const API_BASE=process.env.MODEL_API_BASE||'https://gcli.ggchan.dev/v1';
const API=`${API_BASE}/chat/completions`;
const MODEL=process.env.RELEASE_MODEL||'gemini-3-flash-preview';
const OUT=process.env.LAB_OUT_FLOW||'bench-evidence/qidu-card-v0424-narrative-flow';
await fs.mkdir(OUT,{recursive:true});

const {card,compactSha256}=await loadQiduCgCandidate(process.env.GITHUB_WORKSPACE||process.cwd());
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const related=['04｜输出协议：隐藏状态、正文、终端','10｜第7天：苏醒与高校主线','11｜第6天','30｜高校学园：六巡查与黑核','91｜f7d_state字段与更新规则']
  .map(n=>BOOK[n]).filter(Boolean).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt,related].filter(Boolean).join('\n\n');

const initialMatch=String(card.data.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
if(!initialMatch) throw new Error('initial state missing');
const seed=JSON.parse(initialMatch[1]);
seed.cg_system.shown.ann_first_meet=true;

const clone=x=>JSON.parse(JSON.stringify(x));
function state(patch={}){
  const s=clone(seed);
  const merge=(a,b)=>{for(const [k,v] of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};
  merge(s,patch);
  return `<f7d_state>${JSON.stringify(s)}</f7d_state>`;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const contentOf=d=>{const c=d?.choices?.[0]?.message?.content;if(Array.isArray(c))return c.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('');return String(c||'')};
async function call(prompt){
  for(let n=1;n<=2;n++){
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),100000);
    try{
      const r=await fetch(API,{method:'POST',signal:ctl.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,temperature:.15,top_p:.9,max_tokens:3200,thinking:{type:'disabled'},messages:[{role:'system',content:`${BASE}\n\n严格执行最新“剧情流速推进与日结”规则。不要解释测试。`},{role:'user',content:prompt}]})});
      const text=await r.text();
      if(r.status===200)return{status:r.status,text,error:null};
      if(n===2)return{status:r.status,text,error:null};
    }catch(e){if(n===2)return{status:0,text:'',error:String(e?.message||e)}}finally{clearTimeout(timer)}
    await sleep(12000);
  }
}
function parseState(out){
  const m=String(out).match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
  if(!m)return null;
  try{return JSON.parse(m[1])}catch{return null}
}
function oldCountersRemain(s,out){
  if(!s)return true;
  if(Object.prototype.hasOwnProperty.call(s,'node_used'))return true;
  if(Object.values(s.regions||{}).some(r=>r&&Object.prototype.hasOwnProperty.call(r,'patrol')))return true;
  const vis=String(out).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
  return /行动节点\s*\d*\s*\/\s*12|巡查次数\s*[:：]?\s*\d+/i.test(vis);
}

const baseRegion={liberated:false,build_steps:[]};
const cases=[
  {
    id:'region_story_completion_auto_liberates_without_core',
    prompt:`${state({day:7,day_ready_to_sleep:false,node_used:11,location:'高校学园',regions:{school:{...baseRegion,patrol:5}},cores:{school:'available'},tasks:{SCHOOL_RESCUE:{status:'active',objective:'解放高校学园'}}})}
高校学园的区域主线已经演到最后：最终威胁被处理，救援目标完成，没有剩余必演的高校主线。我没有说要净化黑核。请自然收束这个区域。`,
    check:(s,out,fail)=>{
      if(s?.regions?.school?.liberated!==true)fail.push('school-not-liberated');
      if(s?.cores?.school!=='available')fail.push('core-changed-without-explicit-purify');
      if(s?.day!==7)fail.push('day-changed-on-region-completion');
      if(oldCountersRemain(s,out))fail.push('legacy-counter-remains');
    }
  },
  {
    id:'core_mention_does_not_purify',
    prompt:`${state({day:7,day_ready_to_sleep:false,location:'高校学园',regions:{school:{liberated:true,build_steps:[]}},cores:{school:'available'}})}
我看向高校学园的黑核，问安：“这个黑核现在是什么情况？”我只是问情况，没有说净化。`,
    check:(s,out,fail)=>{
      if(s?.cores?.school!=='available')fail.push('core-purified-by-mention');
      if(oldCountersRemain(s,out))fail.push('legacy-counter-remains');
    }
  },
  {
    id:'explicit_core_purification_changes_core',
    prompt:`${state({day:7,day_ready_to_sleep:false,location:'高校学园',regions:{school:{liberated:true,build_steps:[]}},cores:{school:'available'}})}
“现在去净化高校学园的黑核。”我明确执行净化，当前没有缺失的前置条件。请演出并结算。`,
    check:(s,out,fail)=>{
      if(s?.cores?.school!=='purified')fail.push('explicit-purify-not-committed');
      if(oldCountersRemain(s,out))fail.push('legacy-counter-remains');
    }
  },
  {
    id:'stolen_core_cannot_be_reclaimed_or_purified',
    prompt:`${state({day:5,day_ready_to_sleep:false,location:'港湾区',route_flags:{harbor_core_stolen:true},regions:{harbor:{liberated:true,build_steps:[]}},cores:{harbor:'stolen'}})}
“去把被希罗抢走的港湾区黑核夺回来，然后直接净化。”我明确尝试追回并净化已经被夺走的黑核。`,
    check:(s,out,fail)=>{
      if(s?.cores?.harbor!=='stolen')fail.push('stolen-core-mutated');
      if(s?.route_flags?.harbor_core_stolen!==true)fail.push('stolen-route-flag-mutated');
      const vis=String(out).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
      if(!/无法|不能|已经.{0,12}(?:被夺走|不在)|夺走/.test(vis))fail.push('stolen-core-refusal-missing');
      if(oldCountersRemain(s,out))fail.push('legacy-counter-remains');
    }
  },
  {
    id:'ann_route_available_core_is_optional_world_state_only',
    prompt:`${state({day:2,day_ready_to_sleep:false,route:'ann',ann:{eligible:true,chased:true,recovered:true,deadline_checked:true,deadline_passed:true},regions:{school:{liberated:true,build_steps:[]}},cores:{school:'available',harbor:'stolen'}})}
我已经在安线。高校学园黑核还没有净化，港湾区黑核已经被希罗抢走。我现在不打算净化高校黑核，只想继续和安走。`,
    check:(s,out,fail)=>{
      if(s?.route!=='ann')fail.push('ann-route-changed-by-core-state');
      if(s?.ann?.recovered!==true)fail.push('ann-recovered-changed-by-core-state');
      if(s?.cores?.school!=='available')fail.push('available-core-auto-purified-on-ann-route');
      if(s?.cores?.harbor!=='stolen')fail.push('stolen-core-changed-on-ann-route');
      if(oldCountersRemain(s,out))fail.push('legacy-counter-remains');
    }
  },
  {
    id:'ann_route_can_voluntarily_purify_available_core_without_route_change',
    prompt:`${state({day:2,day_ready_to_sleep:false,route:'ann',ann:{eligible:true,chased:true,recovered:true,deadline_checked:true,deadline_passed:true},regions:{school:{liberated:true,build_steps:[]}},cores:{school:'available',harbor:'stolen'}})}
我已经在安线。“顺路把高校学园这个还没净化的黑核净化掉吧。”当前净化前置都满足，然后继续和安走。`,
    check:(s,out,fail)=>{
      if(s?.route!=='ann')fail.push('ann-route-changed-after-voluntary-purify');
      if(s?.ann?.recovered!==true)fail.push('ann-recovered-changed-after-voluntary-purify');
      if(s?.cores?.school!=='purified')fail.push('ann-route-voluntary-purify-not-committed');
      if(s?.cores?.harbor!=='stolen')fail.push('stolen-core-changed-after-other-purify');
      if(oldCountersRemain(s,out))fail.push('legacy-counter-remains');
    }
  },
  {
    id:'sleep_after_day_close_advances_once_and_opens_with_small_god',
    prompt:`${state({day:7,day_ready_to_sleep:true,location:'中央庭'})}
今天的主要剧情已经收束。我和安说晚安，想和她在走廊再聊几句，然后回房睡觉，把今天结束。按我的要求先写睡前这段，再进入第二天。`,
    check:(s,out,fail)=>{
      const vis=String(out).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
      if(s?.day!==6)fail.push('day-did-not-advance-exactly-once');
      if(s?.day_ready_to_sleep!==false)fail.push('day-ready-not-reset');
      if(!/(?:小神|(?:梦境|虚幻|空灵|无法辨认).{0,40}(?:声音|低语|话语)|(?:声音|低语).{0,40}(?:终于来了|轮回|终焉|希望|这一次))/.test(vis))fail.push('small-god-monologue-missing');
      if(!/晚安|走廊|安/.test(vis))fail.push('requested-bedtime-scene-skipped');
      if(oldCountersRemain(s,out))fail.push('legacy-counter-remains');
    }
  },
  {
    id:'short_rest_before_day_close_does_not_advance_day',
    prompt:`${state({day:7,day_ready_to_sleep:false,location:'高校学园'})}
我有点累，靠着墙闭眼休息十分钟，缓一缓再继续。不是结束今天，也不是睡到明天。`,
    check:(s,out,fail)=>{
      const vis=String(out).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
      if(s?.day!==7)fail.push('short-rest-advanced-day');
      if(/第二天|第6天|小神.{0,20}(自语|声音|低声)/.test(vis))fail.push('premature-next-day-scene');
      if(oldCountersRemain(s,out))fail.push('legacy-counter-remains');
    }
  }
];

const results=[];
for(const tc of cases){
  const r=await call(tc.prompt);
  let d={};try{d=JSON.parse(r.text)}catch{}
  const out=contentOf(d),s=parseState(out),fail=[];
  if(r.status!==200)fail.push(`status:${r.status}`);
  if(!s)fail.push('state-missing-or-invalid');
  if(!/<f7d_terminal>[\s\S]*?<\/f7d_terminal>/i.test(out))fail.push('terminal-missing');
  tc.check(s,out,fail);
  const pass=fail.length===0;
  results.push({id:tc.id,status:r.status,pass,fail,state:s,out,error:r.error});
  console.log(JSON.stringify({id:tc.id,status:r.status,pass,fail}));
  await sleep(12000);
}

const summary={version:card.data.character_version,hash:compactSha256,model:MODEL,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.24 narrative-flow regression','',`- model: ${MODEL}`,`- hash: ${compactSha256}`,`- pass: ${summary.passed}/${summary.total}`,...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','\`\`\`text',x.out,'\`\`\`'])].join('\n'));
if(summary.failed.length)throw new Error(`narrative-flow regression failed: ${summary.failed.join(', ')}`);
