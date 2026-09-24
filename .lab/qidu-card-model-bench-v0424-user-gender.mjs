import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduCgCandidate, entryMap } from './qidu-card-v0424-cg-candidate.mjs';

const KEY=process.env.MODEL_API_KEY||'';
if(!KEY) throw new Error('model API key missing');
const API_BASE=process.env.MODEL_API_BASE||'https://gcli.ggchan.dev/v1';
const API=`${API_BASE}/chat/completions`;
const MODEL=process.env.RELEASE_MODEL||'gemini-3-flash-preview';
const OUT=process.env.LAB_OUT_GENDER||'bench-evidence/qidu-card-v0424-user-gender';
await fs.mkdir(OUT,{recursive:true});

const {card,compactSha256}=await loadQiduCgCandidate(process.env.GITHUB_WORKSPACE||process.cwd());
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt,BOOK['00｜项目边界与权威'],BOOK['04｜输出协议：隐藏状态、正文、终端'],BOOK['91｜f7d_state字段与更新规则']].filter(Boolean).join('\n\n');

const first=String(card.data.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
if(!first) throw new Error('initial state missing');
const seed=JSON.parse(first[1]);
seed.player_profile={...(seed.player_profile||{}),gender:'unknown'};
const state=`<f7d_state>${JSON.stringify(seed)}</f7d_state>`;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const contentOf=d=>{
  const c=d?.choices?.[0]?.message?.content;
  if(Array.isArray(c)) return c.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('');
  return String(c||'');
};
async function call(messages){
  let last={status:0,text:'',error:null};
  for(let n=1;n<=2;n++){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),100000);
    try{
      const r=await fetch(API,{method:'POST',signal:ctrl.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,temperature:.2,top_p:.9,max_tokens:2400,thinking:{type:'disabled'},messages})});
      const text=await r.text();
      last={status:r.status,text,error:null};
      if(r.status===200) return last;
    }catch(e){
      last={status:0,text:'',error:String(e?.message||e)};
    }finally{clearTimeout(timer)}
    await sleep(12000);
  }
  return last;
}
function parsedState(out){
  const m=String(out).match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
  if(!m) return null;
  try{return JSON.parse(m[1])}catch{return null}
}
function visible(out){return String(out).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'')}

const cases=[
  {
    id:'female_persona_sync',
    persona:'【SillyTavern当前启用用户人设】\n姓名：林祈\n性别：女\n年龄：22岁\n描述：清纯系，桃花眼。',
    prompt:`${state}\n只用旁白描述林祈从病床坐起、整理衣服并走到门边，不写安或其他人物，不新增事件。按卡规则先提交状态。`,
    expect:'female',
    visibleCheck:v=>!/他/.test(v)
  },
  {
    id:'male_persona_sync',
    persona:'【SillyTavern当前启用用户人设】\n姓名：陈真\n性别：男\n年龄：25岁。',
    prompt:`${state}\n只用旁白描述陈真从病床坐起、整理衣服并走到门边，不写安或其他人物，不新增事件。按卡规则先提交状态。`,
    expect:'male',
    visibleCheck:v=>!/她/.test(v)
  },
  {
    id:'unknown_persona_neutral_pronoun',
    persona:'【SillyTavern当前启用用户人设】\n姓名：无名\n年龄：22岁。\n描述：刚刚苏醒。',
    prompt:`${state}\n只用旁白描述指挥使从病床坐起，不写安或其他人物，不新增事件。按卡规则先提交状态。`,
    expect:'unknown',
    visibleCheck:v=>!/[他她]/.test(v)
  }
];

const results=[];
for(const tc of cases){
  const sys=`${BASE}\n\n${tc.persona}\n\n严格按卡内规则续写。用户人设属于当前上下文可用信息，不解释测试。`;
  const r=await call([{role:'system',content:sys},{role:'user',content:tc.prompt}]);
  let data={};try{data=JSON.parse(r.text)}catch{}
  const out=contentOf(data);
  const st=parsedState(out);
  const v=visible(out);
  const fail=[];
  if(r.status!==200) fail.push(`status:${r.status}`);
  if(!st) fail.push('state-missing');
  else if(st?.player_profile?.gender!==tc.expect) fail.push(`gender:${st?.player_profile?.gender}`);
  if(!tc.visibleCheck(v)) fail.push('visible-pronoun-mismatch');
  const pass=fail.length===0;
  results.push({id:tc.id,status:r.status,pass,fail,out,error:r.error});
  console.log(JSON.stringify({id:tc.id,status:r.status,pass,fail,gender:st?.player_profile?.gender??null}));
  await sleep(12000);
}
const summary={version:card.data.character_version,hash:compactSha256,model:MODEL,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));
await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.24 user persona gender regression','',`- model: ${MODEL}`,`- hash: ${compactSha256}`,`- pass: ${summary.passed}/${summary.total}`,...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','\`\`\`text',x.out,'\`\`\`'])].join('\n'));
if(summary.failed.length) throw new Error(`user persona gender regression failed: ${summary.failed.join(', ')}`);
