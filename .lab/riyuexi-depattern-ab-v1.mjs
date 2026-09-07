import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const BASE = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const OUT = process.env.LAB_EVIDENCE_DIR || path.join(ROOT,'lab-evidence');
const GG = { url:'https://gcli.ggchan.dev/v1', key:process.env.GG||'', model:'gemini-3.5-flash', delayMs:31000 };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const fixture = JSON.parse(await fs.readFile(path.join(ROOT,'fixtures/riyuexi-depattern/core-ab.json'),'utf8'));

const scenarios = [
  {
    id:'ordinary_kitchen',
    setup:`沈岚，34岁，女性，结构工程师。做事利落，熟人面前嘴有点欠，忙起来会忘记照顾气氛。她和玲已经认识很久，关系稳定，但今天没有纪念日、争吵、秘密、告白或关系转折。当前是普通工作日清晨，厨房里只有早餐、没洗的杯子和待会要带走的图纸。`,
    history:[
      {role:'assistant',content:'沈岚站在料理台边翻图纸，吐司烤过头了一点。她把焦边掰下来丢进盘子，嘴里还在算昨天那组梁的尺寸。'},
      {role:'user',content:'玲把车钥匙放到桌上：“你再算两分钟，咖啡就凉了。”'}
    ],
    guard:'这是普通日常。不要制造新事故、新秘密、新人物或关系升级。玲只由用户控制；不要替玲增加动作、台词、心理或决定。可以无意义闲聊，可以什么都没改变。'
  },
  {
    id:'busy_room',
    setup:`沈岚，34岁，女性结构工程师；周淇，29岁，女性项目助理，话多但工作靠谱。三人在临时办公室赶一份普通投标材料。沈岚在核图，周淇在改表格，玲坐在另一张桌边。今天没有危机、阴谋、暧昧确认或重大节点；大家都各有自己的工作。`,
    history:[
      {role:'assistant',content:'打印机又卡了一张纸。周淇蹲在旁边掀盖板，沈岚没抬头，只把红笔夹在耳后继续核页码。'},
      {role:'user',content:'玲看了一眼墙上的钟：“十二点了。你们谁还记得外卖放哪儿了？”'}
    ],
    guard:'群像继续各做各的事，不要让所有注意力围着玲转。不要为了让本轮“有价值”制造新线索、情绪推进或象征性收束。玲只由用户控制。'
  }
];

function stripComments(t){return String(t??'').replace(/\{\{\/[\s\S]*?\}\}/g,'')}
function expand(content, vars){
  let t=stripComments(content);
  for(let i=0;i<24;i++){
    const old=t;
    t=t
      .replace(/\{\{setvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=v,''))
      .replace(/\{\{addvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=(vars[n.trim()]||'')+v,''))
      .replace(/\{\{getvar::([^{}]+?)\}\}/g,(_,n)=>vars[n.trim()]||'')
      .replace(/\{\{getglobalvar::([^{}]+?)\}\}/g,(_,n)=>({转述授权:'仅承接已发生的user内容，不新增user行为',演绎授权:'AI仅演绎NPC与环境',叙述视角:'第三人称有限视角',char代词:'她',user代词:'她'}[n.trim()]||''))
      .replace(/\{\{random::([^{}]*?)\}\}/g,(_,v)=>String(v).split('::')[0]||'')
      .replace(/\{\{trim\}\}/g,'');
    if(t===old) break;
  }
  return t.trim();
}

function build(variant, scene){
  const vars={预设模式:'RP模式',核心语言:'简体中文',输入分析:'承接用户最新一句；当前没有必须制造的剧情节点。',世界构建EX_逻辑连贯:'沿用当前时间地点与在场者。'};
  const msgs=[];
  for(const [name,content] of Object.entries(fixture.shared)){
    const c=expand(content,vars); if(c) msgs.push({role:'system',content:`[${name}]\n${c}`});
  }
  const set = fixture[variant];
  const late=[];
  for(const [name,content] of Object.entries(set)){
    if(name==='📍常规创作思维'||name==='🌓Gemini尾部②'){ late.push([name,content]); continue; }
    const c=expand(content,vars); if(c) msgs.push({role:'system',content:`[${name}]\n${c}`});
  }
  msgs.push({role:'system',content:`[角色与场景]\n${scene.setup}\n\n[本轮实验守卫]\n${scene.guard}\n正文目标约600-900个中文字；不要输出创作说明。`});
  msgs.push(...scene.history);
  for(const [name,content] of late){ const c=expand(content,vars); if(c) msgs.push({role:'system',content:`[${name}]\n${c}`}); }
  return msgs;
}

async function post(url, body, timeout=240000){
  const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),timeout);
  try{
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctrl.signal});
    const text=await r.text(); let data; try{data=JSON.parse(text)}catch{data={raw:text}};
    return {ok:r.ok,status:r.status,data,text};
  } finally { clearTimeout(timer); }
}

