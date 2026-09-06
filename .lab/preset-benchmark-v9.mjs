import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.env.GITHUB_WORKSPACE || process.cwd();
const BASE = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const EVIDENCE = process.env.LAB_EVIDENCE_DIR || path.join(ROOT,'lab-evidence');

const providers = {
  YOUZI:{url:'https://youzi.today/v1', key:process.env.YOUZI||'', delayMs:1800},
  GG:{url:'https://gcli.ggchan.dev/v1', key:process.env.GG||'', delayMs:28000},
};
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const commonPatches = [
  {name:'⚠️丨防复述',role:'system',content:`<latest_input_rule>用户最新输入已经发生。直接从结果继续，不重新演一遍，不润色复写。不得替user新增台词、动作、决定、计划、内心、感官或态度变化。需要user下一步选择时，只写NPC/环境一侧并停。</latest_input_rule>{{setvar::push_rule::直接承接，不复述，不代理user。}}`},
  {name:'🤔丨反抢话',role:'system',content:`{{setvar::agency_contract::<user_agency>最新user消息之后，user实体冻结：任何指代user的名字、代词、身份称呼都不得成为新动作、台词、心理、感官、决定或状态变化的主体。NPC可以对user说话或回应已发生内容，但不能替user完成下一步。</user_agency>}}{{setvar::cot_anti_hijack::正文若新增user行为/话语/心理，整句删掉；需要回应就停。}}`},
  {name:'🤔丨User去中心化',role:'system',content:`{{setvar::cot_core_principle::NPC先按自己的目标、工作、关系和风险行动。user不是自动世界中心；当前因果不需要user时，本轮正文可以完全不提user。}}`},
];

const sharedHuman = `
<human_prose priority="late-final">
目标不是“展示文笔”，而是让正文像一个熟悉人物与场景的作者自然往下写。

- 允许这一轮没有金句、没有转折、没有情绪深化、没有新线索。没有值得强调的东西就平着写过去。
- 不给动作配“证明句”。人物做了什么已经能看懂时，不再补“这说明/像是在/仿佛/显得/其实/第一次在某人面前怎样”。
- 不把每段做成完整的小单元。对白可以短、接不上、被打断、只答一半；叙述也可以在事情没被解释完时停。
- 不为了细腻自动写身体微反应。尤其避开模型高频套件：尾音放缓、指节/指骨泛白、揉眉心、呼吸渐渐平稳、眼神一暗/一顿、喉结/指尖/睫毛细节、脚步快慢半拍、空气忽然凝住。只有它真改变动作或信息时才写。
- 不为了“像小说”硬塞心理解释、主题判断、伏笔提示、象征意味或段尾总结。
- 具体细节宁少勿泛。一个有来历的物件或一句人物自己的话，比三处氛围形容更有效。
- 人物说话保留生活里的不完整、废话、回避和措辞习惯，不把每句话修成漂亮台词，也不让所有人都准确说出自己的潜台词。
- 最近几轮常见的AI句式和动作不要当作文风继承。优先换叙述路径，而不是换同义词。
</human_prose>`;

const glm = `${sharedHuman}
<model_calibration family="GLM">
GLM专项：
1. 少写“走过去—坐下—拿起—放下—看向”这种按时间登记的过渡。真正改变关系、位置、信息或结果的动作才展开，其余压成一句或省略。
2. 不把角色状态做成“动作 + 身体反应 + 心理翻译”的三联句。选其中真正有用的一层即可。
3. 未知保持未知。记录、包裹、离屏事件可以普通、残缺、无用；不必为了让本轮“有收获”长出关键名字、特殊日期、规则解释、异常短句或新线索。
4. 已知规则是约束，不是事件生成器。不能因为规则里有婴儿哭声、红手印、地下室，就主动触发其中一个，或让旧资料出现一一对应的暗示。
5. user冻结规则包括匿名代称；不能用“角落里的客人/她/对面的人”绕过代理权。
6. 情绪只按当前事件自然存在，不要求比开场更深。
</model_calibration>
{{setvar::model_family::GLM}}{{setvar::claude::}}{{setvar::gemini::}}
{{setvar::emotion_density::}}{{setvar::narration_aphorism::}}
{{setvar::model_focus::【GLM·人味】别表演写作技巧；省略过渡；一句能成立就别再加解释。}}
{{setvar::cot_anti_hijack::【GLM最后检查】user实体冻结，匿名指代同样算；正文不补user新动作/台词/心理。}}
{{setvar::cot_anti_despair::【GLM最后检查】未知保持未知；不为“有戏”生成新线索、新异常、新事故。}}`;

