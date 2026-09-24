import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduCgCandidate, entryMap } from './qidu-card-v0424-cg-candidate.mjs';

const KEY=process.env.MODEL_API_KEY||'';
if(!KEY) throw new Error('model API key missing');
const API_BASE=process.env.MODEL_API_BASE||'https://gcli.ggchan.dev/v1';
const API=`${API_BASE}/chat/completions`;
const MODEL=process.env.RELEASE_MODEL||'gemini-3-flash-preview';
const OUT=process.env.LAB_OUT_DEADLINE||'bench-evidence/qidu-card-v0424-deadlines';
await fs.mkdir(OUT,{recursive:true});

const {card,compactSha256}=await loadQiduCgCandidate(process.env.GITHUB_WORKSPACE||process.cwd());
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt,BOOK['04｜输出协议：隐藏状态、正文、终端'],BOOK['91｜f7d_state字段与更新规则']].filter(Boolean).join('\n\n');
const m=String(card.data.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
if(!m) throw new Error('initial state missing');
const seed=JSON.parse(m[1]);
const clone=x=>JSON.parse(JSON.stringify(x));
const merge=(a,b)=>{for(const [k,v] of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};
const state=patch=>{const s=clone(seed);delete s.node_used;for(const r of Object.values(s.regions||{})){if(r&&typeof r==='object')delete r.patrol}merge(s,patch);return `<f7d_state>${JSON.stringify(s)}</f7d_state>`};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const contentOf=d=>{const c=d?.choices?.[0]?.message?.content;if(Array.isArray(c))return c.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('');return String(c||'')};
async function call(prompt){
  for(let n=1;n<=2;n++){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),100000);
    try{
      const r=await fetch(API,{method:'POST',signal:ctl.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,temperature:.1,top_p:.9,max_tokens:3200,thinking:{type:'disabled'},messages:[{role:'system',content:`${BASE}\n\n严格执行限时剧情按天硬截止与日结规则，不解释测试。`},{role:'user',content:prompt}]})});
      const text=await r.text();if(r.status===200)return{status:r.status,text,error:null};if(n===2)return{status:r.status,text,error:null};
    }catch(e){if(n===2)return{status:0,text:'',error:String(e?.message||e)}}finally{clearTimeout(timer)}
    await sleep(12000);
  }
}
const parse=out=>{const m=String(out).match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);if(!m)return null;try{return JSON.parse(m[1])}catch{return null}};
const visible=out=>String(out).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
const hasSmallGodBeat=v=>/小神/.test(v)||/(梦境|梦中|虚空|意识|脑海|虚幻).{0,100}(低语|声音|自语|叹息|话音)/s.test(v);
const hasAnnDeparture=v=>/安.{0,120}(离开|离职|不见了|不见踪影|已经不在)|(?:离开|不见了|不见踪影|已经不在).{0,120}安/s.test(v);
const hasSmallGodRescue=v=>/(小神|虚幻|神秘|无法辨认|那道声音|空灵|稚嫩|声音|某种力量|奇异.{0,8}力量|一只手).{0,260}(拽回|拉回|扯回|救回|从.{0,30}(濒死|死亡|意识))/s.test(v)||/(拽回|拉回|扯回|救回).{0,140}(濒死|死亡|意识|现实|边缘)/s.test(v);

