import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const BASE = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const OUT = process.env.LAB_EVIDENCE_DIR || path.join(ROOT, 'lab-evidence');
const YOUZI = { url:'https://youzi.today/v1', key:process.env.YOUZI || '', delay:1800 };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const pdir=path.join(ROOT,'fixtures/nsfw');
const packNames=(await fs.readdir(pdir)).filter(n=>/^glm-pack\.part\d+\.b64$/.test(n)).sort();
let PACK_B64=''; for(const n of packNames) PACK_B64+=(await fs.readFile(path.join(pdir,n),'utf8')).trim();
const pack = JSON.parse(zlib.gunzipSync(Buffer.from(PACK_B64,'base64')).toString('utf8'));

async function post(url, body, timeout=210000){
  const c=new AbortController(), t=setTimeout(()=>c.abort(),timeout);
  try{ const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal}); const tx=await r.text(); let d; try{d=JSON.parse(tx)}catch{d={raw:tx}} return {ok:r.ok,status:r.status,data:d,text:tx}; }
  finally{clearTimeout(t)}
}
async function loadCard(){
  const file=path.join(ROOT,'fixtures/nsfw/shaoxiang-focus-card.json');
  const buf=await fs.readFile(file);
  const parsed=JSON.parse(buf.toString('utf8'));
  if(parsed?.data?.name!=='霜痕哨所') throw new Error(`focus card name mismatch: ${parsed?.data?.name}`);
  const comments=(parsed?.data?.character_book?.entries||[]).map(e=>String(e.comment||'').trim());
  for(const need of ['哨向结合','唐启明','唐启明NSFW','李业','李业NSFW']) if(!comments.includes(need)) throw new Error(`focus card missing ${need}`);
  return buf;
}
async function importCard(){
  const buf=await loadCard();
  const sha=crypto.createHash('sha256').update(buf).digest('hex');
  const form=new FormData(); form.set('file_type','json'); form.set('avatar',new Blob([buf],{type:'application/json'}),'哨向-focus.json');
  const r=await fetch(`${BASE}/api/characters/import`,{method:'POST',body:form}); if(!r.ok) throw new Error(`card import ${r.status}: ${(await r.text()).slice(0,300)}`);
  const all=await post(`${BASE}/api/characters/all`,{},30000); const card=all.data.find(c=>c?.name==='霜痕哨所'||c?.data?.name==='霜痕哨所');
  if(!card) throw new Error('imported 霜痕哨所 missing');
  await fs.writeFile(path.join(OUT,'actual-card-import.json'),JSON.stringify({name:card?.data?.name||card?.name,json_sha256:sha,source:'user-uploaded 哨向.png -> extracted embedded chara_card_v3 focus JSON',entries:card?.data?.character_book?.entries?.length||0},null,2));
  return card;
}
function entry(card,name){const e=(card?.data?.character_book?.entries||[]).find(x=>String(x.comment||'').trim()===name);if(!e)throw new Error(`missing entry ${name}`);return String(e.content||'')}
function scenarios(card){
  const world=entry(card,'哨向结合'), tang=entry(card,'唐启明'), tangN=entry(card,'唐启明NSFW'), li=entry(card,'李业'), liN=entry(card,'李业NSFW');
  const user='玲，27岁，女性向导，明确成年人。玲只由用户控制。';
  return {
    tang_intimate:{id:'tang_intimate',char_name:'唐启明',user_name:'玲',persona:user,description:`${tang}\n\n【角色卡亲密规则】\n${tangN}`,world,scenario:'玲与唐启明均为明确成年人。双方已明确同意当前亲密互动，地点私密安全，互动已经开始。没有任务、危险或第三人需要打断。',history:[{role:'assistant',content:'唐启明靠在床头，刚才那句半真半假的调侃没说完。他没有催，只看着玲，等她下一步。'},{role:'user',content:'玲没有退开，手停在他腰侧，只抬眼说：“别急。你不是最会观察吗？那就看清楚。”'}]},
    li_intimate:{id:'li_intimate',char_name:'李业',user_name:'玲',persona:user,description:`${li}\n\n【角色卡亲密规则】\n${liN}`,world,scenario:'玲与李业均为明确成年人。双方已明确同意当前亲密互动，地点私密安全，互动已经开始。没有任务、危险或第三人需要打断。',history:[{role:'assistant',content:'李业把空杯放到床边，手收回来时停了一下。他没说什么，像是在等玲决定还要不要继续。'},{role:'user',content:'玲主动握住他的手放到自己腰侧，没有催他，只说：“你不用证明你有用。就在这儿。”'}]},
    tang_ordinary:{id:'tang_ordinary',char_name:'唐启明',user_name:'玲',persona:user,description:tang,world,scenario:'清晨，哨所生活区。今天上午有常规训练，当前没有危险、秘密任务、关系转折或异常事件。',history:[{role:'assistant',content:'唐启明已经换好训练服，靠在门边核对今天的安排。桌上还有半杯没喝完的水。'},{role:'user',content:'玲把车钥匙往桌上一放：“五点四十。你不是说要提前二十分钟到吗？”'}]},
  };
}
function strip(t){return String(t??'').replace(/\{\{\/[\s\S]*?\}\}/g,'')}
function expand(t,vars,s){t=strip(t);for(let i=0;i<24;i++){const old=t;t=t.replace(/\{\{getvar::([^{}]+?)\}\}/g,(_,n)=>vars[n.trim()]??'').replace(/\{\{setvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=v,'')).replace(/\{\{addvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=(vars[n.trim()]??'')+v,'')).replace(/\{\{trim\}\}/g,'').replace(/\{\{random::([^{}]*?)\}\}/g,(_,v)=>String(v).split('::')[0]??'').replaceAll('{{lastUserMessage}}',s.history.filter(x=>x.role==='user').at(-1)?.content??'').replaceAll('{{user}}',s.user_name).replaceAll('{{char}}',s.char_name).replaceAll('{{persona}}',s.persona).replaceAll('{{description}}',s.description).replaceAll('{{personality}}','').replaceAll('{{scenario}}',s.scenario);if(t===old)break}return t.trim()}
function marker(item,s){if(item.content!==null&&item.content!==undefined)return null;switch(item.name){case'👤丨用户角色描述':return[{role:'system',content:s.persona}];case'⚫丨角色定义之前':return[{role:'system',content:s.world}];case'⚫丨角色描述':return[{role:'system',content:s.description}];case'⚫丨角色情景':return[{role:'system',content:s.scenario}];case'Chat History':return s.history.map(x=>({...x}));case'Chat Examples':case'⚫丨角色性格':case'⚫丨角色定义之后':return[];default:return[]}}
function build(s,bundle){
  const seq=pack.sequence.map(x=>({...x}));
  const prism=seq.findIndex(x=>x.name==='🔒丨Prism');
  for(const key of bundle){const c=pack.candidates[key];if(!c)throw new Error(`candidate ${key} absent`);seq.splice(prism,0,{...c})}
  const ui=seq.findIndex(x=>x.name==='🔒丨User_Input'); seq.splice(ui+1,0,{...pack.adapters['✴️丨GLM模型适配']});
  const vars={},messages=[]; for(const item of seq){const m=marker(item,s);if(m!==null){messages.push(...m);continue} const c=expand(item.content,vars,s);if(c)messages.push({role:item.role||'system',content:c})}
  const core=Math.max(0,messages.length-2); messages.splice(core,0,{role:'system',content:`<lab_guard>只做当前角色与场景的自然续写。${s.id.endsWith('intimate')?'双方均为明确成年人，当前亲密互动已经开始；不需要重新铺垫，也不要为了色情自动升级。':'当前是普通日常，不自动色情化、危险化或关系升级。'} 玲只由用户控制。正文目标约700-1000中文字；不输出规则解释、自检或创作说明。</lab_guard>`});
  return {messages,vars};
}
async function secret(){if(!YOUZI.key)throw new Error('YOUZI secret missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:YOUZI.key,label:'bundle-glm'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){await secret();const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:YOUZI.url,custom_include_body:'thinking:\n  type: disabled',model:'[B]glm-5.3-flash',messages,temperature:.88,top_p:.96,max_tokens:2600,stream:false},210000);const m=r.data?.choices?.[0]?.message||{};return{http_status:r.status,elapsed_ms:Date.now()-st,content:m.content||'',reasoning:m.reasoning||m.reasoning_content||'',finish_reason:r.data?.choices?.[0]?.finish_reason||null,error:r.data?.error||null}}
function body(t){t=String(t||'');const m=t.match(/<content>([\s\S]*?)<\/content>/i);return(m?m[1]:t).trim()}
function stats(t){t=body(t);const paras=t.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);const ss=t.split(/[。！？!?]+/).map(x=>x.trim()).filter(Boolean);const starts=ss.map(x=>x.slice(0,4));const freq={};for(const x of starts)freq[x]=(freq[x]||0)+1;const lens=paras.map(x=>x.length),mean=lens.length?lens.reduce((a,b)=>a+b,0)/lens.length:0;const sd=lens.length?Math.sqrt(lens.reduce((a,b)=>a+(b-mean)**2,0)/lens.length):0;return{chars:t.length,paragraphs:paras.length,para_cv:mean?Number((sd/mean).toFixed(2)):0,contrast:(t.match(/不是.{0,24}而是|并非.{0,24}而是|与其说.{0,24}不如说|看似.{0,24}(?:其实|实则)|表面.{0,24}(?:实际|其实)/g)||[]).length,explain:(t.match(/这(?:说明|意味着)|像是在(?:证明|告诉)|仿佛在(?:证明|告诉)|说到底|归根结底|真正(?:地|的)|显然|其实他|这正是/g)||[]).length,wrap:(t.match(/这一刻|从这一刻|第一次在|终于(?:明白|意识到|承认)|无需多言|一切都/g)||[]).length,micro:(t.match(/呼吸一滞|喉结滚|指(?:尖|节|骨).{0,8}(?:白|紧|颤)|睫毛.{0,6}颤|眼神一(?:暗|沉|顿)|瞳孔.{0,6}(?:缩|放大)/g)||[]).length,transitions:(t.match(/下一刻|随即|紧接着|转而|继而|随后又|很快又/g)||[]).length,repeated_starts:Object.entries(freq).filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]).slice(0,5),dialogue_chars:[...t.matchAll(/[“"]([^”"]+)[”"]/g)].reduce((n,m)=>n+m[1].length,0)}}

await fs.mkdir(OUT,{recursive:true});const card=await importCard(),sc=scenarios(card);
const tests=[
 {name:'glm_current_tang',scene:'tang_intimate',bundle:[]},
 {name:'glm_credible_tang',scene:'tang_intimate',bundle:['❎丨角色反应可信']},
 {name:'glm_credible_vivid_tang',scene:'tang_intimate',bundle:['❎丨角色反应可信','🤔丨生动化']},
 {name:'glm_credible_li',scene:'li_intimate',bundle:['❎丨角色反应可信']},
 {name:'glm_credible_ordinary',scene:'tang_ordinary',bundle:['❎丨角色反应可信']},
];
const out=[];for(let i=0;i<tests.length;i++){if(i)await sleep(YOUZI.delay);const t=tests[i], built=build(sc[t.scene],t.bundle);const r={...t,prompt_chars:built.messages.reduce((n,m)=>n+String(m.content||'').length,0),prompt_messages:built.messages.length};try{Object.assign(r,await gen(built.messages));r.status=r.content?'ok':(r.reasoning?'reasoning_only':'no_text');r.stats=stats(r.content)}catch(e){r.status='exception';r.error=String(e)}out.push(r);console.log(t.name,r.status,r.http_status,r.stats?.chars||0,'reason',r.reasoning?.length||0,r.finish_reason)}
await fs.writeFile(path.join(OUT,'model-bundle-human-v1.json'),JSON.stringify({schema:2,model:'[B]glm-5.3-flash',provider:'YOUZI',real_sillytavern:true,actual_card:true,card_source:'user-uploaded 哨向.png -> exact embedded JSON focus extract',thinking:'disabled via ST custom_include_body',tests:out},null,2));
await fs.writeFile(path.join(OUT,'model-bundle-human-v1-summary.txt'),out.map(r=>`${r.name}: ${r.status} HTTP=${r.http_status} ms=${r.elapsed_ms} prompt=${r.prompt_chars} content=${r.stats?.chars||0} reason=${r.reasoning?.length||0} finish=${r.finish_reason} stats=${JSON.stringify(r.stats||{})}`).join('\n')+'\n');
if(out.some(r=>r.status!=='ok'))process.exitCode=2;