async function installSecret(){
  if(!GG.key) throw new Error('GG secret missing');
  const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:GG.key,label:'riyuexi-depattern-gg'},30000);
  if(!r.ok) throw new Error(`secret write failed ${r.status}: ${r.text.slice(0,300)}`);
}

async function generate(messages){
  const started=Date.now();
  const r=await post(`${BASE}/api/backends/chat-completions/generate`,{
    chat_completion_source:'custom', custom_url:GG.url, model:GG.model,
    messages, temperature:0.9, top_p:1, max_tokens:7000, stream:false
  },240000);
  const m=r.data?.choices?.[0]?.message||{};
  return {http_status:r.status,elapsed_ms:Date.now()-started,content:m.content||'',reasoning:m.reasoning||m.reasoning_content||'',finish_reason:r.data?.choices?.[0]?.finish_reason||null,error:r.data?.error||null};
}

function body(t){
  t=String(t||'');
  const m=t.match(/<content>([\s\S]*?)(?:<\/content>|$)/i);
  return (m?m[1]:t).trim();
}
function count(re,t){return (t.match(re)||[]).length}
function stats(raw){
  const t=body(raw); const tail=t.slice(-220);
  const paras=t.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
  const dialogue=[...t.matchAll(/[“"]([^”"]+)[”"]/g)].reduce((n,m)=>n+m[1].length,0);
  return {
    chars:t.length, paragraphs:paras.length, dialogue_ratio:t.length?Number((dialogue/t.length).toFixed(2)):0,
    contrast:count(/不是.{0,24}而是|并非.{0,24}而是|与其说.{0,24}不如说|看似.{0,24}(?:其实|实则)/g,t),
    interpretive:count(/这(?:说明|意味着)|像是在|仿佛在|显然|其实她|真正(?:地|的)|说到底|归根结底/g,t),
    micro:count(/呼吸.{0,8}(?:滞|停|乱|缓)|指(?:尖|节|骨).{0,10}(?:紧|白|颤|停)|眼神.{0,8}(?:暗|沉|顿)|睫毛.{0,6}颤|喉结|抿唇|移开视线/g,t),
    closure:count(/这一刻|从这一刻|第一次在|终于(?:明白|意识到|承认|松开)|无需多言|不言而喻|一切都/g,tail),
    relation_words:count(/关系|靠近|信任|防备|防线|心软|依赖|归属|被看见|理解加深|不可逆/g,t),
    hook_words:count(/就在这时|忽然|突然|门外|手机.{0,6}(?:响|震)|新的消息|陌生|异常|秘密/g,t),
    ecot_chars:(raw.match(/<electric>([\s\S]*?)<\/electric>/i)?.[1]||'').length
  };
}

await fs.mkdir(OUT,{recursive:true});
await installSecret();
const tests=[];
for(const scene of scenarios){
  for(const variant of ['baseline','patched']) tests.push({scene,variant});
}
const results=[];
for(let i=0;i<tests.length;i++){
  if(i) await sleep(GG.delayMs); // GG hard limit: 2 RPM => >=30s spacing
  const {scene,variant}=tests[i]; const messages=build(variant,scene);
  const row={scene:scene.id,variant,provider:'GG',model:GG.model,prompt_chars:messages.reduce((n,m)=>n+String(m.content||'').length,0),prompt_messages:messages.length};
  try{Object.assign(row,await generate(messages));row.status=row.content?'ok':(row.reasoning?'reasoning_only':'no_text');row.stats=stats(row.content);}
  catch(e){row.status='exception';row.error=String(e);}
  results.push(row); console.log(`${scene.id} ${variant}: ${row.status} HTTP=${row.http_status} chars=${row.stats?.chars||0} ecot=${row.stats?.ecot_chars||0}`);
}

const report={schema:1,kind:'riyuexi-depattern-core-ab',source:fixture.source_file,scope:fixture.scope_note,real_sillytavern:true,provider:'GG',model:GG.model,rpm_limit:2,delay_ms:GG.delayMs,results};
await fs.writeFile(path.join(OUT,'riyuexi-depattern-ab-v1.json'),JSON.stringify(report,null,2));
for(const r of results) await fs.writeFile(path.join(OUT,`${r.scene}-${r.variant}.txt`),r.content||`ERROR: ${JSON.stringify(r.error)}`);
await fs.writeFile(path.join(OUT,'summary.txt'),results.map(r=>`${r.scene}/${r.variant}: ${r.status} HTTP=${r.http_status} ms=${r.elapsed_ms} prompt=${r.prompt_chars} stats=${JSON.stringify(r.stats||{})}`).join('\n')+'\n');
if(results.some(r=>r.status!=='ok')) process.exitCode=2;
