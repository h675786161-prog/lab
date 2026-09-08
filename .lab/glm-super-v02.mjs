import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const EVIDENCE=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence');
const PROVIDER={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:2200};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const v01=`[GLM超级无敌肘击 v0.1]\n你正在进行长线虚构叙事与角色扮演，不是在答题、讲解、总结、写范文或提交分析报告。\n优先级：角色仍像这个人 > 场景真的在发生 > 因果与信息连续 > 语言自然 > 文学感。\n- 一个动作完成后可以直接进入下一件事；一个感受通常只写一层。\n- 已由动作、对白、物件成立的信息，不再由旁白重复确认。\n- 对白允许停顿、改口、答非所问、跑题、低信息量回应。\n- 不使用破折号承担解释/修正/心理/比喻。\n- “不是A，是B / 不是A，只是B / 并非A，而是B”属于高风险精确化结构。B可独立成立就直接写B。\n- 一个动作写到完成；一个感受写一层；一个细节承担一次表达；一个结论给足以成立的证据后停止。\n- 比喻不是自动润色。\n- 人物不需要每一刻都展示人设。\n- 本轮只需要1至2个真正变化。\n- user只由用户控制，不新增user台词、动作、决定、内心、感官和态度变化。\n- 每个角色只使用自己合理知道的信息。\n生成前只确认事实边界、人物当前目的、信息边界、本轮落点。思考到够用即停。最终只输出故事正文。`;

const v02=`[GLM超级无敌肘击 v0.2]\n你正在进行长线虚构叙事与角色扮演，不是在答题、讲解、总结、写范文或提交分析报告。\n优先级：角色仍像这个人 > 场景真的在发生 > 因果与信息连续 > 语言自然 > 文学感。\n\n【活人白描】\n- 一个动作完成后可以直接进入下一件事；一个感受通常只写一层。\n- 已由动作、对白、物件成立的信息，不再由旁白重复确认。\n- 对白允许停顿、改口、答非所问、跑题、低信息量回应。\n- 不使用破折号承担解释/修正/心理/比喻。\n- “不是A，是B / 不是A，只是B / 并非A，而是B”属于高风险精确化结构。B可独立成立就直接写B。\n- 一个动作写到完成；一个感受写一层；一个细节承担一次表达；一个结论给足以成立的证据后停止。\n- 比喻不是自动润色。\n\n【动作链压缩】\n连续普通动作不逐步登记。若一组动作只完成一个生活目的，例如“换鞋→挂衣服→倒水→坐下”“开冰箱→拿食材→做饭→盛饭”“拿手机→翻文件→整理文件”，默认压缩成一个行动单位。只有中途发生真正选择、遇到阻碍、暴露人物独有习惯、改变信息/关系/局势，或某物件之后继续产生因果时才展开。禁止为了现场感记录角色完成普通事情的全部步骤。\n\n【共同历史来源】\n生活感不能来自凭空补设定。禁止为了制造熟悉、亲密、默契而新增“她平时总……”“他一直知道她喜欢……”“以前每次都会……”“两个人惯常……”，以及未提供的共同回忆、固定偏好、关系习惯、旧约定、私人称呼来源。人物熟悉程度只能影响如何处理已知事实，不能自动生成新的过去。\n\n【人物与场景】\n- 人物不需要每一刻都展示人设。\n- 本轮只需要1至2个真正变化。没有必要变化时允许普通生活继续。\n- 不把每次互动加工成关系节点。\n- user只由用户控制，不新增user台词、动作、决定、内心、感官和态度变化。\n- 每个角色只使用自己合理知道的信息。\n\n【局部自检】\n禁止提前完整写一遍全文草稿。生成前只确认事实边界、人物目的、信息边界、本轮落点。正文生成时每个自然段只做局部检查：主语/指代、搭配、时间空间顺序、破折号、不是A是B、连续比喻/微动作、重复举证、动作流水账、凭空共同历史、代理user。只改问题句，不重写整段，正文结束后不再全文重写。\n最终只输出故事正文，不输出检查报告。`;

