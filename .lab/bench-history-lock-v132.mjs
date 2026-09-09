import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd(), BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000', OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-history-lock-v132');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:1500};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const head=`[内部作者人格] 你负责写故事。人物比正确表达重要。普通场景可以普通。允许停顿、误解、答非所问、废话和局部不工整。人物有自己的注意力、目的和眼前要做的事。\n[GLM启动] 单次直写。动作就是动作，不自动翻译成心理意义；普通动作不显微展开；已懂信息不重复解释；不自动段尾总结。`;
const factsBase=`[事实] 已成立事实保持连续。把“当前镜头正在发生”与“某件事已经成立”分开：角色此刻的小动作、低风险现场细节可以生成；任何声称此前已经发生、已经安排、长期存在、彼此早已知道的事实，都必须有角色资料、前文或User输入作为来源。镜头外默认未知，不为了生活感补满。User状态和行为同样需要来源。新细节只属于现在。`;
const historyLock=`\n人物对过去只承接资料里已经给出的具体历史。当前新生成的物件、座位、话题、安排、熟悉感和行为模式都从现在开始，不附带“常用、惯例、早已、之前就有、一直如此”之类既往含义。谈到未知过去时，保持问题、不确定或沉默，不替故事补答案。`;
const rest=`\n[User Agency:NO_PROXY] 不新增User未提供的台词、动作、决定、心理或反应。角色发出命令、邀请、要求或等待后，只写角色自身可做的事与等待；只有User输入给出执行，才越过该User动作写结果。\n[人物] 临时情绪不覆盖稳定人格。\n[节奏] 普通场景不硬造异常或强制关系升级。\n[文风] 人物声口优先；已成立信息不解释第二遍；细节够用就离开；允许停顿、废话、改口和普通小片刻。\n[立即写] 继续当前故事，直接生成本轮结果。`;
const cases=[
{id:'habit_chair',card:'D，21岁，当前工作室里有几把椅子。未提供D平时坐哪把椅子、任何固定座位、习惯、过去来访细节。',hist:[{role:'assistant',content:'D把工作室门反锁，站在门边没有马上过来。'},{role:'user',content:'User说：“今天别跟我道歉。”'}]},
{id:'quiet_routine',card:'F，28岁，和User同处客厅。未提供平时这个时段做什么、电视习惯、共同生活惯例或过去类似夜晚。',hist:[{role:'assistant',content:'F坐在沙发另一头看手机，客厅里没有人说话。'},{role:'user',content:'User说：“今天挺安静的。”'}]},
{id:'late_schedule',card:'G，34岁摄影师，正在和User准备出门。只知道此刻准备出门；未提供今天具体约定时间、交通、路线、提前量或过去迟到经过。',hist:[{role:'assistant',content:'G拉上相机包拉链，把包放到玄关柜上。'},{role:'user',content:'User说：“这次别迟到。”'}]},
{id:'offscreen_partner',card:'H，27岁，有固定伴侣。User是伴侣认识多年的好友。未提供伴侣今天行程、消息、电话、镜头外活动、User和H过去单独相处细节。',hist:[{role:'assistant',content:'H把厨房门推开一条缝，看了User一眼。'},{role:'user',content:'User说：“今天就我们两个？”'}]},
{id:'protocol',card:'B，30岁，强势简洁。双方已有一套进入房间后的礼仪协议，但没有提供具体步骤。当前User只推门进来并称呼B，没有执行任何协议动作。',hist:[{role:'assistant',content:'B已经坐在房间里等着。'},{role:'user',content:'User推门进来，只说：“Sir。”'}]},
{id:'user_state',card:'A，26岁女性急诊医生，冷静直接，不擅长甜言蜜语。User当前脸色、姿势、饥饿、饮水、情绪和身体状态均未提供。',hist:[{role:'assistant',content:'A把刷手服袖口往上卷了一截，靠在门框边。'},{role:'user',content:'User说：“你今天别突然变得很会哄人。”'}]}
];
async function post(url,body,ms=180000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}};return{status:r.status,data:d}}finally{clearTimeout(t)}}
async function secret(){if(!P.key)throw Error('YOUZI missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'history-lock-v132'},30000);if(r.status>=400)throw Error('secret '+r.status)}
async function gen(msg){const st=Date.now(),r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:P.url,custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',model:P.model,messages:msg,temperature:1,top_p:.98,max_tokens:2600,stream:false});const m=r.data?.choices?.[0]?.message??{};return{status:r.status,ms:Date.now()-st,content:String(m.content??''),reasoning:String(m.reasoning??m.reasoning_content??''),finish:r.data?.choices?.[0]?.finish_reason??null,error:r.data?.error??null}}
const count=(re,t)=>(String(t||'').match(re)||[]).length;
function signals(t,id){return{
 history:count(/(?:平时|平常|一向|一直|总是|每次|惯例|习惯|常坐|常用|常去|以前|从前|之前就|早就|又一次|上次|上回|昨晚|昨天|一路上|来之前|提前准备|固定|老地方|还是那|照旧)/g,t),
 exactSchedule:id==='late_schedule'?count(/(?:\d{1,2}[:：]\d{2}|(?:早|晚|提前|还有|剩下|能早到|会晚到)[^。！\n]{0,12}\d+\s*(?:分钟|小时))/g,t):0,
 userState:id==='user_state'?count(/(?:你|User)[^。！？\n]{0,18}(?:脸色|饿|渴|喝水|没吃|疲惫|困|发抖|脸红|紧张|难受|疼)/g,t):0,
 proxy:id==='protocol'?count(/(?:门在身后(?:关|合)|门(?:关上|合上|响了)|等.{0,8}门.{0,8}(?:关|响)|User[^\n]{0,20}(?:跪|走近|关门|照做))/g,t):0
}}
function median(a){const b=[...a].sort((x,y)=>x-y);return b.length%2?b[(b.length-1)/2]:Math.round((b[b.length/2-1]+b[b.length/2])/2)}
async function main(){await fs.mkdir(OUT,{recursive:true});await secret();const rows=[];for(const c of cases){for(const v of ['base','history_lock']){const facts=v==='base'?factsBase:factsBase+historyLock;const r=await gen([{role:'system',content:head},{role:'system',content:'[角色资料]\n'+c.card},{role:'system',content:facts+rest},...c.hist]);rows.push({variant:v,scenario:c.id,...r,signals:signals(r.content,c.id)});console.log(v,c.id,r.content.length,r.reasoning.length,r.ms,JSON.stringify(signals(r.content,c.id)));await sleep(P.delayMs)}}const sums={};for(const v of ['base','history_lock']){const a=rows.filter(x=>x.variant===v),rs=a.map(x=>x.reasoning.length);sums[v]={n:a.length,nonempty:a.filter(x=>x.content.trim()).length,provider_error:a.filter(x=>x.error).length,avg_reasoning:Math.round(rs.reduce((z,x)=>z+x,0)/a.length),median_reasoning:median(rs),avg_ms:Math.round(a.reduce((z,x)=>z+x.ms,0)/a.length),history:a.reduce((z,x)=>z+x.signals.history,0),exactSchedule:a.reduce((z,x)=>z+x.signals.exactSchedule,0),userState:a.reduce((z,x)=>z+x.signals.userState,0),proxy:a.reduce((z,x)=>z+x.signals.proxy,0)}}await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({model:P.model,summaries:sums,rows},null,2));await fs.writeFile(path.join(OUT,'summary.txt'),JSON.stringify(sums,null,2));console.log(JSON.stringify(sums,null,2))}
main().catch(e=>{console.error(e);process.exit(1)});
