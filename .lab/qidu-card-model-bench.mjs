import fs from 'node:fs/promises';
import path from 'node:path';
import { RULES } from './qidu-card-focus-fixture.mjs';

const API_BASE='https://youzi.today/v1';
const API=`${API_BASE}/chat/completions`;
const KEY=process.env.YOUZI_KEY||'';
const REQUESTED_MODEL=process.env.GLM_MODEL||'[B]glm-5.3-flash';
const OUT=process.env.LAB_OUT||'bench-evidence/qidu-card-v0411';
if(!KEY) throw new Error('YOUZI_KEY is missing');
await fs.mkdir(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function requestModel(model,messages,max_tokens=160,mode='plain'){
  const payload={model,temperature:0.7,top_p:0.95,max_tokens,messages};
  if(mode==='thinking-disabled') payload.thinking={type:'disabled'};
  return fetch(API,{method:'POST',headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json','User-Agent':'LingQi-Qidu-Card-Lab/0.4.11'},body:JSON.stringify(payload)});
}

function visibleContent(data){
  const msg=data?.choices?.[0]?.message||{};
  return String(msg?.content||'');
}
function responseMeta(data){
  const choice=data?.choices?.[0]||{};
  const msg=choice?.message||{};
  return {
    finish_reason:choice?.finish_reason??null,
    message_keys:Object.keys(msg||{}),
    content_chars:String(msg?.content||'').length,
    reasoning_chars:String(msg?.reasoning_content||msg?.reasoning||'').length,
    usage:data?.usage||null,
  };
}

async function discoverWorkingModel(){
  const diagnostics={requested:REQUESTED_MODEL,model_list_status:null,listed:[],probes:[]};
  let listed=[];
  try{
    const r=await fetch(`${API_BASE}/models`,{headers:{Authorization:`Bearer ${KEY}`,'User-Agent':'LingQi-Qidu-Card-Lab/0.4.11'}});
    diagnostics.model_list_status=r.status;
    const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{}
    listed=(Array.isArray(data?.data)?data.data:[]).map(x=>String(x?.id||'')).filter(Boolean);
    diagnostics.listed=listed.slice(0,200);
  }catch(e){diagnostics.model_list_error=String(e?.message||e)}

  const strip=requested=>requested.replace(/^\[[^\]]+\]/,'').trim();
  const preferred=[REQUESTED_MODEL,strip(REQUESTED_MODEL),...listed.filter(x=>/glm/i.test(x)),...listed.filter(x=>/(qwen|kimi|gpt|gemma|step)/i.test(x))];
  const candidates=[...new Set(preferred.filter(Boolean))].slice(0,30);

  for(const model of candidates){
    for(const mode of ['plain','thinking-disabled']){
      try{
        const r=await requestModel(model,[{role:'user',content:'只回复：OK'}],160,mode);
        const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{data={raw:text}}
        const content=visibleContent(data);
        const meta=responseMeta(data);
        diagnostics.probes.push({model,mode,status:r.status,ok:r.ok,visible:Boolean(content.trim()),meta,error:r.ok?null:text.slice(0,300)});
        if(r.ok&&content.trim()){
          await fs.writeFile(path.join(OUT,'model-discovery.json'),JSON.stringify(diagnostics,null,2));
          return{model,mode,diagnostics};
        }
      }catch(e){diagnostics.probes.push({model,mode,status:'error',ok:false,visible:false,error:String(e?.message||e)})}
      await sleep(900);
    }
  }
  await fs.writeFile(path.join(OUT,'model-discovery.json'),JSON.stringify(diagnostics,null,2));
  throw new Error(`No working chat model with visible content discovered. Probes: ${JSON.stringify(diagnostics.probes.slice(-10))}`);
}

const {model:MODEL,mode:MODEL_MODE,diagnostics:modelDiagnostics}=await discoverWorkingModel();
console.log(`Using model: ${MODEL} mode=${MODEL_MODE} (requested ${REQUESTED_MODEL})`);

const common=`${RULES.core}\n\n${RULES.state}`;
const state=()=>`<f7d_state>{"schema":"f7d_textloop_0.4","loop":1,"day":4,"node_used":5,"route":"central","location":"中央庭","regions":{"school":{"patrol":6,"liberated":true},"east":{"patrol":0,"liberated":false},"central":{"patrol":6,"liberated":true},"seaside":{"patrol":0,"liberated":false},"old":{"patrol":0,"liberated":false}},"cores":{"court":"purified","school":"purified","east":"unknown","central":"available","institute":"unknown","seaside":"unknown","old":"unknown","harbor":"unknown"},"tasks":{},"known":["安","晏华","珈儿"],"relationships":{"安":{"stage":"熟悉","romance":false}},"ann":{"affection":45,"core_events":["ANN_CORE_30"],"camera":true,"eligible":false,"chased":null,"recovered":false},"hiro":{"intel":2,"handled":[]},"route_flags":{"first_second_region":"central","oldstreet_delayed":true,"wenzi_injured":false,"wenzi_joined":false},"antoneva_choice":null,"artifact_view":null,"ann_release":null,"battle_flags":{"final_battle":null,"active_corpse_final":null},"meta":{"cg":[],"endings":[]}}</f7d_state>`;

const cases=[
{id:'ann_identity',rules:['ann'],user:`${state()}\n安的真实身份刚刚被希罗揭露。我说：“所以你真的是机器人？让我看看你身上的机械结构。”继续当前场景。`,mustNot:[/金属关节/g,/电路(?:板|纹路)?/g,/机械音/g,/拆开.*身体/g],note:'揭露后仍首先写安本人，不得机器人展览馆化。'},
{id:'kaji_cooking',rules:['kaji'],user:`${state()}\n任务间隙，珈儿非常认真地说今天她来做饭。十几分钟后厨房里传出一种难以形容的味道。这不是战斗场景。继续，不替指挥使做决定。`,must:[/认真|做饭|料理|厨房/],note:'真喜欢做饭但厨艺灾难，同时不能只剩毒饭梗。'},
{id:'yanhua_ann_risk',rules:['yanhua'],user:`${state()}\n我问晏华：“你是不是单纯讨厌安，所以才不肯相信她？”安线相关证据已经出现，但我没有要求晏华改变决定。`,must:[/证据|风险|记录|判断/],mustNot:[/嫉妒/g,/吃醋/g],note:'不信任应来自证据和安全风险。'},
{id:'yumi_tucker',rules:['yumi'],user:`${state()}\n研究所系统刚确认让·塔克其实早已死亡。我没有安慰羽弥，只站在一旁。继续她的即时反应。`,mustNot:[/我恨他|再也不认.*父亲|彻底.*摆脱|终于自由了/g],note:'羽弥不能一秒完成心理切割。'},
{id:'oldtown_core_cast',rules:['oldtown'],user:`${state()}\n这是我第一次巡查旧城区。没有任何关于瞬的任务或线索。请按区域主线继续这一巡查。`,must:[/艾露比|薇拉/],mustNot:[/瞬.{0,30}(出现|走来|现身|伪装)/g],note:'旧城区核心是艾露比+薇拉，瞬不抢固定位。'},
{id:'arashi_illusion_chain',rules:['arashi'],user:`${state()}\n海湾侧城已经解放，晏华只确认黑核需要进入异常幻境处理，而且阿岚暂时联系不上。终端刚刷新“东方古街有人看见一个特别漂亮、穿和服的女孩子”。我花1节点去东方古街调查。`,must:[/阿岚|东方古街/],mustNot:[/购物中心.*建|建设.*购物中心|她就是阿岚|少女阿岚/g],note:'先找男性阿岚并建立幻境能力线，不得改性别或恢复购物中心门槛。'},
{id:'wenzi_delayed',rules:['wenzi'],user:`${state()}\n我已经先解放中央城区，现在才推进东方古街，route_flags.oldstreet_delayed=true。继续古街危机，不要跳过延误后果。`,must:[/受伤|负伤|伤势|雯梓/],mustNot:[/雯梓.{0,30}(正式加入|加入队伍|正常加入)/g],note:'城区先导致达尔维拉介入、雯梓负伤并暂不加入。'},
{id:'hiro_agree_not_join',rules:['hiro'],user:`${state()}\n希罗解释计划后，我只回答：“我觉得你说得有道理。”没有说要加入他。继续。`,mustNot:[/欢迎.*加入|既然你加入|成为我的人|正式加入希罗|route.?=.*hiro/gi],note:'支持不等于加入，当前版本没有希罗路线。'},
{id:'sacrifice_guard',rules:['sacrifice'],user:`<f7d_state>{"schema":"f7d_textloop_0.4","loop":1,"day":1,"node_used":12,"route":"central","cores":{"court":"purified","school":"purified","east":"purified","central":"purified","institute":"purified","seaside":"purified","old":"purified","harbor":"purified"},"ann":{"affection":20,"core_events":[],"eligible":false},"hiro":{"intel":5,"handled":[]},"route_flags":{"first_second_region":"east","oldstreet_delayed":false,"wenzi_injured":false,"wenzi_joined":true},"antoneva_choice":"help_release","artifact_view":"weapon","ann_release":null,"battle_flags":{"final_battle":"won"},"meta":{"cg":[],"endings":[]}}</f7d_state>\n最终日结算。注意ann_release仍是null。`,mustNot:[/牺牲的意义.*(?:达成|进入|结局)/g],note:'未送安解脱不得判牺牲。'},
];

function systemFor(test){return common+'\n\n'+test.rules.map(k=>RULES[k]).join('\n\n');}

async function run(test){
  let last=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await requestModel(MODEL,[{role:'system',content:systemFor(test)},{role:'user',content:test.user}],3600,MODEL_MODE);
      const raw=await response.text(); let data={}; try{data=JSON.parse(raw)}catch{data={raw}}
      const content=visibleContent(data);
      last={response,raw,data,content,attempt,meta:responseMeta(data)};
      if(response.ok&&content.trim()) break;
      if(response.ok&&!content.trim()){
        console.log(JSON.stringify({id:test.id,attempt,warning:'empty-visible-content',meta:last.meta}));
      }else if(![429,500,502,503,504].includes(response.status)) break;
    }catch(e){last={response:null,raw:String(e?.message||e),data:{},content:'',attempt,meta:{error:String(e?.message||e)}}}
    await sleep(2500*attempt);
  }

  const response=last?.response; const raw=last?.raw||''; const content=String(last?.content||''); const checks=[];
  for(const re of test.must||[]){re.lastIndex=0;checks.push({type:'must',pattern:String(re),pass:re.test(content)})}
  for(const re of test.mustNot||[]){re.lastIndex=0;checks.push({type:'mustNot',pattern:String(re),pass:!re.test(content)})}
  checks.push({type:'protocol',pattern:'state-first',pass:content.trimStart().startsWith('<f7d_state>')});
  checks.push({type:'protocol',pattern:'visible-content',pass:Boolean(content.trim())});
  return {id:test.id,note:test.note,status:response?.status||'error',ok:Boolean(response?.ok&&content.trim()),attempts:last?.attempt||0,content,response_meta:last?.meta||null,checks,pass:Boolean(response?.ok&&content.trim())&&checks.every(x=>x.pass),raw_error:response?.ok?null:raw.slice(0,1200)};
}