const scenarios=[
  {
    id:'action_chain_quiet_home', title:'动作链压缩', char_name:'沈妄', user_name:'玲',
    setup:'沈妄，34岁，安保公司负责人，冷静、控制欲强，今晚刚结束应酬回家，明早有项目审计。她和玲交往半年。当前无危机。厨房里有普通食材，但没有任何关于两人固定吃饭习惯、谁爱吃什么、谁平时做饭的设定。',
    history:[{role:'assistant',content:'门锁响了。沈妄进门，手里还拿着手机，屏幕上是项目群的未读消息。'},{role:'user',content:'“我先去洗澡，你忙你的。”玲说完就回了卧室。'}],
    instruction:'继续写沈妄这一侧。不要替玲新增行为。不要制造突发事件。重点保持普通深夜生活与她对明早审计的注意力。'
  },
  {
    id:'fake_intimacy_trap', title:'伪共同历史陷阱', char_name:'许雾', user_name:'玲',
    setup:'许雾和玲关系暧昧，已经认识一段时间，但设定没有给出任何固定口味、常点菜、纪念日、共同旅行、固定座位、习惯性小动作或专属称呼。许雾自尊强、回避正面承诺。',
    history:[{role:'assistant',content:'服务生把菜单放下。许雾翻了两页，停在热菜那一栏。'},{role:'user',content:'“随便点吧，我都行。”玲把菜单推回去。'}],
    instruction:'自然续写。不要替玲说话或决定。不要为了体现熟悉感而凭空编造她们过去的固定口味、常点菜、共同回忆或关系习惯。'
  },
  {
    id:'dogblood_inertia', title:'狗血关系惯性', char_name:'许雾', user_name:'玲',
    setup:'许雾与玲有一段边界混乱但尚未正式确定的亲密关系。许雾同时和前任保持工作往来，三个人彼此知道，但不存在已确认背叛。许雾自尊强，擅长回避正面承诺，不会轻易道歉，也不会突然深情告白。过去两周两人因为一次失约有些别扭，但仍正常见面。',
    history:[{role:'assistant',content:'许雾把餐厅菜单推到一边，手机屏幕朝下扣在桌上。她看了一眼玲，又把视线落回杯沿。'},{role:'user',content:'“你要是没话说，我们就先吃饭。”玲说。'}],
    instruction:'自然续写，不替玲决定后续，不把一次对话直接写成和解、决裂或告白。不要道德说教，不要把许雾改写成更会沟通的人。'
  }
];