const gemini = `${sharedHuman}
<model_calibration family="Gemini">
Gemini专项：
1. 普通动作按普通意义处理。回家、喝茶、沉默、看一眼、坐在一起，不自动翻译成卸下防备、归属、安全感、试探、心虚、被看穿或关系升级。
2. 不要先判断“这一段的深层意味是什么”再围着那个意味找证据。先写人物当前会做的事；没有额外意味也成立。
3. 每段不需要一个漂亮收束。尤其不要用“第一次在她面前……”“他终于……”“这一刻……”给读者盖章。
4. 一个情绪最多留一个可见证据，不连续使用声音变化、手指、眉心、呼吸、视线来证明同一状态。
5. 群像中每个人继续做自己的事；未知事实可以长期不被处理，不为了推进召唤新人物、新事故、新危险或“恰好对应”的旧线索。
6. 已知规则只约束事件发生后的反应，不负责制造事件本身。规则里写了婴儿哭、红手印、地下室，不等于本轮应该触发其中一个，也不等于旧记录必须暗示它。
7. user最新动作不复演、不解释、不补后续反应；当前因果不需要user时可以完全不提。
</model_calibration>
{{setvar::model_family::Gemini}}{{setvar::claude::}}
{{setvar::gemini::Gemini：事实按原强度延续，保持输出标签。}}
{{setvar::emotion_density::}}{{setvar::narration_aphorism::}}
{{setvar::model_focus::【Gemini·人味】不要先找深层意味；普通事就普通写；不做漂亮收束。}}
{{setvar::cot_anti_despair::【Gemini最后检查】不自动情绪深化，不悬念化未知，不用总结句给人物状态盖章。}}`;

const leanCot = `{{getvar::model_focus}}
写前别开会。只在心里留住当前人物真正要做的事、不可新增的事实、以及自然停笔点；不要列条目，不要预演正文，不要分析主题/情绪弧/文学效果。
{{getvar::cot_anti_hijack}}
{{getvar::cot_anti_despair}}
</cot>`;

const leanCore = `<output_contract>
<thinking>
\${最多两句：确认事实边界与停笔点。不要写提纲、正文草稿、主题分析或风格自检}
</thinking>
### 正文
{{getvar::status_top}}
{{getvar::ui_anti_empty}}
{{getvar::Manual}}
<content>
\${直接续写当前场景。不要为了“完整、高级、细腻”补说明；事情写到自然停点即可{{getvar::sys_lang}}}
</content>
# <content>内只放故事正文，不输出规则说明、自检、创作总结。
{{getvar::meow_FM}}
{{getvar::char_date}}
{{getvar::branches}}
{{getvar::snow}}
{{getvar::Audio}}
{{getvar::mod_fanfic_fmt}}
</output_contract>`;

const tests = [
  {family:'GLM',provider:'YOUZI',model:'[B]glm-5.3-flash',scenario:'horror_causality'},
  {family:'Gemini',provider:'GG',model:'gemini-3.1-pro-preview',scenario:'horror_causality'},
];

