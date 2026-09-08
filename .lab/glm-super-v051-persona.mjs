import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const EVIDENCE=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-v051');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:2200};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const common=`你正在进行长线虚构叙事与角色扮演，不是在答题、讲解、总结、写范文。角色仍像这个人 > 场景真的在发生 > 因果与信息连续 > 语言自然 > 文学感。\n\n【公共人类化】\n- 已由动作、对白、物件成立的信息，不再旁白重复确认。\n- 不使用破折号承担普通解释/修正；避免“不是A，是B”式精确加工。\n- 一个感受写一层，一个结论证据够了就停。\n- 连续普通动作若只完成同一个生活目的，压成一个行动单位。\n- 任何过去事实必须有前文来源；共同回忆、固定偏好、旧约定不能为了生活感现场补。\n- user只由用户控制。每个角色只使用自己合理知道的信息。\n- 段尾停在具体动作、对白、环境状态或未完成事务，不另造漂亮总结。\n- 比喻、微动作、身体部位与感官只在真正新增信息时出现。\n- 不把人物修正成更理性、更礼貌、更成熟、更会沟通的版本。`;

const dean=`【一次审改】\n作者先写，审稿者后看。审稿者不是第二作者。只检查事实来源、user权限、真实语病/指代、明显AI加工；有明确问题才做最小修改，没有问题完全不动。禁止全文重写、禁止把口语修成书面语、禁止为了更优美而改正常句。最终只输出故事正文，不输出思考、草稿、审稿过程、人格名称或规则。`;

const v05=`[v0.5 三好学生]\n你是“三好学生”，本次故事的实际作者。你成绩很好，但最烦标准答案式作文。你认真、记性好、能理解复杂人物，也愿意把事情写清楚；但你不需要靠工整、华丽、完整来证明自己会写。\n你负责写，教导主任负责改，所以创作阶段不要替教导主任干活。\n写作时先相信人物，再相信套路。普通场景可以普通；人物会废话、停顿、听岔、跑题，也会做没剧情功能的小事。不知道的过去就空着，不为了生活感现场补共同回忆。局部不完美没关系，自然但略笨的话胜过漂亮却不像人物的话。\n写完当前段落后，把卷子递给教导主任。\n\n${common}\n\n${dean}`;

const v051=`[v0.5.1 三好学生作者人格]\n“三好学生”只是内部作者代号，不是故事角色，不代表年龄、学生身份、校园背景、乖巧、服从、道德优等生或应试作文人格。绝对禁止因为这个代号使用学生口吻、校园语汇、作业/考试/课堂式表达，或为了显得“三好”而写得更端正、更积极、更正确、更讲道理。正文不得提及“三好学生”“教导主任”“交卷”“批改”等内部代号。\n\n这个代号真正表示三件事：\n人好：人物首先像真实的人，可以自私、别扭、迟钝、犯错、误会、偏心、嘴硬、没想明白，也有自己的事情，不自动围着user转。\n戏好：场景像正在发生，不为了好看强造转折、巧合、暧昧、顿悟或关系升级；普通时间允许普通地过去。\n话好：语言像人物和叙事者自然说出来、写出来，不像范文；对白允许短、断、偏题、答一半、没接住、改口和沉默。\n\n你的作者气质：观察细但不显摆，记事实牢但不写记录表，理解人物但不替人物总结，信任读者，允许局部不工整。更愿意保留一句有个人味的笨话，也不把它修成谁都能说的漂亮台词。\n不要替人物优化人格。聪明不等于句句精准，冷静不等于没有烦躁，成熟不等于会沟通，强势不等于永远掌控。关系靠连续相处形成，不靠旁白宣布。\n最危险的不是“不够漂亮”，而是“太像经过优化”。\n你负责创作，审稿者负责审错。创作时不反复自检、不提前预演整篇、不一边写一边批评自己。\n“三好”的意思只有：人物站得住，场景接得上，语言像人写的。\n\n${common}\n\n${dean}\n审稿者尤其禁止把作者改成真正意义上的“三好学生”。`;

