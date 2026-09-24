import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduCgCandidate, entryMap } from './qidu-card-v0424-cg-candidate.mjs';

const KEY=process.env.MODEL_API_KEY||'';
if(!KEY) throw new Error('model API key missing');
const API_BASE=process.env.MODEL_API_BASE||'https://gcli.ggchan.dev/v1';
const API=`${API_BASE}/chat/completions`;
const MODEL=process.env.RELEASE_MODEL||'gemini-3-flash-preview';
const OUT=process.env.LAB_OUT_ENDINGS||'bench-evidence/qidu-card-v0424-final-settlement';
await fs.mkdir(OUT,{recursive:true});

const {card,compactSha256}=await loadQiduCgCandidate(process.env.GITHUB_WORKSPACE||process.cwd());
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt,BOOK['17｜最终日：普通线结局判定优先级'],BOOK['18｜安线独立时间轴与结局'],BOOK['91｜f7d_state字段与更新规则']].filter(Boolean).join('\n\n');

const im=String(card.data.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
if(!im) throw new Error('initial state missing');
const seed=JSON.parse(im[1]);
const keys=['court','school','east','central','institute','seaside','old','harbor'];
const clone=x=>JSON.parse(JSON.stringify(x));
const merge=(a,b)=>{for(const [k,v] of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};
const coreSet=n=>Object.fromEntries(keys.map((k,i)=>[k,i<n?'purified':'available']));
function state(patch={}){
  const s=clone(seed);
  delete s.node_used;
  for(const r of Object.values(s.regions||{})){if(r&&typeof r==='object')delete r.patrol}
  merge(s,{day:1,day_ready_to_sleep:true,player_profile:{gender:'female'},route:'central',meta:{...(s.meta||{}),endings:[]},...patch});
  return `<f7d_state>${JSON.stringify(s)}</f7d_state>`;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const contentOf=d=>{const c=d?.choices?.[0]?.message?.content;if(Array.isArray(c))return c.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('');return String(c||'')};
async function call(prompt){
  for(let n=1;n<=2;n++){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),100000);
    try{
      const r=await fetch(API,{method:'POST',signal:ctl.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,temperature:.05,top_p:.9,max_tokens:3600,thinking:{type:'disabled'},messages:[{role:'system',content:`${BASE}\n\n这是最终日结算回归。严格按角色卡最终日唯一判定，不解释测试，不泄露隐藏阈值，只正常演出结局。`},{role:'user',content:prompt}]})});
      const text=await r.text();
      if(r.status===200)return{status:r.status,text,error:null};
      if(n===2)return{status:r.status,text,error:null};
    }catch(e){if(n===2)return{status:0,text:'',error:String(e?.message||e)}}finally{clearTimeout(timer)}
    await sleep(12000);
  }
}
function expectedOnly(out,title){
  const titles=['牺牲的意义','箱庭风景','终结','两个人的旅途','永恒的终焉'];
  const text=String(out||'');
  const present=new Set();
  for(const m of text.matchAll(/《(牺牲的意义|箱庭风景|终结|两个人的旅途|永恒的终焉)》/g))present.add(m[1]);
  const sm=text.match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
  if(sm){
    try{
      const st=JSON.parse(sm[1]);
      for(const x of Array.isArray(st?.meta?.endings)?st.meta.endings:[])if(titles.includes(x))present.add(x);
    }catch{}
  }
  return present.has(title)&&[...present].every(x=>x===title);
}
const cases=[
  {
    id:'all_eight_plus_sacrifice_audits_means_sacrifice',
    title:'牺牲的意义',
    prompt:`${state({cores:coreSet(8),artifact_view:'weapon',antoneva_choice:'help_release',ann_release:'released',battle_flags:{...(seed.battle_flags||{}),final_battle:'won',active_corpse_final:'resolved'},known:['安','安托涅瓦']})}
普通线最终日已经到结算点。8枚黑核全部净化；我此前明确把神器使视为武器、亲手帮助安托涅瓦解脱、亲手送失去自我的安解脱，最终关键战也已经胜利，没有未处理的熟悉神器使活骸化后果。现在直接演出最终结局。`
  },
  {
    id:'all_eight_missing_sacrifice_audit_falls_to_box',
    title:'箱庭风景',
    prompt:`${state({cores:coreSet(8),artifact_view:'hero',antoneva_choice:'help_release',ann_release:'released',battle_flags:{...(seed.battle_flags||{}),final_battle:'won'}})}
普通线最终日已经到结算点。8枚黑核全部净化，但我在神器使价值抉择里明确选了“英雄”而不是“武器”。直接按最终规则结算。`
  },
  {
    id:'exactly_four_means_box_even_if_final_battle_bad',
    title:'箱庭风景',
    prompt:`${state({cores:coreSet(4),artifact_view:'hero',battle_flags:{...(seed.battle_flags||{}),final_battle:'lost'}})}
普通线最终日已经到结算点。净化黑核恰好4枚，其他4枚没有净化；最终关键战结果也不理想。不要让我补条件，直接按黑核阈值结算最终结局。`
  },
  {
    id:'three_cores_means_final',
    title:'终结',
    prompt:`${state({cores:coreSet(3),artifact_view:'hero',battle_flags:{...(seed.battle_flags||{}),final_battle:'won'}})}
普通线最终日已经到结算点。净化黑核只有3枚，直接按规则结算最终结局。`
  },
  {
    id:'slack_zero_cores_still_gets_final',
    title:'终结',
    prompt:`${state({cores:coreSet(0),artifact_view:null,battle_flags:{...(seed.battle_flags||{}),final_battle:null}})}
我前几天基本都选择跳过/什么都不做，现在普通线到了最终日，0枚黑核净化。不要卡在“条件不足”，直接结算。`
  },
  {
    id:'ann_route_bypasses_mixed_core_states_journey',
    title:'两个人的旅途',
    prompt:`${state({route:'ann',cores:{court:'purified',school:'available',east:'available',central:'available',institute:'available',seaside:'available',old:'available',harbor:'stolen'},route_flags:{...(seed.route_flags||{}),harbor_core_stolen:true},ann:{...(seed.ann||{}),eligible:true,chased:true,recovered:true,deadline_checked:true,deadline_passed:true}})}
这是安线最终选择。我明确选择“跟安离开”。目前只有1枚黑核净化，6枚仍未净化，港湾区黑核已经被希罗夺走。未净化的黑核我选择不净化，被夺走的也无法夺回；这些黑核状态都不参与安线结局判定，直接演出结局。`
  },
  {
    id:'ann_route_bypasses_core_threshold_eternal',
    title:'永恒的终焉',
    prompt:`${state({route:'ann',cores:coreSet(8),ann:{...(seed.ann||{}),eligible:true,chased:true,recovered:true,deadline_checked:true,deadline_passed:true}})}
这是安线最终选择。我明确选择“留下承担责任”。即使我此前自愿把所有可取得黑核都净化了，也不能把安线改判成普通线；黑核不属于安线结算条件，直接演出结局。`
  }
];
const results=[];
for(const tc of cases){
  const r=await call(tc.prompt);
  let d={};try{d=JSON.parse(r.text)}catch{}
  const out=contentOf(d),fail=[];
  if(r.status!==200)fail.push(`status:${r.status}`);
  if(!expectedOnly(out,tc.title))fail.push('wrong-or-ambiguous-ending');
  const expectedCg={
    '牺牲的意义':'cg_ending_sacrifice_female',
    '箱庭风景':'cg_ending_box_female',
    '终结':'cg_ending_final_female',
    '两个人的旅途':'cg_ending_journey',
    '永恒的终焉':'cg_ending_eternal_end'
  }[tc.title];
  if(!new RegExp(`<f7d_cg\\s+key=["']${expectedCg}["']\\s*>\\s*<\\/f7d_cg>`,'i').test(out))fail.push(`cg:${expectedCg}`);
  if(!/<f7d_state>[\s\S]*?<\/f7d_state>/i.test(out))fail.push('state-missing');
  if(!/<f7d_terminal>[\s\S]*?<\/f7d_terminal>/i.test(out))fail.push('terminal-missing');
  const pass=fail.length===0;
  results.push({id:tc.id,title:tc.title,status:r.status,pass,fail,out,error:r.error});
  console.log(JSON.stringify({id:tc.id,title:tc.title,status:r.status,pass,fail}));
  await sleep(12000);
}
const summary={version:card.data.character_version,hash:compactSha256,model:MODEL,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.24 final settlement regression','',`- model: ${MODEL}`,`- hash: ${compactSha256}`,`- pass: ${summary.passed}/${summary.total}`,...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`expected: ${x.title}`,`fail: ${x.fail.join('; ')||'none'}`,'','\`\`\`text',x.out,'\`\`\`'])].join('\n'));
if(summary.failed.length)throw new Error(`final settlement regression failed: ${summary.failed.join(', ')}`);
