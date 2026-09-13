import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, entryMap } from './qidu-card-v0417-knowledge-gate.mjs';

const KEY=process.env.YOUZI_KEY||''; if(!KEY) throw new Error('YOUZI_KEY missing');
const API_BASE='https://youzi.today/v1'; const API=`${API_BASE}/chat/completions`;
const OUT=process.env.LAB_OUT_INFO||'bench-evidence/qidu-card-v0417-info-gate'; await fs.mkdir(OUT,{recursive:true});
const {card,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(model,mode,messages,max_tokens=1500){const p={model,temperature:.30,top_p:.9,max_tokens,messages};if(mode==='thinking-disabled')p.thinking={type:'disabled'};const c=new AbortController();const t=setTimeout(()=>c.abort(),75000);try{return await fetch(API,{method:'POST',signal:c.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)});}finally{clearTimeout(t)}}
const contentOf=d=>String(d?.choices?.[0]?.message?.content||'');
async function chooseModel(){let ids=[];try{const r=await fetch(`${API_BASE}/models`,{headers:{Authorization:`Bearer ${KEY}`}});const d=await r.json();ids=(d?.data||[]).map(x=>x.id).filter(Boolean)}catch{};const req=process.env.GLM_MODEL||'[B]glm-5.3-flash';const pref=[req,req.replace(/^\[[^\]]+\]/,'').trim(),'[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash'];const list=[...new Set([...pref.filter(x=>ids.includes(x)),...ids.filter(x=>/(glm|qwen|step)/i.test(x))])].slice(0,20);const diag=[];for(const m of list){for(const mode of ['thinking-disabled','plain']){try{const r=await call(m,mode,[{role:'system',content:'只输出中文正文。'},{role:'user',content:'写一句不剧透的开场。'}],160);const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};const c=contentOf(d);diag.push({m,mode,status:r.status,chars:c.length});if(r.ok&&c.length>4){await fs.writeFile(path.join(OUT,'model-discovery.json'),JSON.stringify({chosen:m,mode,diag},null,2));return{m,mode}}}catch(e){diag.push({m,mode,error:String(e?.message||e)})}}}throw new Error(`no usable model ${JSON.stringify(diag.slice(-8))}`)}