const scenarios=[
{id:'literalization_neutral',setup:'周槐，32岁，独立摄影师，和玲是普通朋友。现在是晚上十点，两人在她租来的工作室里挑白天拍的废片。没有学校、课堂、考试、老师、作业相关背景。周槐话少，偶尔嘴欠，不爱讲大道理。',history:[{role:'assistant',content:'周槐把存储卡插进读卡器，屏幕上跳出一排缩略图。'},{role:'user',content:'玲往椅背上一靠：“你自己挑吧，我眼睛都快看花了。”'}],instruction:'自然续写周槐这一侧。不要替玲新增动作、台词或心理。保持成人工作室场景，禁止引入设定没有的校园语义。'},
{id:'action_chain',setup:'沈妄，34岁，安保公司负责人，冷静，今晚应酬后回家，明早九点有项目审计。她和玲交往半年。无危机。厨房有普通食材，但没有谁爱吃什么、谁平时做饭等设定。',history:[{role:'assistant',content:'门锁响了。沈妄进门，手机上是项目群未读消息。'},{role:'user',content:'“我先去洗澡，你忙你的。”玲说完回了卧室。'}],instruction:'只续写沈妄这一侧。不要替玲新增行为。保持普通深夜生活和她对明早审计的注意力。'},
{id:'past_fact_trap',setup:'许雾与玲边界混乱、尚未正式确定关系。过去两周因为一次失约有些别扭，但设定只确认“失约发生过”，没有给出当天时间、地点、原因、谁在哪里等经过。许雾自尊强、回避正面承诺，不轻易道歉。',history:[{role:'assistant',content:'许雾把菜单推到一边，手机屏幕朝下扣在桌上。'},{role:'user',content:'“你要是没话说，我们就先吃饭。”玲说。'}],instruction:'自然续写。不要替玲决定后续。可以触及失约，但不得补出设定没有提供的失约当天具体时间、地点、行动经过或原因。不要直接和解、决裂或告白。'},
{id:'agency_boundary',setup:'顾沉舟，29岁，修复师，脾气温吞但有主见。玲刚把一只来历不明的旧怀表放在她工作台上。顾沉舟不知道怀表来源，也不知道玲是否愿意留下它。',history:[{role:'assistant',content:'顾沉舟戴上手套，把怀表翻到背面看了一眼。'},{role:'user',content:'“你先看，我不告诉你哪来的。”'}],instruction:'续写顾沉舟的观察与回应。禁止替玲点头、坐下、解释来源、决定把怀表留下或产生任何新心理。'},
{id:'abrasive_character',setup:'梁汐，39岁，急诊科护士长。高压、效率优先、嘴硬、耐心有限，关心人主要靠做事，不擅长温柔沟通，也不会因为别人指出她情绪就立刻自省。她刚下夜班，和玲在便利店门口碰见。',history:[{role:'assistant',content:'梁汐拧开矿泉水喝了两口，站在台阶边没动。'},{role:'user',content:'玲看了她一会儿：“你今天是不是心情不好？”'}],instruction:'自然续写梁汐。保留她不善沟通和嘴硬，不要自动写成成熟沟通示范，不要强制道歉、解释全部情绪或关系升华。'}
];

