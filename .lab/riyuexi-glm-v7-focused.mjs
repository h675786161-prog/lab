import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-glm-v7');
const YOUZI={url:'https://youzi.today/v1',key:process.env.YOUZI||'',delay:5000,model:'[B]glm-5.3-flash'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const pdir=path.join(ROOT,'fixtures/nsfw');
const packNames=(await fs.readdir(pdir)).filter(n=>/^glm-pack\.part\d+\.b64$/.test(n)).sort();
let b='';for(const n of packNames)b+=(await fs.readFile(path.join(pdir,n),'utf8')).trim();
const pack=JSON.parse(zlib.gunzipSync(Buffer.from(b,'base64')).toString('utf8'));

const GLOBAL=`[全局写作]
目标是让文字像人物和现场自己长出来，而不是展示“作者很会写”。
1. 清楚、准确、符合人物的普通说法永远允许。不要为了追求新奇而把一句能直说的话加工成陌生措辞。
2. 具体细节只有在能提供人物、行动、空间、因果或气氛信息时才需要；感官不是配额，动词、形容词、对白都按场景需要使用。
3. 不替读者总结已经能从场景看出的情绪、关系或意义。能停在事实、动作或一句话上时就停。
4. 对白首先像这个人会说的话：可以打断、跑题、重复、答非所问、直说、沉默，也可以很有目的；不要求每一句都漂亮或有潜台词。
5. 保持表达有变化，但不要为了“反套路”刻意换词、刻意制造粗糙或故意写得不完整。继承人物与事实，不复制最近几轮的句法和动作套餐。`;

const ANTI=`[表达去惯性·公共层]
历史文本只提供事实、关系与状态，不提供可复制的语言模板。每一轮重新根据当前人物、场景和动作组织表达。
- 不照搬近期的开场、段落节奏、动作排列、对白组织、情绪转折或结尾方式；但不为“必须变化”刻意炫技。
- 一个简单反应不要拆成眼神、呼吸、指尖、嘴角等连续微动作；单个细节足够就停止追加。
- 除非数字有实际意义，不用秒数、距离、角度、比例制造细腻感。
- 动作已经成立，不立刻翻译“这说明/这意味着/显然/真正原因”。
- 不依赖“不是A而是B、与其说A不如说B、看似A其实B”公布作者的正确答案。
- 不默认用低头、移开视线、沉默、停顿、手指停住、耳红、呼吸变化、欲言又止制造所有潜台词。
- 门、灯、杯子、姿势可以只是事实，不自动排列成关系隐喻；比喻不承担人物分析。
- 单轮不必完成情绪闭环；允许半途、没答案、行动只做一半、普通日常没有主题。
- 人物做事先因为身份、习惯、任务、欲望、现实处境与个人判断，不把每个动作都解释成对user的关系反馈。
- 对白首先符合角色本人，可以废话、重复、说错、跑题、答非所问、突然直白、懒得解释。
- 连续段落不要机械复用“环境→动作→心理解释→比喻→对白”或“动作→否定→停顿→补一句→潜台词说明”。
最终：继承事实，不继承旧腔；表达人物，不展示技巧；动作发生以后可以不解释；一句话能说完，不拆成五个动作。`;

const GLM=`[模型校准·GLM]
只纠正GLM容易把清楚写成“解释得过满”、把人物反应加工成规整论证的倾向：
- 保留GLM的清楚、稳定和因果感，但可观察的动作、事实或对白已经成立时，不自动再补“所以 / 这意味着 / 显然 / 真正原因”等解释性收束。
- 不把每段组织成“现象→分析→结论”。普通现场允许一句话、一个动作或一段没说完的对白直接成立。
- 对白先服从人物本人；允许短句、重复、跑题、答非所问、没接住，不为了显示人物洞察力把话加工成完整论述。
- 微动作只在真的改变信息或下一步时使用；不要靠眼神、呼吸、指尖等连续小反应补足“细腻”。
- 若【表达去惯性】开启，具体句法与结构去惯性交给它执行；本模块不重复列禁词或另造一套文风。
- Ecot只记本轮必要判断，不把判断扩成理由报告，也不提前写正文。
- 本模块不修改人物设定、抢转权限、剧情速度、关系、世界规则、字数、NSFW强度或文风选择。`;

const ECOT=`[V7 Ecot轻量执行]
只留下真正会改变本轮执行的少量结论，不提前写正文、动作序列、情绪弧线、剧情节点或结尾；没有触发就忽略，不为填表补内容。
若输出electric，只用Vol.1输入与权限、Vol.2事实与人物、Vol.3写法与输出三段，每段一两句即可。不要在Ecot里逐项复述模块名或解释为什么跳过。正文不预选最后一句、最后动作或情绪落点。`;

const TAIL=`[GLM尾部·V7]
KEEP Vol.1–Vol.3 concise; brief decisions are complete decisions. Active modules are instructions to execute, not subjects to explain. Do not expand Ecot into reasons, summaries, action sequences, emotional interpretation or prose rehearsal. Do not invent facts to make reasoning look thorough. Do not let checklist/explanatory wording leak into正文.`;

const scenes={
 kitchen:{char_name:'沈岚',user_name:'玲',persona:'玲，成年人。',description:'沈岚，34岁，女性结构工程师。做事利落，熟人面前嘴欠一点，忙起来会忘记照顾气氛。她和玲认识很久，关系稳定。',world:'普通工作日清晨，厨房。没有纪念日、争吵、秘密、告白、危机或关系转折。桌上有图纸、咖啡、早餐和车钥匙。',scenario:'她们准备出门上班。当前只需要承接眼前小事。',history:[{role:'assistant',content:'沈岚站在料理台边翻图纸，吐司烤过头了一点。她把焦边掰下来丢进盘子，嘴里还在算昨天那组梁的尺寸。'},{role:'user',content:'玲把车钥匙放到桌上：“你再算两分钟，咖啡就凉了。”'}]},
 office:{char_name:'沈岚',user_name:'玲',persona:'玲，成年人。',description:'沈岚，34岁，女性结构工程师；周淇，29岁，女性项目助理，话多但工作靠谱。三人熟悉，今天只是普通赶材料。',world:'中午十二点，临时办公室。打印机刚卡过纸，沈岚核图，周淇改表格。没有危机、阴谋、暧昧确认或重大节点。',scenario:'大家各有手头工作，午饭已经送到但没人记得具体放哪。',history:[{role:'assistant',content:'打印机又卡了一张纸。周淇蹲在旁边掀盖板，沈岚没抬头，只把红笔夹在耳后继续核页码。'},{role:'user',content:'玲看了一眼墙上的钟：“十二点了。你们谁还记得外卖放哪儿了？”'}]}
};

function strip(t){return String(t??'').replace(/\{\{\/[\s\S]*?\}\}/g,'')}
function expand(t,vars,s){t=strip(t);for(let i=0;i<24;i++){const old=t;t=t.replace(/\{\{getvar::([^{}]+?)\}\}/g,(_,n)=>vars[n.trim()]??'').replace(/\{\{setvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=v,'')).replace(/\{\{addvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=(vars[n.trim()]??'')+v,'')).replace(/\{\{trim\}\}/g,'').replace(/\{\{random::([^{}]*?)\}\}/g,(_,v)=>String(v).split('::')[0]??'').replaceAll('{{lastUserMessage}}',s.history.filter(x=>x.role==='user').at(-1)?.content??'').replaceAll('{{user}}',s.user_name).replaceAll('{{char}}',s.char_name).replaceAll('{{persona}}',s.persona).replaceAll('{{description}}',s.description).replaceAll('{{personality}}','').replaceAll('{{scenario}}',s.scenario);if(t===old)break}return t.trim()}
function marker(item,s){if(item.content!==null&&item.content!==undefined)return null;switch(item.name){case'👤丨用户角色描述':return[{role:'system',content:s.persona}];case'⚫丨角色定义之前':return[{role:'system',content:s.world}];case'⚫丨角色描述':return[{role:'system',content:s.description}];case'⚫丨角色情景':return[{role:'system',content:s.scenario}];case'Chat History':return s.history.map(x=>({...x}));case'Chat Examples':case'⚫丨角色性格':case'⚫丨角色定义之后':return[];default:return[]}}
function build(s,variant){const seq=pack.sequence.map(x=>({...x}));const ui=seq.findIndex(x=>x.name==='🔒丨User_Input');if(pack.adapters?.['✴️丨GLM模型适配'])seq.splice(ui+1,0,{...pack.adapters['✴️丨GLM模型适配']});const vars={},messages=[];for(const item of seq){const m=marker(item,s);if(m!==null){messages.push(...m);continue}const c=expand(item.content,vars,s);if(c)messages.push({role:item.role||'system',content:c})}if(variant==='v7'){const pos=Math.max(0,messages.length-2);messages.splice(pos,0,{role:'system',content:GLOBAL},{role:'system',content:ANTI},{role:'system',content:GLM},{role:'system',content:ECOT},{role:'system',content:TAIL})}const pos=Math.max(0,messages.length-2);messages.splice(pos,0,{role:'system',content:'[实验守卫] 当前是普通连续RP。关闭user演绎：不得替玲新增动作、对白、心理、身体状态、过去经历、工作、口味或决定。NPC与环境可以主动行动。不要为了“生活感”凭空生成无关事故、回忆、任务、秘密或关系变化。正文自然续写，约600—900中文字，不输出规则说明。'});return messages}
async function post(url,body,timeout=210000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}}return{ok:r.ok,status:r.status,data:d,text:tx}}finally{clearTimeout(t)}}
async function secret(){if(!YOUZI.key)throw new Error('YOUZI missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:YOUZI.key,label:'riyuexi-glm-v7'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){await secret();const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:YOUZI.url,custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',model:YOUZI.model,messages,temperature:.88,top_p:.96,max_tokens:5000,stream:false},210000);const m=r.data?.choices?.[0]?.message||{};return{http_status:r.status,elapsed_ms:Date.now()-st,content:m.content||'',reasoning:m.reasoning||m.reasoning_content||'',finish_reason:r.data?.choices?.[0]?.finish_reason||null,error:r.data?.error||null}}
function body(raw){raw=String(raw||'');const m=raw.match(/<content>([\s\S]*?)(?:<\/content>|$)/i);if(m)return m[1].trim();return raw.replace(/<electric>[\s\S]*?<\/electric>/i,'').trim()}
function cnt(re,t){return(t.match(re)||[]).length}
function stats(raw){const t=body(raw),e=(String(raw||'').match(/<electric>([\s\S]*?)<\/electric>/i)?.[1]||'');return{chars:t.length,ecot_chars:e.length,contrast:cnt(/不是.{0,24}而是|并非.{0,24}而是|与其说.{0,24}不如说|看似.{0,24}(?:其实|实则)|表面.{0,24}(?:其实|实际)/g,t),interpretive:cnt(/这(?:说明|意味着)|显然|真正(?:地|的|原因)|说到底|归根结底|本质上|换句话说|其实/g,t),micro:cnt(/呼吸.{0,8}(?:滞|停|乱|缓)|指(?:尖|节|骨).{0,10}(?:紧|白|颤|停)|眼神.{0,8}(?:暗|沉|顿)|睫毛.{0,6}颤|喉结|抿唇|移开视线/g,t),closure:cnt(/这一刻|终于(?:明白|意识到|承认|允许)|像是在(?:说|证明)|仿佛.{0,20}(?:落下|定格|宣告)|余韵|无需言明|不言而喻/g,t),essay:cnt(/因此|由此可见|这也(?:正是|说明)|原因很简单|意味着|显而易见/g,t),user_fact_risk:cnt(/玲.{0,12}(?:昨晚|平时|一向|习惯|喜欢|不喜欢|工作|案子|订单|口味|眼眶|身体)|你.{0,10}(?:昨晚|平时|一向|习惯|喜欢|案子|点的)/g,t)}}
await fs.mkdir(OUT,{recursive:true});await secret();const tests=[];for(const scene of ['kitchen','office'])for(const variant of ['current','v7'])tests.push({scene,variant});const out=[];for(let i=0;i<tests.length;i++){if(i)await sleep(YOUZI.delay);const t=tests[i],messages=build(scenes[t.scene],t.variant),r={...t,provider:'YOUZI',model:YOUZI.model,prompt_chars:messages.reduce((n,m)=>n+String(m.content||'').length,0)};try{Object.assign(r,await gen(messages));r.status=r.content?'ok':(r.reasoning?'reasoning_only':'no_text');r.stats=stats(r.content)}catch(e){r.status='exception';r.error=String(e)}out.push(r);console.log(`${t.scene}/${t.variant}: ${r.status} HTTP=${r.http_status} chars=${r.stats?.chars||0} ecot=${r.stats?.ecot_chars||0} contrast=${r.stats?.contrast||0} interpretive=${r.stats?.interpretive||0} micro=${r.stats?.micro||0} closure=${r.stats?.closure||0} userRisk=${r.stats?.user_fact_risk||0}`);await fs.writeFile(path.join(OUT,`${t.scene}-${t.variant}.txt`),r.content||`ERROR ${JSON.stringify(r.error)}`)}await fs.writeFile(path.join(OUT,'riyuexi-glm-v7-focused.json'),JSON.stringify({schema:1,kind:'riyuexi-v7-glm-focused',source_candidate_sha256:'758a1f1836f10964d5b44f89494e7917c73970e0e7c4e66c3abf6b664a230e52',note:'Focused compatibility probe: existing Riyuexi GLM pack + exact V7 corrective modules; not a full V7 frontend import.',real_sillytavern:true,provider:'YOUZI',model:YOUZI.model,tests:out},null,2));await fs.writeFile(path.join(OUT,'summary.txt'),out.map(r=>`${r.scene}/${r.variant}: ${r.status} HTTP=${r.http_status} ms=${r.elapsed_ms} prompt=${r.prompt_chars} stats=${JSON.stringify(r.stats||{})}`).join('\n')+'\n');if(out.some(r=>r.status!=='ok'))process.exitCode=2;