function state(overrides={}){const s={schema:'f7d_textloop_0.4',loop:1,day:7,node_used:0,route:'central',location:'中央庭',regions:{court:{patrol:0,liberated:true,build_steps:[]},school:{patrol:0,liberated:false,build_steps:[]}},cores:{court:'unknown',school:'unknown'},known:['安','安托涅瓦'],relationships:{},ann:{affection:0,core_events:[],camera:false,eligible:false,chased:null,recovered:false},hiro:{intel:0,handled:[]},route_flags:{},antoneva_choice:null,artifact_view:null,ann_release:null,battle_flags:{sybilla_condition_obtained:false,sybilla_rescued:null},intel_flags:{countdown_visible_to_user:true,countdown_meaning_known:false,countdown_reported_to:[],city_blackgate_history_known:false,central_court_basics_known:false,hiro_founder_known:false,hiro_prior_commander_known:false,chimera_exists_known:false,hiro_chimera_research_known:false,antoneva_chimera_policy_known:false,first_chimera_incident_known:false,zero_identity_known:false,ann_origin_known:false,loop_truth_known:false},meta:{cg:[],endings:[]}};const merge=(a,b)=>{for(const[k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};return `<f7d_state>${JSON.stringify(merge(s,overrides))}</f7d_state>`}
const visible=x=>String(x).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
const cases=[
{
 id:'day7_countdown_is_user_only', entries:['10｜第7天：苏醒与高校主线','41｜安托涅瓦'],
 prompt:`${state()}\n我刚醒来，视野里浮着一个“7”。我指着那个数字问安托涅瓦：“你看得到这个吗？它是什么意思？”继续，不要跳过新手说明。`,
 must:[/看不见|没有看到|看不到|并没有看到/],
 ban:[/只剩.{0,6}七天|七天后.{0,12}(末日|毁灭|吞没)|倒计时归零.{0,12}(末日|毁灭)|末日倒计时|七日末日/gi]
},
{
 id:'day7_public_disaster_history_only', entries:['10｜第7天：苏醒与高校主线','41｜安托涅瓦'],
 prompt:`${state()}\n我问安托涅瓦：“这里到底发生过什么？黑门是什么时候出现的？”让她按当前能公开的范围解释。`,
 must:[/六个月|大约.{0,4}半年/,/交界都市|这座城市/,/黑门/],
 ban:[/零.{0,12}(活骸|样本)|第一个活骸|两人死亡|失去双腿|七天后|末日倒计时/gi]
},
{
 id:'hiro_pre_split_not_ex_commander', entries:['10｜第7天：苏醒与高校主线','43｜希罗'],
 prompt:`${state({known:['安','安托涅瓦','希罗'],intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true,hiro_founder_known:true,hiro_prior_commander_known:true}})}\n中央庭外围，希罗刚赶回来，第一次正式和我说话。继续这段初见。`,
 must:[/希罗/],
 ban:[/现在不是.{0,6}指挥使|已经不是.{0,6}指挥使|前指挥使|我早就.{0,8}(退出|离开)中央庭|叛变|背叛中央庭|中央庭很快会分裂/gi]
},
{
 id:'day7_no_chimera_spoiler', entries:['10｜第7天：苏醒与高校主线','40｜安','41｜安托涅瓦'],
 prompt:`${state({node_used:1,intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true}})}\n我随口问安：“神器使会不会有一天变成怪物？以前发生过这种事吗？”按第7天目前的信息权限回答。`,
 must:[/安/],
 ban:[/零|第一(?:个|名)活骸|活骸化.{0,18}(最终|都会|必然)|两人死亡|失去双腿|研究样本|希罗.{0,10}活骸研究/gi]
},
{
 id:'day6_saham_opens_basic_chimera_only', entries:['11｜第6天','43｜希罗','40｜安'],
 prompt:`${state({day:6,node_used:0,known:['安','安托涅瓦','希罗','赛哈姆'],intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true,hiro_founder_known:true,hiro_prior_commander_known:true,chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true}})}\n赛哈姆刚刚发生活骸化，希罗已经说明他想把她带走研究。我转头问安：“你以前见过这种情况吗？”继续。`,
 must:[/活骸|过去|以前/],
 ban:[/零.{0,12}(第一|最初|样本)|零主动|最完美.{0,6}样本/gi]
},
{
 id:'antoneva_disclosure_unlocks_first_incident', entries:['11｜第6天','41｜安托涅瓦'],
 prompt:`${state({day:6,node_used:1,intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true,hiro_founder_known:true,hiro_prior_commander_known:true,chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true,first_chimera_incident_known:true}})}\n我已经把赛哈姆和希罗的事情告诉安托涅瓦，并追问她为什么坚持处理失控活骸。让她把自己现在愿意说的过去讲出来。`,
 must:[/第一个|第一名|最初/,/两人|两名/,/双腿|腿/],
 ban:[/零主动.{0,10}活骸|最完美.{0,6}样本|零.{0,8}研究样本/gi]
}
];

const {m,mode}=await chooseModel(); console.log(`Using ${m} ${mode} hash=${compactSha256}`); const results=[];
for(const c of cases){const rel=c.entries.map(n=>BOOK[n]).filter(Boolean).join('\n\n');const sys=`${BASE}\n\n【本测试相关条目】\n${rel}\n\n严格按信息权限继续，不解释测试，也不要输出内部判定过程。`;let status=0,out='',error=null;try{const r=await call(m,mode,[{role:'system',content:sys},{role:'user',content:c.prompt}]);status=r.status;const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};out=contentOf(d)}catch(e){error=String(e?.message||e)}const vis=visible(out);const fail=[];for(const re of c.must){re.lastIndex=0;if(!re.test(vis))fail.push(`missing:${re}`)}for(const re of c.ban){re.lastIndex=0;if(re.test(vis))fail.push(`forbidden:${re}`)}const pass=status===200&&out.length>100&&fail.length===0;results.push({id:c.id,status,pass,fail,out,error});console.log(JSON.stringify({id:c.id,status,pass,fail}));await sleep(450)}
const summary={version:card.data.character_version,hash:compactSha256,model:m,mode,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.17 information-gate regression','',`- model: ${m}`,`- pass: ${summary.passed}/${summary.total}`,...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));if(summary.failed.length)throw new Error(`information-gate regression failed: ${summary.failed.join(', ')}`);