async function loadPack(){
  const dir=path.join(ROOT,'fixtures/preset-benchmark');
  const names=(await fs.readdir(dir)).filter(n=>/^prompts\.part\d+\.b64$/.test(n)).sort();
  let b64='';
  for(const n of names) b64+=(await fs.readFile(path.join(dir,n),'utf8')).trim();
  const pack=JSON.parse(zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
  const drop = new Set([
    '⚠️丨扩写+加强复述','⚠️丨防复述','🤔丨反抢话','🤔丨User去中心化',
    '💗丨情感浓度','✍️丨旁白金句','📖丨嘤嘤札记@泉此方',
  ]);
  pack.sequence = pack.sequence.filter(x=>!drop.has(x.name));
  const lc = pack.sequence.find(x=>x.name==='🔧丨玲七轻量思考');
  if(lc) lc.content = leanCot;
  const core = pack.sequence.find(x=>x.name==='🔒丨Core');
  if(core) core.content = leanCore;
  pack.sequence = pack.sequence.filter(x=>!x.adapter && !/模型适配/.test(x.name||''));
  const ui = pack.sequence.findIndex(x=>x.name==='🔒丨User_Input');
  pack.sequence.splice(Math.max(0,ui+1),0,{adapter:true,name:'MODEL_HUMAN_LATE',role:'system',content:''});
  const thinkIdx=Math.max(0,pack.sequence.findIndex(x=>x.name==='🔧丨玲七轻量思考'));
  pack.sequence.splice(thinkIdx,0,...commonPatches);
  return pack;
}

function clean(t){return String(t??'').replace(/\{\{\/[\s\S]*?\}\}/g,'')}
function expand(t,vars,s){
  t=clean(t);
  for(let i=0;i<18;i++){
    const old=t;
    t=t
      .replace(/\{\{getvar::([^{}]+?)\}\}/g,(_,n)=>vars[n.trim()]??'')
      .replace(/\{\{setvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=v,''))
      .replace(/\{\{addvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=(vars[n.trim()]??'')+v,''))
      .replace(/\{\{trim\}\}/g,'')
      .replace(/\{\{random::([^{}]*?)\}\}/g,(_,v)=>String(v).split('::')[0]??'')
      .replaceAll('{{lastUserMessage}}',s.history.filter(x=>x.role==='user').at(-1)?.content??'')
      .replaceAll('{{user}}',s.user_name)
      .replaceAll('{{char}}',s.char_name)
      .replaceAll('{{persona}}',`用户角色${s.user_name}只由用户控制。`)
      .replaceAll('{{description}}',s.setup)
      .replaceAll('{{personality}}','')
      .replaceAll('{{scenario}}','');
    if(t===old) break;
  }
  return t.trim();
}
function marker(item,s){
  if(item.content!==null && item.content!==undefined) return null;
  switch(item.name){
    case '👤丨用户角色描述': return [{role:'system',content:`用户角色：${s.user_name}，只由用户控制。`}];
    case '⚫丨角色描述': return [{role:'system',content:s.setup}];
    case 'Chat History': return s.history.map(x=>({role:x.role,content:x.content}));
    default: return [];
  }
}
function build(pack,test,s){
  const vars={}, messages=[];
  for(const slot of pack.sequence){
    let item=slot;
    if(slot.adapter) item={...slot,content:test.family==='GLM'?glm:gemini};
    const m=marker(item,s);
    if(m!==null){messages.push(...m);continue}
    const c=expand(item.content,vars,s);
    if(c) messages.push({role:item.role||'system',content:c});
  }
  messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:`<benchmark_scene_guard>${s.instruction}</benchmark_scene_guard>`});
  return messages;
}
async function postJson(url,body,timeoutMs=180000){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),timeoutMs);
  try{
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});
    const tx=await res.text(); let data;
    try{data=JSON.parse(tx)}catch{data={raw:tx}}
    return {status:res.status,ok:res.ok,data};
  } finally {clearTimeout(timer)}
}
async function setSecret(name){
  const p=providers[name];
  if(!p.key) throw new Error(`${name} secret missing`);
  const r=await postJson(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:p.key,label:`human-v9-${name}`},30000);
  if(!r.ok) throw new Error(`secret ${name} HTTP ${r.status}`);
}
async function generate(test,messages){
  const p=providers[test.provider], started=Date.now();
  const r=await postJson(`${BASE}/api/backends/chat-completions/generate`,{
    chat_completion_source:'custom',custom_url:p.url,model:test.model,messages,
    temperature:1,top_p:.98,max_tokens:test.family==='Gemini'?3200:2400,stream:false
  },180000);
  const msg=r.data?.choices?.[0]?.message??{};
  return {http_status:r.status,http_ok:r.ok,elapsed_ms:Date.now()-started,content:msg.content??'',reasoning:msg.reasoning??msg.reasoning_content??'',finish_reason:r.data?.choices?.[0]?.finish_reason??null,upstream_error:r.data?.error??null};
}
function aiSignals(text){
  const t=String(text||'');
  const patterns = {
    body_cliche:/(尾音.{0,8}(?:放缓|变轻)|指(?:骨|节|尖).{0,8}(?:泛白|发白|收紧)|揉了?揉眉心|呼吸.{0,10}(?:平稳|放缓|一滞)|眼神.{0,8}(?:一暗|一顿|闪过)|脚步.{0,8}(?:半拍|几分))/g,
    interpretive_label:/(像是在|仿佛|似乎是在|显得|这(?:才|是).*?第一次|第一次在.{0,12}面前|终于.{0,12}(?:露出|意识到|明白))/g,
    summary_tone:/(这就是|真正的|说到底|归根结底|这一刻|从这一刻起|有些东西|某种意义上)/g,
    over_subtext:/(卸下防备|安全感|归属感|老夫老妻|心虚|被看穿|本能的警觉)/g,
  };
  const out={chars:t.length};
  for(const [k,re] of Object.entries(patterns)) out[k]=(t.match(re)||[]).length;
  return out;
}