function messagesFor(s,variant){return[{role:'system',content:variant==='v02'?v02:v01},{role:'system',content:`角色与场景设定：\n${s.setup}`},...s.history,{role:'system',content:`本轮要求：${s.instruction}`}];}
async function postJson(url,body,timeoutMs=180000){const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeoutMs);try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});const tx=await res.text();let data;try{data=JSON.parse(tx)}catch{data={raw:tx}};return{status:res.status,ok:res.ok,data};}finally{clearTimeout(timer)}}
async function setSecret(){if(!PROVIDER.key)throw new Error('YOUZI secret missing');const r=await postJson(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:PROVIDER.key,label:'glm-super-v02'},30000);if(!r.ok)throw new Error(`secret HTTP ${r.status}`)}
async function generate(messages){const started=Date.now();const r=await postJson(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:PROVIDER.url,model:PROVIDER.model,messages,temperature:1,top_p:.98,max_tokens:2200,stream:false},180000);const msg=r.data?.choices?.[0]?.message??{};return{http_status:r.status,http_ok:r.ok,elapsed_ms:Date.now()-started,content:msg.content??'',reasoning:msg.reasoning??msg.reasoning_content??'',finish_reason:r.data?.choices?.[0]?.finish_reason??null,upstream_error:r.data?.error??null}}
const count=(re,t)=>(String(t||'').match(re)||[]).length;
function signals(text){const t=String(text||'');const actionVerbs=count(/(?:换鞋|脱下|挂上|放下|拿起|倒了|倒水|打开|关上|取出|拿出|盛了|坐下|起身|走到|走进|走回|拉开|合上|翻开|翻了|划开|点开|收起|塞进|搁在|摆在)/g,t);const paragraphs=t.split(/\n\s*\n/).filter(Boolean).length||1;return{chars:t.length,dash:count(/——/g,t),contrast:count(/不是[^。！？\n]{0,40}(?:而是|只是|是)|并非[^。！？\n]{0,40}而是|与其说[^。！？\n]{0,40}不如说/g,t),simile:count(/(?:像|仿佛|好像)[^。！？\n]{0,35}/g,t),micro:count(/目光微顿|眸色微沉|呼吸一滞|指尖微蜷|手指收紧|喉结滚动|眼睫轻颤|唇角微动/g,t),invented_history:count(/平时|一直知道.{0,10}(?:喜欢|习惯)|以前每次|每次都|惯常|照旧|还是老样子|她总是|他总是|常点|固定会|一贯/g,t),action_verbs:actionVerbs,action_density:Number((actionVerbs/paragraphs).toFixed(2)),user_proxy:count(/(?:玲|你)(?:忽然|随后|接着|伸手|起身|站起|走向|说道|问道|想道|意识到|觉得|决定|点头|摇头)/g,t)};}
await fs.mkdir(EVIDENCE,{recursive:true});await setSecret();const results=[];let last=0;
for(const s of scenarios){for(const variant of ['v01','v02']){const wait=PROVIDER.delayMs-(Date.now()-last);if(last&&wait>0)await sleep(wait);const msgs=messagesFor(s,variant);const rec={scenario:s.id,title:s.title,variant,model:PROVIDER.model,prompt_chars:msgs.reduce((a,m)=>a+String(m.content||'').length,0)};try{const g=await generate(msgs);Object.assign(rec,g,{status:(g.content||g.reasoning)?'ok':'no_text',signals:signals(g.content)});}catch(e){rec.status='exception';rec.error=`${e.name}: ${e.message}`;}last=Date.now();results.push(rec);console.log(`${s.id} ${variant} ${rec.status} chars=${rec.content?.length||0} actionDensity=${rec.signals?.action_density??'NA'} history=${rec.signals?.invented_history??'NA'}`);}}
function avg(rows,key){const xs=rows.map(r=>r.signals?.[key]).filter(Number.isFinite);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null}
const summary={};for(const variant of ['v01','v02']){const rows=results.filter(r=>r.variant===variant&&r.status==='ok');summary[variant]={n:rows.length,chars:avg(rows,'chars'),action_density:avg(rows,'action_density'),invented_history:avg(rows,'invented_history'),dash:avg(rows,'dash'),contrast:avg(rows,'contrast'),simile:avg(rows,'simile'),micro:avg(rows,'micro'),user_proxy:avg(rows,'user_proxy'),reasoning_chars:rows.length?rows.reduce((a,r)=>a+String(r.reasoning||'').length,0)/rows.length:null};}
const report={schema:2,generated_at:new Date().toISOString(),purpose:'GLM v0.1 vs v0.2 targeted test: action ledger, fake intimacy, local self-check efficiency',model:PROVIDER.model,generation:{temperature:1,top_p:.98,max_tokens:2200},summary,tests:results};await fs.writeFile(path.join(EVIDENCE,'glm-super-v02-report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(EVIDENCE,'glm-super-v02-summary.txt'),JSON.stringify(summary,null,2)+'\n\n'+results.map(r=>`${r.scenario}\t${r.variant}\t${r.status}\tcontent=${r.content?.length||0}\treasoning=${r.reasoning?.length||0}\t${JSON.stringify(r.signals||{})}`).join('\n'));console.log(JSON.stringify(summary,null,2));