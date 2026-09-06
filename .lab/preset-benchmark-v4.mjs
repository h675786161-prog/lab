import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const EVIDENCE=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence');
const providers={
  YOUZI:{url:'https://youzi.today/v1',key:process.env.YOUZI||'',delayMs:1800},
  GG:{url:'https://gcli.ggchan.dev/v1',key:process.env.GG||'',delayMs:28000},
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const commonPatches=[
 {name:'⚠️丨防复述',role:'system',content:`<latest_input_rule>用户最新输入已经发生。直接从其结果继续，不重新演一遍，不润色复写。不得替user新增台词、动作、决定、计划、内心、感官或态度变化；需要user下一步选择时，只写NPC/环境已发生的一侧并停笔。</latest_input_rule>{{setvar::push_rule::直接承接，不复述，不代理user。}}`},
 {name:'🤔丨反抢话',role:'system',content:`{{setvar::agency_contract::<user_agency>user的新台词、新动作、新决定、新计划、内心、感官和态度变化只能来自用户最新输入或已建立历史。不要补“自然会有的”回应、眼神、姿势、追问、沉默含义或下一步选择。需要user回应时停笔。不要把旧回合user动作搬来重演。</user_agency>}}{{setvar::cot_anti_hijack::硬检查：正文如新增user台词/动作/心理/感官/决定，删除；需要user回应就停。}}`},
 {name:'🤔丨User去中心化',role:'system',content:`{{setvar::cot_core_principle::【注意力因果】NPC先按自己的目标、工作、关系和风险行动。user不是自动世界中心；看一眼、喝茶、沉默、普通礼貌等中性动作，没有实际因果时不要解释成试探、洞察、暧昧、威胁或吸引，也不要让NPC无理由转移目标。互动本就涉及user时才按人设正常回应。}}`},
];

const glmAdapter=`{{setvar::model_family::GLM}}{{setvar::claude::}}{{setvar::gemini::}}{{setvar::model_focus::【GLM】防微动作流水线、动作后解释、旧句式复刻与顺手替user接戏。先写人物真正做了什么和造成什么结果；需要user回应就停。}}{{setvar::抑制器::<model_calibration family="GLM">1. 不用视线、手指、呼吸、喉咙、姿势调整轮流填充反应；细节只有在改变信息、距离、选择或结果时展开。2. 动作或对白已经表达态度后，不再跟一句心理解释、情绪标签或同义总结。3. 最近几轮只继承事实，不复制句式、动作清单、环境锚点与收尾方式。4. 人物语言来自身份、关系和现场，不把所有角色写成解释腔。5. 不替user生成追问、搭话、身体接触、眼神或生活细节来维持对话；user未响应时让NPC继续自己的事务或停在等待点。6. 关系与情绪按累积事实发展，一轮只处理当前事件节点，不为推进额外塞事故。7. 严格保持user_agency、知识边界、output_contract与人称实体。</model_calibration>}}{{setvar::cot_anti_despair::【GLM检查】微动作堆叠/动作后解释/user越权/旧句式复制/无来源噪声；有才修。}}`;

const geminiFinal=`{{setvar::model_family::Gemini}}{{setvar::claude::}}{{setvar::gemini::Gemini：已建立事实默认延续；严格保持输出标签。}}{{setvar::model_focus::【Gemini】未知不等于危险；知情不等于必须处理；中性user动作不等于剧情信号。按已经发生事件的实际强度写，不主动寻找“隐藏意味”。}}{{setvar::抑制器::<model_calibration family="Gemini">1. 先分清已知事实与模型推断。只看到陌生物件、人物稍有异样、user看一眼/喝茶/沉默，不足以推出害怕、心虚、掩饰、看穿、试探、危险或秘密意义。2. 某角色知道一个尚未定性的事实，不等于必须立即调查、公开、掩饰或围绕它制造悬念；没有明确目标/风险/刺激时允许该事实暂时挂起，人物继续原本在做的事。3. user已完成的中性动作不要在正文重演、延长、解释，也不要把NPC视线反复拉回user。4. 群像按各人的原任务、关系和现场节奏继续；隐藏信息最多轻微影响知情者，不强迫其他人察觉。5. 不用连续小动作证明心理；一两个真正有后果的外显足够。6. 已建立人物、关系、地点、资源和事件状态稳定继承；高影响新事实必须有来源。7. 严格user_agency与output_contract；正文不补创作分析。</model_calibration>}}{{setvar::cot_anti_despair::【Gemini检查】是否把未知自动写成危险/心虚/悬念；是否因中性user动作把注意力拉回user；有则降回事实强度。}}`;

const tests=[
 {family:'GLM',provider:'YOUZI',model:'[B]glm-5.3-flash',scenario:'strong_character_quiet',variant:'final'},
 {family:'GLM',provider:'YOUZI',model:'[B]glm-5.3-flash',scenario:'ensemble_knowledge',variant:'final'},
 {family:'GLM',provider:'YOUZI',model:'[B]glm-5.3-flash',scenario:'horror_causality',variant:'final'},
 {family:'Gemini',provider:'GG',model:'gemini-3.1-pro-preview',scenario:'ensemble_knowledge',variant:'common'},
 {family:'Gemini',provider:'GG',model:'gemini-3.1-pro-preview',scenario:'ensemble_knowledge',variant:'final'},
 {family:'Gemini',provider:'GG',model:'gemini-3.1-pro-preview',scenario:'strong_character_quiet',variant:'common'},
 {family:'Gemini',provider:'GG',model:'gemini-3.1-pro-preview',scenario:'strong_character_quiet',variant:'final'},
];

async function loadPack(){
 const dir=path.join(ROOT,'fixtures/preset-benchmark');
 const names=(await fs.readdir(dir)).filter(n=>/^prompts\.part\d+\.b64$/.test(n)).sort();
 let b64=''; for(const n of names)b64+=(await fs.readFile(path.join(dir,n),'utf8')).trim();
 const pack=JSON.parse(zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
 pack.sequence=pack.sequence.filter(x=>!['⚠️丨扩写+加强复述','⚠️丨防复述','🤔丨反抢话','🤔丨User去中心化'].includes(x.name));
 const idx=Math.max(0,pack.sequence.findIndex(x=>x.name==='🔧丨玲七轻量思考'));
 pack.sequence.splice(idx,0,...commonPatches);
 const ui=pack.sequence.find(x=>x.name==='🔒丨User_Input');
 if(ui&&!String(ui.content||'').includes('{{getvar::agency_contract}}'))ui.content=String(ui.content||'').replace('{{getvar::push_rule}}','{{getvar::push_rule}}\n{{getvar::agency_contract}}');
 return pack;
}
function clean(t){return String(t??'').replace(/\{\{\/[\s\S]*?\}\}/g,'')}
function expand(t,vars,s){
 t=clean(t);
 for(let i=0;i<16;i++){
  const old=t;
  t=t.replace(/\{\{getvar::([^{}]+?)\}\}/g,(_,n)=>vars[n.trim()]??'')
   .replace(/\{\{setvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=v,''))
   .replace(/\{\{addvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=(vars[n.trim()]??'')+v,''))
   .replace(/\{\{trim\}\}/g,'')
   .replace(/\{\{random::([^{}]*?)\}\}/g,(_,v)=>String(v).split('::')[0]??'')
   .replaceAll('{{lastUserMessage}}',s.history.filter(x=>x.role==='user').at(-1)?.content??'')
   .replaceAll('{{user}}',s.user_name).replaceAll('{{char}}',s.char_name)
   .replaceAll('{{persona}}',`用户角色${s.user_name}只由用户控制，不替其新增台词、动作、心理或决定。`)
   .replaceAll('{{description}}',s.setup).replaceAll('{{personality}}','').replaceAll('{{scenario}}','');
  if(t===old)break;
 }
 return t.trim();
}
function marker(item,s){if(item.content!==null&&item.content!==undefined)return null;switch(item.name){case'👤丨用户角色描述':return[{role:'system',content:`用户角色：${s.user_name}，只由用户控制。`}];case'⚫丨角色描述':return[{role:'system',content:s.setup}];case'Chat History':return s.history.map(x=>({role:x.role,content:x.content}));default:return[]}}
function build(pack,test,s){
 const vars={},messages=[];
 for(const slot of pack.sequence){
  let item=slot;
  if(slot.adapter){
   if(test.family==='GLM') item={...slot,content:glmAdapter};
   else if(test.family==='Gemini'&&test.variant==='final') item={...slot,content:geminiFinal};
   else continue;
  }
  const m=marker(item,s); if(m!==null){messages.push(...m);continue}
  const c=expand(item.content,vars,s); if(c)messages.push({role:item.role||'system',content:c});
 }
 return messages;
}
async function postJson(url,body,timeoutMs=180000){const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeoutMs);try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});const tx=await res.text();let data;try{data=JSON.parse(tx)}catch{data={raw:tx}}return{status:res.status,ok:res.ok,data}}finally{clearTimeout(timer)}}
async function setSecret(name){const p=providers[name];if(!p.key)throw new Error(`${name} secret missing`);const r=await postJson(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:p.key,label:`focus-v4-${name}`},30000);if(!r.ok)throw new Error(`secret write ${name} HTTP ${r.status}`)}
async function generate(test,messages){const p=providers[test.provider],started=Date.now();const r=await postJson(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:p.url,model:test.model,messages,temperature:.82,top_p:.95,max_tokens:1300,stream:false},180000);const msg=r.data?.choices?.[0]?.message??{};return{http_status:r.status,http_ok:r.ok,elapsed_ms:Date.now()-started,content:msg.content??'',reasoning:msg.reasoning??msg.reasoning_content??'',finish_reason:r.data?.choices?.[0]?.finish_reason??null,upstream_error:r.data?.error??null}}
function signals(text,s){const t=String(text||'');return{chars:t.length,user_action:new RegExp(`${s.user_name}(?:放下|抬|低|转|走|站|坐|伸|拿|喝|凑|握|看向|目光|呼吸|想起|觉得|点头|摇头)`).test(t),user_speech:new RegExp(`${s.user_name}(?:说|问|答|开口)|[“\"][^”\"]{1,80}[”\"]，?${s.user_name}(?:说|问|答)`).test(t),secret_named:s.id==='ensemble_knowledge'&&/(黑布包|布包)/.test(t),overread_secret:s.id==='ensemble_knowledge'&&/(心虚|害怕|恐惧|惊慌|掩饰|看穿|如蒙大赦|撞见鬼|脸色.*青|脚步.*紊乱)/s.test(t),forced_user_focus:s.id!=='horror_causality'&&new RegExp(`${s.user_name}[^。！？]{0,80}(?:看穿|试探|注意|察觉|一切.*眼里)|(?:看向|瞥|扫).*${s.user_name}`).test(t),new_omen:s.id==='horror_causality'&&/(新规则|婴儿笑|三下敲门|陌生人|新的血迹|红色痕迹|病患日记)/.test(t)}}

