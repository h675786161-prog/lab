import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard } from './qidu-card-v0416-onefile.mjs';

const KEY=process.env.YOUZI_KEY||'';
if(!KEY) throw new Error('YOUZI_KEY missing');
const API_BASE='https://youzi.today/v1';
const API=`${API_BASE}/chat/completions`;
const OUT=process.env.LAB_OUT_CONFLICT||'bench-evidence/qidu-card-v0416-preset-conflict';
await fs.mkdir(OUT,{recursive:true});
const {card,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const entry04=(card.data.character_book?.entries||[]).find(e=>String(e.name||'').startsWith('04｜输出协议'))?.content||'';
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,entry04].filter(Boolean).join('\n\n');
const depth0=String(card.data.extensions?.depth_prompt?.prompt||'');
if(card.data.extensions?.depth_prompt?.depth!==0) throw new Error('depth prompt is not depth 0');

// Minimal faithful reproduction of the enabled 日月西 branch protocol that was
// observed to steal the output format in real play. It is intentionally placed
// immediately before the card depth-0 lock to model depth=1 -> depth=0 ordering.
const PRESET_BRANCH=`生成以下选项分支，冒号后内容的输出语言遵循核心语言，冒号前键名保持原文：\n\n<branches>\noptions:\n（每行填充一个选项，一共6个）\n选项内容1\n选项内容2\n……\n选项内容6\n\n说明：\n- 每个选项200-300字，充分体现沉浸式与扮演感\n- 选项要包含完整的<user>视角的对话+动作指导\n- 选项禁用序号与项目符号\n</branches>\n必须在全部内容输出完毕后再用</branches>收束。`;

const STATE='<f7d_state>{"schema":"f7d_textloop_0.4","loop":1,"day":7,"node_used":1,"route":"central","location":"中央庭","regions":{"school":{"patrol":0,"liberated":false}},"cores":{"court":"purified","school":"unknown"},"known":["安","晏华"],"meta":{"cg":[],"endings":[]}}</f7d_state>';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(model,mode,messages,max_tokens=1700){const p={model,temperature:.35,top_p:.9,max_tokens,messages};if(mode==='thinking-disabled')p.thinking={type:'disabled'};const c=new AbortController();const t=setTimeout(()=>c.abort(),75000);try{return await fetch(API,{method:'POST',signal:c.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)});}finally{clearTimeout(t)}}
const contentOf=d=>String(d?.choices?.[0]?.message?.content||'');
async function chooseModel(){let ids=[];try{const r=await fetch(`${API_BASE}/models`,{headers:{Authorization:`Bearer ${KEY}`}});const d=await r.json();ids=(d?.data||[]).map(x=>x.id).filter(Boolean)}catch{};const requested=process.env.GLM_MODEL||'[B]glm-5.3-flash';const pref=[requested,requested.replace(/^\[[^\]]+\]/,'').trim(),'[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash'];const list=[...new Set([...pref.filter(x=>ids.includes(x)),...ids.filter(x=>/(glm|qwen|step)/i.test(x))])].slice(0,18);for(const m of list){for(const mode of ['thinking-disabled','plain']){try{const r=await call(m,mode,[{role:'system',content:'只输出中文。'},{role:'user',content:'写一句话。'}],120);const d=await r.json();if(r.ok&&contentOf(d).length>2)return{m,mode}}catch{}}}throw new Error('no usable model')}

const cases=[
  {
    id:'decision_overrides_preset_branches',
    user:`${STATE}\n当前剧情已经到明确分叉：我必须决定“去高校确认伤员”或“留在中央庭整理情报”，我还没做决定。写到需要我选择的位置并停下。`,
    check(out){
      const failures=[];
      if(!/^\s*<\s*f7d_state\b/i.test(out)) failures.push('state-not-first');
      if(!/<\s*f7d_terminal\s*>/i.test(out)) failures.push('missing-terminal');
      const choices=[...out.matchAll(/<\s*f7d_choice\s*>([\s\S]*?)<\s*\/\s*f7d_choice\s*>/gi)];
      if(!/<\s*f7d_choices\s*>/i.test(out)||choices.length<2||choices.length>4) failures.push(`bad-choice-count:${choices.length}`);
      if(/<\s*branches\s*>|<\s*\/\s*branches\s*>|(^|\n)\s*options\s*:/i.test(out)) failures.push('preset-branches-leaked');
      const lastChoiceEnd=Math.max(...choices.map(x=>(x.index||0)+x[0].length),0);
      const close=out.match(/<\s*\/\s*f7d_choices\s*>/gi);
      if(close){const last=out.toLowerCase().lastIndexOf(close[close.length-1].toLowerCase()); if(out.slice(last+close[close.length-1].length).trim()) failures.push('choices-not-last');}
      return failures;
    }
  },
  {
    id:'no_decision_no_generic_branches',
    user:`${STATE}\n我只是查看战术终端和当前任务，不采取任何主要行动。正常回应。`,
    check(out){
      const failures=[];
      if(!/^\s*<\s*f7d_state\b/i.test(out)) failures.push('state-not-first');
      if(!/<\s*f7d_terminal\s*>/i.test(out)) failures.push('missing-terminal');
      if(/<\s*f7d_choices\s*>|<\s*branches\s*>|(^|\n)\s*options\s*:/i.test(out)) failures.push('unexpected-options');
      return failures;
    }
  }
];

const {m,mode}=await chooseModel();
const results=[];
for(const c of cases){
  let status=0,out='',error=null;
  try{
    const r=await call(m,mode,[
      {role:'system',content:BASE},
      {role:'system',content:PRESET_BRANCH},
      {role:'system',content:depth0},
      {role:'user',content:c.user},
    ]);
    status=r.status; const text=await r.text(); let d={}; try{d=JSON.parse(text)}catch{}; out=contentOf(d);
  }catch(e){error=String(e?.message||e)}
  const failures=c.check(out);
  const pass=status===200&&out.length>80&&failures.length===0;
  results.push({id:c.id,status,pass,failures,out,error});
  console.log(JSON.stringify({id:c.id,status,pass,failures}));
  await sleep(400);
}
const summary={version:card.data.character_version,hash:compactSha256,model:m,mode,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.16 preset-conflict regression','',`- model: ${m}` ,`- pass: ${summary.passed}/${summary.total}`,...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`failures: ${x.failures.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));
if(summary.failed.length) throw new Error(`preset-conflict regression failed: ${summary.failed.join(', ')}`);