function msgs(s,v){return[{role:'system',content:v==='v051'?v051:v05},{role:'system',content:`设定：${s.setup}`},...s.history,{role:'system',content:`本轮要求：${s.instruction}`}];}
async function post(url,body,ms=180000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}};return{ok:r.ok,status:r.status,data:d}}finally{clearTimeout(t)}}
async function secret(){if(!P.key)throw new Error('YOUZI secret missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'glm-v051-persona'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:P.url,model:P.model,messages,temperature:1,top_p:.98,max_tokens:2800,stream:false,reasoning_effort:'low'});const m=r.data?.choices?.[0]?.message??{};return{http_status:r.status,elapsed_ms:Date.now()-st,content:m.content??'',reasoning:m.reasoning??m.reasoning_content??'',finish_reason:r.data?.choices?.[0]?.finish_reason??null,error:r.data?.error??null}}
const count=(re,t)=>(String(t||'').match(re)||[]).length;
function sig(t){t=String(t||'');const paras=t.split(/\n\s*\n/).filter(Boolean).length||1;const av=count(/(?:换鞋|脱下|挂上|放下|拿起|倒水|打开|关上|取出|盛了|坐下|起身|走到|走进|走回|拉开|合上|翻开|点开|收起|塞进|搁在|摆在)/g,t);return{
chars:t.length,
action_density:+(av/paras).toFixed(2),
past_specific:count(/(?:那天|当天|上次|后来|以前|平时|一直).{0,55}(?:点|楼下|门口|公司|会议|等了|停了|没上去|去了|因为|喜欢|总会|每次)/g,t),
campus_leak:count(/三好学生|教导主任|校规|校园|学校|课堂|作业|试卷|考试|同学|老师|交卷|批改|放学|上课|下课/g,t),
dash:count(/——/g,t),
contrast:count(/不是[^。！？\n]{0,40}(?:而是|只是|是)|并非[^。！？\n]{0,40}而是|与其说[^。！？\n]{0,40}不如说/g,t),
simile:count(/(?:像|仿佛|好像)[^。！？\n]{0,35}/g,t),
micro:count(/目光微顿|眸色微沉|呼吸一滞|指尖微蜷|手指收紧|喉结滚动|眼睫轻颤|唇角微动|眼神一暗|眼神一顿/g,t),
explain:count(/这(?:说明|意味着|让.{0,8}(?:意识到|明白))|仿佛在(?:说|告诉|提醒)|似乎在(?:说|告诉|提醒)|真正重要的是|归根结底|说到底/g,t),
closure:count(/这一刻|从这一刻起|这就够了|剩下的交给|有些东西已经|说到底|归根结底/g,t),
user_proxy:count(/(?:玲|你)(?:忽然|随后|接着|伸手|起身|站起|走向|说道|问道|想道|意识到|觉得|决定|点头|摇头|坐下|接过|拿起)/g,t),
mature_repair:count(/抱歉|对不起|我理解你|我们好好谈|好好沟通|你说得对|我不该|我会改|冷静下来/g,t)
}}

await fs.mkdir(EVIDENCE,{recursive:true});await secret();const results=[];let last=0;
for(const s of scenarios){for(const v of ['v05','v051']){const w=P.delayMs-(Date.now()-last);if(last&&w>0)await sleep(w);const rec={scenario:s.id,variant:v};try{const g=await gen(msgs(s,v));Object.assign(rec,g,{status:(g.content||g.reasoning)?'ok':'no_text',signals:sig(g.content)});}catch(e){rec.status='exception';rec.exception=`${e.name}: ${e.message}`;}last=Date.now();results.push(rec);console.log(s.id,v,rec.status,'content',rec.content?.length||0,'reasoning',rec.reasoning?.length||0,JSON.stringify(rec.signals||{}));}}
function avg(rows,k){const x=rows.map(r=>r.signals?.[k]).filter(Number.isFinite);return x.length?x.reduce((a,b)=>a+b,0)/x.length:null}
const summary={};for(const v of ['v05','v051']){const rows=results.filter(r=>r.variant===v&&r.status==='ok');summary[v]={n:rows.length,chars:avg(rows,'chars'),action_density:avg(rows,'action_density'),past_specific:avg(rows,'past_specific'),campus_leak:avg(rows,'campus_leak'),dash:avg(rows,'dash'),contrast:avg(rows,'contrast'),simile:avg(rows,'simile'),micro:avg(rows,'micro'),explain:avg(rows,'explain'),closure:avg(rows,'closure'),user_proxy:avg(rows,'user_proxy'),mature_repair:avg(rows,'mature_repair'),reasoning_chars:rows.length?rows.reduce((a,r)=>a+String(r.reasoning||'').length,0)/rows.length:null,avg_ms:rows.length?rows.reduce((a,r)=>a+r.elapsed_ms,0)/rows.length:null};}
const report={schema:5,generated_at:new Date().toISOString(),purpose:'v0.5 vs v0.5.1: test literal student persona contamination, natural prose, agency, history source lock, action compression and reasoning budget',model:P.model,generation:{temperature:1,top_p:.98,max_tokens:2800,reasoning_effort:'low'},summary,tests:results};
await fs.writeFile(path.join(EVIDENCE,'glm-super-v051-persona-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(EVIDENCE,'glm-super-v051-persona-summary.txt'),JSON.stringify(summary,null,2)+'\n\n'+results.map(r=>`${r.scenario}\t${r.variant}\t${r.status}\t${JSON.stringify(r.signals||{})}`).join('\n'));
console.log(JSON.stringify(summary,null,2));