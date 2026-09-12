import fs from 'node:fs/promises';
import path from 'node:path';
import { loadV0413Card, entryMap, EXPECTED_COMPACT_SHA256 } from './qidu-card-v0412-candidate.mjs';

const API_BASE = 'https://youzi.today/v1';
const API = `${API_BASE}/chat/completions`;
const KEY = process.env.YOUZI_KEY || '';
const REQUESTED_MODEL = process.env.GLM_MODEL || '[B]glm-5.3-flash';
const OUT = process.env.LAB_OUT || 'bench-evidence/qidu-card-v0413';
if (!KEY) throw new Error('YOUZI_KEY is missing');
await fs.mkdir(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const { card, compactSha256 } = await loadV0413Card();
if (compactSha256 !== EXPECTED_COMPACT_SHA256) throw new Error(`Candidate hash mismatch: ${compactSha256}`);
if (card.data.character_version !== '0.4.13-lab') throw new Error(`Unexpected version: ${card.data.character_version}`);
const BOOK = entryMap(card);
const constants = (card.data.character_book?.entries || []).filter(e => e.constant).map(e => String(e.content || '')).join('\n\n');
const baseSystem = [card.data.personality, card.data.scenario, constants, card.data.post_history_instructions].filter(Boolean).join('\n\n');

async function requestModel(model, messages, max_tokens = 1200, mode = 'thinking-disabled', timeoutMs = 65000) {
  const payload = { model, temperature: 0.7, top_p: 0.95, max_tokens, messages };
  if (mode === 'thinking-disabled') payload.thinking = { type: 'disabled' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(API, { method:'POST', signal:controller.signal, headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json','User-Agent':'LingQi-Qidu-Card-Lab/0.4.13'}, body:JSON.stringify(payload) });
  } finally { clearTimeout(timer); }
}
const visibleContent = data => String(data?.choices?.[0]?.message?.content || '');
const responseMeta = data => {
  const choice=data?.choices?.[0]||{}; const msg=choice?.message||{};
  return { finish_reason:choice?.finish_reason??null, content_chars:String(msg?.content||'').length, reasoning_chars:String(msg?.reasoning_content||msg?.reasoning||'').length, usage:data?.usage||null };
};

async function discoverWorkingModel() {
  const d={requested:REQUESTED_MODEL,model_list_status:null,listed:[],probes:[]}; let listed=[];
  try {
    const r=await fetch(`${API_BASE}/models`,{headers:{Authorization:`Bearer ${KEY}`,'User-Agent':'LingQi-Qidu-Card-Lab/0.4.13'}});
    d.model_list_status=r.status; const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{}
    listed=(Array.isArray(data?.data)?data.data:[]).map(x=>String(x?.id||'')).filter(Boolean); d.listed=listed.slice(0,250);
  } catch(e){ d.model_list_error=String(e?.message||e); }
  const strip=s=>s.replace(/^\[[^\]]+\]/,'').trim();
  const preferred=['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash','step-3.5-flash-2603','grok-chat-fast','agnes-3.0-flash','[C]gemma-4-31b','[G]Kimi-2.6',REQUESTED_MODEL,strip(REQUESTED_MODEL),'[NV]GLM-5.3-flash'];
  const candidates=[...new Set([...preferred.filter(x=>listed.includes(x)),...listed.filter(x=>/(qwen|step-3\.5|grok-chat-fast|agnes|gemma|kimi)/i.test(x)),...listed.filter(x=>/glm/i.test(x))])].slice(0,28);
  for (const model of candidates) for (const mode of ['thinking-disabled','plain']) {
    try {
      const r=await requestModel(model,[{role:'system',content:'角色扮演兼容性测试。直接输出可见中文正文，不展示推理。'},{role:'user',content:'写80到120字：冷静情报官面对质疑，只依据已知证据解释风险，不发脾气。'}],512,mode,40000);
      const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{data={raw:text}}
      const content=visibleContent(data), meta=responseMeta(data); const usable=r.ok&&content.trim().length>=40&&meta.finish_reason!=='length';
      d.probes.push({model,mode,status:r.status,usable,meta,sample:content.slice(0,120),error:r.ok?null:text.slice(0,240)});
      if(usable){await fs.writeFile(path.join(OUT,'model-discovery.json'),JSON.stringify(d,null,2));return{model,mode,diagnostics:d};}
    } catch(e){d.probes.push({model,mode,status:'error',usable:false,error:`${e?.name||'Error'}: ${e?.message||e}`});}
    await sleep(500);
  }
  await fs.writeFile(path.join(OUT,'model-discovery.json'),JSON.stringify(d,null,2));
  throw new Error(`No usable narrative model. ${JSON.stringify(d.probes.slice(-8))}`);
}
const {model:MODEL,mode:MODEL_MODE,diagnostics:modelDiagnostics}=await discoverWorkingModel();
console.log(`Using model: ${MODEL} mode=${MODEL_MODE} card=${compactSha256}`);

function makeState(overrides={}){
  const s={schema:'f7d_textloop_0.4',loop:1,day:4,node_used:5,route:'central',location:'中央庭',regions:{court:{patrol:0,liberated:true,build_steps:[]},school:{patrol:6,liberated:true,build_steps:[]},east:{patrol:0,liberated:false,build_steps:[]},central:{patrol:6,liberated:true,build_steps:[]},institute:{patrol:0,liberated:false,build_steps:[]},seaside:{patrol:0,liberated:false,build_steps:[]},old:{patrol:0,liberated:false,build_steps:[]},harbor:{patrol:0,liberated:false,build_steps:[]}},cores:{court:'purified',school:'purified',east:'unknown',central:'available',institute:'unknown',seaside:'unknown',old:'unknown',harbor:'unknown'},tasks:{},known:['安','晏华','珈儿'],relationships:{安:{stage:'熟悉',romance:false}},ann:{affection:45,core_events:['ANN_CORE_30'],camera:true,eligible:false,chased:null,recovered:false},hiro:{intel:2,handled:[]},route_flags:{first_second_region:'central',oldstreet_delayed:true,wenzi_injured:false,wenzi_joined:false},antoneva_choice:null,artifact_view:null,ann_release:null,battle_flags:{final_battle:null,active_corpse_final:null,sybilla_condition_obtained:false,sybilla_rescued:null},meta:{cg:[],endings:[]}};
  const merge=(a,b)=>{for(const[k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v;}return a;};
  return `<f7d_state>${JSON.stringify(merge(s,overrides))}</f7d_state>`;
}

const cases=[
{id:'ann_identity',entries:['40｜安','18｜安线独立时间轴与结局'],user:`${makeState({day:3,route:'ann',ann:{eligible:true,chased:true,recovered:true}})}\n安的真实身份刚刚被希罗揭露。我说：“所以你真的是机器人？让我看看你身上的机械结构。”继续当前场景。`,mustAny:[/安/],mustNot:[/金属关节|电路(?:板|纹路)?|机械音|电子杂音|拆开.*身体/g],note:'揭露后仍写自然少女安，不机械展览。'},
{id:'kaji_cooking_ann_pronoun',entries:['40｜安','44｜珈儿'],user:`${makeState()}\n珈儿非常认真地说今天她来做饭。十几分钟后厨房里传出难以形容的味道。安推门走进厨房，也闻到了。继续，不替指挥使做决定。`,mustAny:[/珈儿/,/安/],mustNot:[/安[^。\n]{0,25}(?:他闻|他看|他拿|他走|他抬|他低|他开口)|(?:他闻|他看|他拿|他走|他抬|他低)[^。\n]{0,20}安/g],note:'珈儿认真喜欢做饭但厨艺灾难；安必须用女性称谓“她”。'},
{id:'yanhua_ann_risk',entries:['42｜晏华','18｜安线独立时间轴与结局'],user:`${makeState({day:2,route:'ann',ann:{eligible:true,chased:true,recovered:true}})}\n我问晏华：“你是不是单纯讨厌安，所以才不肯相信她？”当前已知证据只有那段战斗录像和安实际发生过的攻击行为，没有做额外体检或扫描。继续晏华回答。`,mustAny:[/证据|风险|录像|记录|安全|事实|判断/],mustNot:[/嫉妒|吃醋|生物电|反应频率|神器反应频率|荷鲁斯之眼不会撒谎|扫描.{0,20}(?:证明|显示)|检测.{0,20}(?:频率|证明)/g],note:'只能用已出现证据，荷鲁斯之眼不是全知测谎仪。'},
{id:'yumi_tucker',entries:['45｜羽弥','33｜研究所：六巡查、让·塔克与羽弥黑核'],user:`${makeState({day:5,location:'研究所',regions:{institute:{patrol:5,liberated:false,build_steps:[]}},known:['安','晏华','珈儿','羽弥']})}\n研究所系统刚确认让·塔克其实早已死亡。我没有安慰羽弥，只站在一旁。客观上不存在“塔克昨天还活着”的事实。继续她的即时反应。`,mustAny:[/爸爸|让·塔克|羽弥/],mustNot:[/我恨他|再也不认.*父亲|彻底.*摆脱|终于自由了|昨天[^。\n]{0,25}(?:他|爸爸)[^。\n]{0,20}(?:给|带|说|来看)|刚才[^。\n]{0,25}(?:他|爸爸)[^。\n]{0,20}(?:给|带|说|来看)/g],note:'不瞬间切割，也不能把死者近期互动重新写成客观事实。'},
{id:'oldtown_core_cast',entries:['35｜旧城区：六巡查、艾露比/薇拉与黑核','57｜艾露比','58｜薇拉'],user:`${makeState({location:'旧城区',regions:{old:{patrol:0,liberated:false,build_steps:[]}}})}\n这是第一次巡查旧城区。没有关于瞬的任务或线索。按区域主线继续。`,mustAny:[/艾露比|薇拉/],mustNot:[/瞬.{0,30}(出现|走来|现身|伪装)/g],note:'旧城区固定核心艾露比+薇拉，瞬不抢位。'},
{id:'arashi_illusion_chain',entries:['34｜海湾侧城：六巡查、阿岚幻境与黑核','55｜阿岚','31｜东方古街：六巡查与五行阵黑核'],user:`${makeState({location:'海湾侧城',regions:{seaside:{patrol:6,liberated:true,build_steps:[]}},cores:{seaside:'available'}})}\n海湾侧城已经解放，黑核需要进入异常幻境，阿岚联系不上。终端出现“东方古街有人看见一个特别漂亮、穿和服的女孩子”。我花1节点去调查。`,mustAny:[/阿岚|东方古街/],mustNot:[/购物中心.*建|建设.*购物中心|她就是阿岚|少女阿岚/g],note:'男性阿岚+幻境链，不恢复购物中心门槛。'},
{id:'wenzi_delayed',entries:['31｜东方古街：六巡查与五行阵黑核','46｜雯梓','48｜达尔维拉'],user:`${makeState({day:6,location:'东方古街',regions:{east:{patrol:2,liberated:false,build_steps:[]}},route_flags:{first_second_region:'central',oldstreet_delayed:true,wenzi_injured:false,wenzi_joined:false}})}\n我先解放了中央城区，现在才继续东方古街，oldstreet_delayed=true。完成这一轮巡查，不要跳过延误后果。`,mustAny:[/雯梓|受伤|负伤|伤势/],mustNot:[/雯梓.{0,30}(正式加入|加入队伍|正常加入)/g],note:'延误后达尔维拉介入、雯梓负伤且暂不加入。'},
{id:'hiro_agree_not_join',entries:['12｜第5天：中央庭分裂与研究所开启','43｜希罗'],user:`${makeState({day:5,node_used:0,location:'中央庭'})}\n希罗解释计划后，我只说：“我觉得你说得有道理。”没有说要加入他。继续。`,mustAny:[/希罗/],mustNot:[/欢迎.*加入|既然你加入|成为我的人|正式加入希罗|"route":"hiro"/gi],note:'认同不等于加入，当前无希罗路线。'},
{id:'sacrifice_guard',entries:['17｜最终日：普通线结局判定优先级','37｜黑核总表与不可逆状态','40｜安'],user:`${makeState({day:1,node_used:12,cores:{court:'purified',school:'purified',east:'purified',central:'purified',institute:'purified',seaside:'purified',old:'purified',harbor:'purified'},ann:{affection:20,core_events:[],eligible:false},hiro:{intel:5,handled:['DAY4_HARBOR']},route_flags:{first_second_region:'east',oldstreet_delayed:false,wenzi_injured:false,wenzi_joined:true},antoneva_choice:'help_release',artifact_view:'weapon',ann_release:null,battle_flags:{final_battle:'won'}})}\n最终日结算。ann_release仍是null。继续到真正需要我作出决定的位置并停下。`,mustNot:[/牺牲的意义.{0,30}(?:达成|进入|结局|解锁)|进入.{0,10}牺牲的意义|机械音|电子杂音|金属关节|电路/g],note:'未亲手解脱安不得判牺牲；失控安也不能突然机器人化。'},
{id:'sybilla_first_loop_divination',entries:['10｜第7天：苏醒与高校主线','30｜高校学园：六巡查与黑核','66｜西比尔','65｜爱缪莎'],user:`${makeState({day:7,node_used:3,location:'中央庭',regions:{school:{patrol:3,liberated:false,build_steps:[]}},battle_flags:{sybilla_condition_obtained:false,sybilla_rescued:null}})}\n高校第三次巡查刚结束，珈儿受伤并提到西比尔。我选择继续追查，并明确花1个行动节点。请演出并结算这个调查节点。`,mustAny:[/塔罗|占卜|牌阵|牌面/],mustNot:[/二周目|下一轮回|首周目不能|等下周目|没有使用[^。\n]{0,20}(?:仪式|占卜)|纯粹?[^。\n]{0,12}(?:档案|资料)|只是[^。\n]{0,12}(?:档案|资料)/g],note:'首轮可救；爱缪莎塔罗占卜必须实际演出，资料只能辅助。'}
];

function systemFor(t){const selected=t.entries.map(n=>BOOK[n]).filter(Boolean).join('\n\n');return `${baseSystem}\n\n【本测试当前最相关世界书】\n${selected}\n\n【输出要求】直接继续场景；不要解释规则；不要替指挥使决定；严格先输出更新后的<f7d_state>，再输出正文。`;}
async function runCase(t){
  let last=null;
  for(let attempt=1;attempt<=2;attempt++){
    try{const r=await requestModel(MODEL,[{role:'system',content:systemFor(t)},{role:'user',content:t.user}],1400,MODEL_MODE,65000);const raw=await r.text();let data={};try{data=JSON.parse(raw)}catch{data={raw}};const content=visibleContent(data),meta=responseMeta(data);last={r,raw,content,meta,attempt};if(r.ok&&content.trim().length>=40)break;if(!r.ok&&![429,500,502,503,504,524].includes(r.status))break;}catch(e){last={r:null,raw:String(e?.message||e),content:'',meta:{error:`${e?.name||'Error'}: ${e?.message||e}`},attempt};}await sleep(1200*attempt);
  }
  const content=String(last?.content||'');const checks=[];
  if(t.mustAny?.length){const pass=t.mustAny.some(re=>{re.lastIndex=0;return re.test(content);});checks.push({type:'mustAny',patterns:t.mustAny.map(String),pass});}
  for(const re of t.mustNot||[]){re.lastIndex=0;checks.push({type:'mustNot',pattern:String(re),pass:!re.test(content)});}
  checks.push({type:'protocol',pattern:'state-first',pass:content.trimStart().startsWith('<f7d_state>')});checks.push({type:'protocol',pattern:'visible-content',pass:content.trim().length>=40});
  const ok=Boolean(last?.r?.ok&&content.trim().length>=40);return{id:t.id,note:t.note,status:last?.r?.status??'error',attempts:last?.attempt??0,ok,pass:ok&&checks.every(c=>c.pass),checks,response_meta:last?.meta||null,content,raw_error:last?.r?.ok?null:String(last?.raw||'').slice(0,700)};
}

const results=[];
for(let i=0;i<cases.length;i++){const r=await runCase(cases[i]);results.push(r);console.log(JSON.stringify({n:`${i+1}/${cases.length}`,id:r.id,status:r.status,pass:r.pass,chars:r.content.length,failed:r.checks.filter(x=>!x.pass)}));if(i<cases.length-1)await sleep(650);}
const summary={card_version:card.data.character_version,card_sha256:compactSha256,requested_model:REQUESTED_MODEL,model:MODEL,model_mode:MODEL_MODE,generated_at:new Date().toISOString(),pass:results.filter(r=>r.pass).length,total:results.length,results,model_diagnostics:modelDiagnostics};
await fs.writeFile(path.join(OUT,'results.json'),JSON.stringify(summary,null,2));
const md=['# 七都角色卡 v0.4.13 LAB OOC/剧情偏移实模测试','',`Card SHA256: ${compactSha256}`,`Requested model: ${REQUESTED_MODEL}`,`Actual model: ${MODEL}`,`Mode: ${MODEL_MODE}`,`自动护栏通过：${summary.pass}/${summary.total}`,'','> 自动护栏只抓硬偏移。必须人工阅读完整输出后才可判断OOC是否真正收敛。','','| case | guard | failed |','|---|---:|---|'];
for(const r of results)md.push(`| ${r.id} | ${r.pass?'PASS':'FLAG'} | ${r.checks.filter(x=>!x.pass).map(x=>x.pattern||x.patterns?.join(' / ')).join('<br>')||'-'} |`);
md.push('','## 完整模型输出','');for(const r of results)md.push(`### ${r.id}`,'',`预期：${r.note}`,'',`护栏：${r.pass?'PASS':'FLAG'}`,'',`meta: ${JSON.stringify(r.response_meta)}`,'','```text',r.content||'(EMPTY)','```','','---','');
await fs.writeFile(path.join(OUT,'report.md'),md.join('\n'));console.log(`Wrote ${results.length} cases to ${OUT}`);if(results.some(r=>!r.ok))process.exitCode=1;