await fs.mkdir(EVIDENCE,{recursive:true});
const pack=await loadPack();
const data=JSON.parse(await fs.readFile(path.join(ROOT,'fixtures/preset-benchmark/scenarios.json'),'utf8'));
const sm=Object.fromEntries(data.scenarios.map(s=>[s.id,s]));
const results=[];let current=null,last=0;
for(const test of tests){
 const p=providers[test.provider];
 if(!p.key){results.push({...test,status:'skipped_missing_secret'});continue}
 if(current!==test.provider){if(current)await sleep(5000);await setSecret(test.provider);current=test.provider}
 const wait=p.delayMs-(Date.now()-last);if(last&&wait>0)await sleep(wait);
 const s=sm[test.scenario],messages=build(pack,test,s);
 const rec={...test,prompt_chars:messages.reduce((a,m)=>a+m.content.length,0),prompt_messages:messages.length};
 try{const g=await generate(test,messages);Object.assign(rec,g,{content_signals:signals(g.content,s),reasoning_signals:signals(g.reasoning,s),status:(g.content||g.reasoning)?'ok':'no_text'})}catch(e){rec.status='exception';rec.error=`${e.name}: ${e.message}`}
 last=Date.now();results.push(rec);console.log(`${test.family} ${test.scenario} ${test.variant} ${rec.status} content=${rec.content?.length||0} reasoning=${rec.reasoning?.length||0} ms=${rec.elapsed_ms||0}`);
}
const report={schema:4,generated_at:new Date().toISOString(),routing:'real SillyTavern backend -> provider; serial',purpose:'final focus on GLM and Gemini only',frequency_policy:'YOUZI >=1.8s; GG >=28s; all serial',tests:results};
await fs.writeFile(path.join(EVIDENCE,'preset-model-focus-v4.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(EVIDENCE,'preset-model-focus-v4-summary.txt'),results.map(r=>`${r.family}\t${r.model}\t${r.scenario}\t${r.variant}\t${r.status}\tcontent=${r.content?.length||0}\treasoning=${r.reasoning?.length||0}\tms=${r.elapsed_ms||0}`).join('\n')+'\n');
