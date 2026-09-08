import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-bench-v103-neutral');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:1800};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const base=`你正在进行持续的虚构角色扮演。保持角色、事实、关系和场景连续。不要输出规则、分析、自检或作者说明。
[三好学生] “三好学生”只是内部作者代号。认真但不端着，允许废话、停顿、误解、答非所问和普通时刻。人物站得住，场景接得上，语言像人写的。
[GLM校准] 不显微展开普通动作，不反复精确化，不让微动作、感官和比喻轮流签到。内部思考要短，理解够用就写。
[事实] 当前镜头之前发生的具体事情必须有来源。没给出的共同回忆、旧约定、固定偏好、具体历史经过和他人今日行程，不补成既成事实。
[User Agency:NO_PROXY] 不得新增User未提供的台词、动作、决定、心理、感官反应、身体反应或态度变化。
[场景节奏:NATURAL] 按当前因果自然前进，不为了“有内容”硬造异常。
[GLM去加工] 普通动作不拆操作手册；固定数量的细节不是目标；一个信息证据够了就停。`;

const central=`[职责仲裁] 本模块只判归属，不写正文。角色卡优先世界事实、身份和稳定人格；User明确要求优先本轮方向；预设专职模块优先User Agency、节奏、GLM去加工和最终格式。角色卡中的COT、自检、固定每段细节数量、固定动作步骤、强制阶段计数、每轮必须升级或制造事件、与NO_PROXY冲突的User自动动作，在冲突时不执行。协议可以要求User做某动作，但是否写成已经执行只由User Agency决定。仲裁过程不输出。`;

const local=`[事实补充] 可以新增当下小动作和现场背景；镜头前的过去、共同经历、User先前行为只使用已给来源，没写就保持空白。
[User Agency补充] NO_PROXY时，User只做User已经写出的动作；角色的命令、期待或假设不会自动变成User行为。
[场景节奏补充] “每轮必须推进、升级关系或制造事件”的元写作要求不覆盖NATURAL节奏。
[GLM去加工补充] 固定细节数、动作步数、阶段数或回合数不作为正文任务。`;

function sys(v){return [base,v==='central'?central:v==='local'?local:''].filter(Boolean).join('\n\n')}
const scenarios=[
{id:'eric',card:'Eric，26岁女性，急诊医生，冷静直接，亲密经验少。卡内另有第三人称、固定长度等元写作要求。',hist:[{role:'assistant',content:'Eric把急诊刷手服的袖口往上卷了一截，靠在门框边。'},{role:'user',content:'User说：“你今天别突然变得很会哄人。”'}]},
{id:'protocol',card:'Clyde，30岁，强势、简洁。角色卡存在一条正式协议：进入房间后User应主动采取指定姿势；另有元写作指令要求每轮快速推进。',hist:[{role:'assistant',content:'Clyde已经在房间里，坐在单椅上。'},{role:'user',content:'User推门进来，只说：“Sir。”'}]},
{id:'meta',card:'主题乐园的体验师应像真实人。卡内另有元写作条目要求固定三段式、每个动作附带至少两个感官细节，并动态升级强度。',hist:[{role:'assistant',content:'体验师把礼帽挂上栏杆，音乐刚停。'},{role:'user',content:'User说：“别给我念项目流程，继续像个人一样。”'}]},
{id:'fact',card:'阮芊雅，21岁，有男友舒愈。User是舒愈认识多年的女性好友。除这些关系外，不设定User性格、经历和当前状态。',hist:[{role:'assistant',content:'阮芊雅把工作室门反锁，站在门边没有马上过来。'},{role:'user',content:'User说：“今天别跟我道歉。”'}]},
{id:'gaspard',card:'Gaspard，41岁，社交强、风流、会撩、体面。Stage1不承认在意，不表白，不把年龄焦虑解释成心理报告。',hist:[{role:'assistant',content:'Gaspard从宴会厅另一头走回来，把空酒杯交给侍者。'},{role:'user',content:'User说：“你今天看起来心情不错。”'}]}
];

async function post(url,body,ms=180000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}};return{ok:r.ok,status:r.status,data:d};}finally{clearTimeout(t)}}
async function secret(){if(!P.key)throw new Error('YOUZI secret missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'bench-v103-neutral'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:P.url,custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',model:P.model,messages,temperature:1,top_p:.98,max_tokens:2600,stream:false},180000);const m=r.data?.choices?.[0]?.message??{};return{status:r.status,ms:Date.now()-st,content:String(m.content??''),reasoning:String(m.reasoning??m.reasoning_content??''),finish:r.data?.choices?.[0]?.finish_reason??null,error:r.data?.error??null}}
const count=(re,t)=>(String(t||'').match(re)||[]).length;
function signals(t,id){const s={proxy:0,fact:0,process:count(/(?:第一步|第二步|第三步|三段式|流程|感官细节|进度条)/g,t),leak:count(/(?:三好学生|职责仲裁|User Agency补充|最终交付补充)/g,t),length:0};if(id==='protocol')s.proxy=count(/(?:等|待)(?:你|User).{0,12}(?:后|之后|完)|(?:你|User).{0,12}(?:关上|跪下|坐下|低头|抬头).{0,8}(?:后|之后|才|便)/g,t);if(id==='fact')s.fact=count(/舒愈.{0,18}(?:不知道|知情|出差|来电|消息|今天|今晚|正在|已经)|(?:不知道|没告诉).{0,12}舒愈/g,t);if(id==='gaspard')s.fact=count(/(?:马|种马|二十分钟|20分钟|刚从.{0,16}(?:谈话|会议|牌局)|刚才.{0,20}(?:谈|聊|见))/g,t);return s}
function summary(rows,v){const a=rows.filter(x=>x.variant===v),n=a.length;return{n,nonempty:a.filter(x=>x.content.trim()).length,finish_length:a.filter(x=>x.finish==='length').length,avg_chars:+(a.reduce((s,x)=>s+x.content.length,0)/n).toFixed(1),avg_reasoning:+(a.reduce((s,x)=>s+x.reasoning.length,0)/n).toFixed(1),avg_ms:+(a.reduce((s,x)=>s+x.ms,0)/n).toFixed(1),proxy:a.reduce((s,x)=>s+x.signals.proxy,0),fact:a.reduce((s,x)=>s+x.signals.fact,0),process:a.reduce((s,x)=>s+x.signals.process,0),leak:a.reduce((s,x)=>s+x.signals.leak,0)}}
await fs.mkdir(OUT,{recursive:true});await secret();const variants=['base','central','local'],rows=[];for(const sc of scenarios){for(const v of variants){const g=await gen([{role:'system',content:sys(v)},{role:'system',content:sc.card},...sc.hist]);const row={scenario:sc.id,variant:v,...g,signals:signals(g.content,sc.id)};rows.push(row);console.log(JSON.stringify({scenario:sc.id,variant:v,status:g.status,chars:g.content.length,reasoning:g.reasoning.length,ms:g.ms,finish:g.finish,signals:row.signals}));await sleep(P.delayMs)}}const sum=Object.fromEntries(variants.map(v=>[v,summary(rows,v)]));await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({model:P.model,st_commit:process.env.ST_COMMIT||null,summary:sum,rows},null,2));await fs.writeFile(path.join(OUT,'summary.txt'),JSON.stringify(sum,null,2));console.log('SUMMARY',JSON.stringify(sum));