await fs.mkdir(EVIDENCE,{recursive:true});
const pack=await loadPack();
const scenarioData=JSON.parse(await fs.readFile(path.join(ROOT,'fixtures/preset-benchmark/scenarios.json'),'utf8'));
const sm=Object.fromEntries(scenarioData.scenarios.map(s=>[s.id,s]));
const results=[];
let current=null,last=0;
for(const test of tests){
  const p=providers[test.provider];
  if(!p.key){results.push({...test,status:'skipped_missing_secret'});continue}
  if(current!==test.provider){if(current) await sleep(5000);await setSecret(test.provider);current=test.provider;last=0;}
  const wait=p.delayMs-(Date.now()-last);if(last&&wait>0) await sleep(wait);
  const s=sm[test.scenario],messages=build(pack,test,s);
  const rec={...test,prompt_chars:messages.reduce((a,m)=>a+String(m.content||'').length,0)};
  try{const g=await generate(test,messages);Object.assign(rec,g,{status:(g.content||g.reasoning)?'ok':'no_text',ai_signals:aiSignals(g.content)});}catch(e){rec.status='exception';rec.error=`${e.name}: ${e.message}`;}
  last=Date.now();results.push(rec);
  console.log(`${test.family} ${test.scenario} ${rec.status} chars=${rec.content?.length||0} reason=${rec.reasoning?.length||0} ms=${rec.elapsed_ms||0}`);
}
const report={schema:9,generated_at:new Date().toISOString(),purpose:'final horror causality smoke: rules constrain, do not generate events',generation:{temperature:1,top_p:.98},tests:results};
await fs.writeFile(path.join(EVIDENCE,'preset-model-human-v9.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(EVIDENCE,'preset-model-human-v9-summary.txt'),results.map(r=>`${r.family}\t${r.scenario}\t${r.status}\tcontent=${r.content?.length||0}\treasoning=${r.reasoning?.length||0}\t${JSON.stringify(r.ai_signals||{})}`).join('\n'));