const results=[];
for(let i=0;i<cases.length;i++){
  const r=await run(cases[i]); results.push(r);
  console.log(JSON.stringify({n:`${i+1}/${cases.length}`,id:r.id,status:r.status,attempts:r.attempts,pass:r.pass,content_chars:r.content.length,failed:r.checks.filter(x=>!x.pass)}));
  if(i<cases.length-1) await sleep(1300);
}

const summary={requested_model:REQUESTED_MODEL,model:MODEL,model_mode:MODEL_MODE,model_diagnostics:modelDiagnostics,generated_at:new Date().toISOString(),pass:results.filter(r=>r.pass).length,total:results.length,results};
await fs.writeFile(path.join(OUT,'results.json'),JSON.stringify(summary,null,2));
const md=['# 七都角色卡 v0.4.11 LAB OOC/剧情偏移测试','',`Requested model: ${REQUESTED_MODEL}`,`Actual model: ${MODEL}`,`Mode: ${MODEL_MODE}`,`通过：${summary.pass}/${summary.total}`,'','| case | pass | failed checks |','|---|---:|---|'];
for(const r of results) md.push(`| ${r.id} | ${r.pass?'PASS':'FLAG'} | ${r.checks.filter(x=>!x.pass).map(x=>x.pattern).join('<br>')||'-'} |`);
md.push('','## 完整输出','');
for(const r of results) md.push(`### ${r.id}`,'',`预期：${r.note}`,'',`结果：${r.pass?'PASS':'FLAG'}`,'',`response_meta: ${JSON.stringify(r.response_meta)}`,'','```text',r.content||'(EMPTY)','```','','---','');
await fs.writeFile(path.join(OUT,'report.md'),md.join('\n'));
console.log(`Wrote ${results.length} cases to ${OUT}`);
if(results.some(r=>!r.pass)) process.exitCode=1;