const cases=[
  {
    id:'ann_deadline_fail_day4_to3',
    prompt:`${state({day:4,day_ready_to_sleep:true,ann:{affection:80,core_events:['ANN_CORE_30','ANN_CORE_60'],eligible:false,chased:null,recovered:false,deadline_checked:false,deadline_passed:null},route_flags:{ann_route_closed:false,harbor_core_stolen:false},hiro:{intel:4,handled:[]}})}
今天已经收束。我明确回房睡到明天，不补任何安线事件。`,
    check:(s,v,f)=>{if(s?.day!==3)f.push('day-not-3');if(s?.ann?.deadline_checked!==true)f.push('deadline-not-checked');if(s?.ann?.deadline_passed!==false)f.push('deadline-not-failed');if(s?.ann?.eligible!==false)f.push('ann-eligible-wrong');if(s?.route_flags?.ann_route_closed!==true)f.push('ann-route-not-closed');if(s?.route==='ann')f.push('failed-deadline-entered-ann-route');if(!hasSmallGodBeat(v))f.push('small-god-beat-missing');if(!hasAnnDeparture(v))f.push('ann-departure-missing')}
  },
  {
    id:'ann_deadline_pass_day4_to3',
    prompt:`${state({day:4,day_ready_to_sleep:true,ann:{affection:100,core_events:['ANN_CORE_30','ANN_CORE_60','ANN_CORE_80'],eligible:false,chased:null,recovered:false,deadline_checked:false,deadline_passed:null},route_flags:{ann_route_closed:false,harbor_core_stolen:false},hiro:{intel:4,handled:[]}})}
今天已经收束。我明确回房睡到明天。不要替我决定第3天追不追安。`,
    check:(s,v,f)=>{if(s?.day!==3)f.push('day-not-3');if(s?.ann?.deadline_checked!==true)f.push('deadline-not-checked');if(s?.ann?.deadline_passed!==true)f.push('deadline-not-passed');if(s?.ann?.eligible!==true)f.push('ann-not-eligible');if(s?.route_flags?.ann_route_closed===true)f.push('ann-route-wrongly-closed');if(s?.route==='ann')f.push('route-entered-before-chase');if(s?.ann?.chased!==null)f.push('chase-auto-decided');if(!hasAnnDeparture(v))f.push('ann-departure-missing')}
  },
  {
    id:'ann_failed_chase_is_day3_plot_not_ending',
    prompt:`${state({day:3,day_ready_to_sleep:false,route:'central',ann:{affection:80,core_events:['ANN_CORE_30','ANN_CORE_60'],eligible:false,chased:null,recovered:false,deadline_checked:true,deadline_passed:false},route_flags:{ann_route_closed:true,harbor_core_stolen:false},meta:{endings:[]}})}
安已经离开了。我还是追上去，不接受她就这么走。`,
    check:(s,v,f)=>{if(s?.ann?.chased!==true)f.push('failed-chase-not-recorded');if(s?.ann?.recovered!==false)f.push('failed-chase-recovered');if(s?.route==='ann')f.push('failed-chase-entered-ann-route');if(Array.isArray(s?.meta?.endings)&&s.meta.endings.length)f.push('failed-chase-wrote-ending');if(!/(刺|捅|刀|匕首)/.test(v))f.push('ann-stab-scene-missing');if(!/(濒死|重伤|致命|失去意识|意识.{0,8}(模糊|涣散|断开))/.test(v))f.push('near-death-scene-missing');if(!hasSmallGodRescue(v))f.push('small-god-rescue-missing');if(s?.tasks?.CHASE_ANN?.status==='active')f.push('failed-chase-left-active-task');if(/《(?:牺牲的意义|箱庭风景|终结|两个人的旅途|永恒的终焉)》/.test(v))f.push('failed-chase-misclassified-as-ending');if(/<f7d_cg\s+key=["']cg_ending_/i.test(v))f.push('failed-chase-ending-cg-fired')}
  },
  {
    id:'harbor_core_stolen_on_low_intel',
    prompt:`${state({day:4,day_ready_to_sleep:true,ann:{affection:100,core_events:['ANN_CORE_30','ANN_CORE_60','ANN_CORE_80'],eligible:true,chased:null,recovered:false,deadline_checked:false,deadline_passed:null},route_flags:{ann_route_closed:false,harbor_core_stolen:false},hiro:{intel:3,handled:[]},cores:{harbor:'available'}})}
今天已经收束。我明确睡到明天。`,
    check:(s,v,f)=>{if(s?.route_flags?.harbor_core_stolen!==true)f.push('harbor-stolen-flag-missing');if(s?.cores?.harbor!=='stolen')f.push('harbor-core-not-stolen')}
  },
  {
    id:'late_ann_progress_cannot_backdate',
    prompt:`${state({day:3,day_ready_to_sleep:false,ann:{affection:100,core_events:['a','b','c'],deadline_checked:false,deadline_passed:null},route_flags:{ann_route_closed:false,harbor_core_stolen:false}})}
现在已经是第3天。我刚刚把安的好感和三段事件补满，问能不能算赶上安线。`,
    check:(s,v,f)=>{if(s?.ann?.deadline_checked!==true||s?.ann?.deadline_passed!==false||s?.ann?.eligible!==false)f.push('late-progress-backdated');if(s?.route_flags?.ann_route_closed!==true)f.push('late-ann-route-not-closed');if(s?.route==='ann')f.push('late-progress-entered-ann-route')}
  }
];

const results=[];
for(const tc of cases){
  const r=await call(tc.prompt);let d={};try{d=JSON.parse(r.text)}catch{}
  const out=contentOf(d),s=parse(out),v=visible(out),fail=[];
  if(r.status!==200)fail.push(`status:${r.status}`);
  if(!s)fail.push('state-missing');
  if(s)tc.check(s,v,fail);
  if(!/<f7d_terminal>[\s\S]*?<\/f7d_terminal>/i.test(out))fail.push('terminal-missing');
  const pass=fail.length===0;
  results.push({id:tc.id,status:r.status,pass,fail,state:s,out,error:r.error});
  console.log(JSON.stringify({id:tc.id,status:r.status,pass,fail}));
  await sleep(12000);
}
const summary={version:card.data.character_version,hash:compactSha256,model:MODEL,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.24 hard deadline regression','',`- model: ${MODEL}`,`- hash: ${compactSha256}`,`- pass: ${summary.passed}/${summary.total}`,...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','\`\`\`text',x.out,'\`\`\`'])].join('\n'));
if(summary.failed.length)throw new Error(`deadline regression failed: ${summary.failed.join(', ')}`);
