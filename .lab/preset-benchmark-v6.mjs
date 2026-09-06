import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const EVIDENCE=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence');
const providers={YOUZI:{url:'https://youzi.today/v1',key:process.env.YOUZI||'',delayMs:1800},GG:{url:'https://gcli.ggchan.dev/v1',key:process.env.GG||'',delayMs:28000}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const common=[
 {name:'⚠️丨防复述',role:'system',content:`<latest_input_rule>用户最新输入已经发生。直接从结果继续，不重新演一遍，不润色复写。不得替user新增台词、动作、决定、计划、内心、感官或态度变化。需要user下一步选择时，只写NPC/环境一侧并停。</latest_input_rule>{{setvar::push_rule::直接承接，不复述，不代理user。}}`},
 {name:'🤔丨反抢话',role:'system',content:`{{setvar::agency_contract::<user_agency>最新user消息之后，user实体冻结：任何指代user的名字、代词、身份称呼都不得成为新动作、台词、心理、感官、决定或状态变化的主体。NPC可以对user说话或回应已发生内容，但不能替user完成下一步。</user_agency>}}{{setvar::cot_anti_hijack::正文若新增user行为/话语/心理，整句删掉；需要回应就停。}}`},
 {name:'🤔丨User去中心化',role:'system',content:`{{setvar::cot_core_principle::NPC先按自己的目标、工作、关系和风险行动。user不是自动世界中心；当前因果不需要user时，本轮正文可以完全不提user。}}`},
];
const glm=`<model_calibration family="GLM" priority="late-final">
这是写正文前最后一道硬门禁，优先于“写得丰富/有戏/有情绪”的倾向。
1. 最新user消息之后，user实体冻结。正文禁止新增任何user动作、台词、心理、感官、决定、姿态变化或生活细节；也禁止用“她/角落里的客人/对面的人”等别称绕过。可以让NPC回应user已经说过的话，然后只写NPC/环境一侧。
2. 未知信息保持未知。未知文件、记录、包裹、离屏事件可以写材质、破损、普通登记、难辨字迹，但禁止新增任何像“警告/禁令/规则/异常记录/关键名字/特殊日期/谜题对应短句”的内容；不得擅自让已知物件移动、消失、被拿走或获得新主人。
3. 已知但未定性的事实可以继续挂起。角色看见一个陌生包裹，不自动等于害怕、心虚、必须调查、必须公开；没有明确目标/风险/刺激时，他可以继续原事务，只让这个事实轻微影响选择或暂时不处理。
4. 不为结尾制造新来客、灯灭、脚步、异响、电话、发现、事故、秘密揭晓或危险。安静落稳是合法结尾。
5. 不用视线/手指/呼吸/姿势流水线，也不在动作后追加同义心理解释。最近几轮只继承事实，不复制句式。
6. 情感浓度本轮不强制深化；角色卡和当前事件自己决定情绪幅度。
输出前逐句审：只要一句话需要“替user补了一点”或“为了有戏新造了一点事实”才成立，就删掉。
</model_calibration>
{{setvar::model_family::GLM}}{{setvar::claude::}}{{setvar::gemini::}}{{setvar::emotion_density::}}{{setvar::model_focus::【GLM】user冻结；未知保持未知；无来源不加戏。}}{{setvar::cot_anti_hijack::【GLM最后检查】user实体在最新消息后不能新增任何行为/话语/心理；匿名指代同样算。}}{{setvar::cot_anti_despair::【GLM最后检查】未知文件/物件/离屏事件不得变成新规则、线索、移动、消失、新事故；无因果允许平静结束。}}`;
const gemini=`<model_calibration family="Gemini" priority="late-final">
这是写正文前最后一道校准。不要把“写出深层情绪/制造悬念/推进一件事”当作每轮任务。
1. 已建立事实按原强度继承。陌生物件只是陌生物件；人物轻微异样只是轻微异样。没有明确证据时，不升级为害怕、心虚、掩饰、看穿、危险、秘密负担，也不凭空引入能解释它的新人物/事件。
2. 知情不等于必须处理。某角色独自知道一个未定性事实，可以让它继续保持私人且暂时不行动；“为了推进剧情/让群像有事做/制造悬念”不是披露、调查或新增来客的理由。
3. user最新输入已发生，禁止重演、延长或解释其喝茶、看一眼、窝着、沉默等动作。当前因果不需要user时，本轮正文可以完全不提user，也不要让NPC反复瞥向user证明注意力。
4. 普通稳定恋爱日常默认不触发情感深化。回家、问候、吃饭、洗澡、工作、同处一室只按人物生活节奏写；不要额外写“因为user在这里才放松/卸下防备/安全感/归属/更深确认/老夫老妻”，也不加占有式触碰证明亲密。
5. 不为结尾新增客人、电话、灯灭、事故、秘密揭晓或新危险。允许人物继续工作、闲聊、收拾东西，或当前小节点自然落稳。
6. 不用连续小动作证明心理；一个有效动作足够。
输出前问：如果删掉“隐藏意味/关系深化/新悬念”，这段仍能自然续写吗？能，就删掉它们。
</model_calibration>
{{setvar::model_family::Gemini}}{{setvar::claude::}}{{setvar::gemini::Gemini：事实按原强度延续，保持输出标签。}}{{setvar::emotion_density::}}{{setvar::model_focus::【Gemini】不自动深挖情绪，不自动悬念化未知，不自动把注意力拉回user。}}{{setvar::cot_anti_despair::【Gemini最后检查】普通日常不深化关系；未知不升级悬念；没有因果不新增事件。}}`;
const tests=[
 {family:'GLM',provider:'YOUZI',model:'[B]glm-5.3-flash',scenario:'strong_character_quiet'},
 {family:'GLM',provider:'YOUZI',model:'[B]glm-5.3-flash',scenario:'ensemble_knowledge'},
 {family:'GLM',provider:'YOUZI',model:'[B]glm-5.3-flash',scenario:'horror_causality'},
 {family:'Gemini',provider:'GG',model:'gemini-3.1-pro-preview',scenario:'ensemble_knowledge'},
 {family:'Gemini',provider:'GG',model:'gemini-3.1-pro-preview',scenario:'strong_character_quiet'},
];
async function loadPack(){const dir=path.join(ROOT,'fixtures/preset-benchmark');const names=(await fs.readdir(dir)).filter(n=>/^prompts\.part\d+\.b64$/.test(n)).sort();let b64='';for(const n of names)b64+=(await fs.readFile(path.join(dir,n),'utf8')).trim();const pack=JSON.parse(zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));pack.sequence=pack.sequence.filter(x=>!['⚠️丨扩写+加强复述','⚠️丨防复述','🤔丨反抢话','🤔丨User去中心化'].includes(x.name));const thinkIdx=Math.max(0,pack.sequence.findIndex(x=>x.name==='🔧丨玲七轻量思考'));pack.sequence.splice(thinkIdx,0,...common);const ai=pack.sequence.findIndex(x=>x.adapter);if(ai>=0)pack.sequence.splice(ai,1);const ui=pack.sequence.findIndex(x=>x.name==='🔒丨User_Input');pack.sequence.splice(ui+1,0,{adapter:true,name:'MODEL_LATE',role:'system',content:''});return pack}
function clean(t){return String(t??'').replace(/\{\{\/[\s\S]*?\}\}/g,'')}
function expand(t,vars,s){t=clean(t);for(let i=0;i<18;i++){const old=t;t=t.replace(/\{\{getvar::([^{}]+?)\}\}/g,(_,n)=>vars[n.trim()]??'').replace(/\{\{setvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=v,'')).replace(/\{\{addvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=(vars[n.trim()]??'')+v,'')).replace(/\{\{trim\}\}/g,'').replace(/\{\{random::([^{}]*?)\}\}/g,(_,v)=>String(v).split('::')[0]??'').replaceAll('{{lastUserMessage}}',s.history.filter(x=>x.role==='user').at(-1)?.content??'').replaceAll('{{user}}',s.user_name).replaceAll('{{char}}',s.char_name).replaceAll('{{persona}}',`用户角色${s.user_name}只由用户控制。`).replaceAll('{{description}}',s.setup).replaceAll('{{personality}}','').replaceAll('{{scenario}}','');if(t===old)break}return t.trim()}
function marker(item,s){if(item.content!==null&&item.content!==undefined)return null;switch(item.name){case'👤丨用户角色描述':return[{role:'system',content:`用户角色：${s.user_name}，只由用户控制。`}];case'⚫丨角色描述':return[{role:'system',content:s.setup}];case'Chat History':return s.history.map(x=>({role:x.role,content:x.content}));default:return[]}}
function build(pack,test,s){const vars={},messages=[];for(const slot of pack.sequence){let item=slot;if(slot.adapter)item={...slot,content:test.family==='GLM'?glm:gemini};const m=marker(item,s);if(m!==null){messages.push(...m);continue}const c=expand(item.content,vars,s);if(c)messages.push({role:item.role||'system',content:c})}return messages}
async function postJson(url,body,timeoutMs=150000){const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeoutMs);try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});const tx=await res.text();let data;try{data=JSON.parse(tx)}catch{data={raw:tx}}return{status:res.status,ok:res.ok,data}}finally{clearTimeout(timer)}}
async function setSecret(name){const p=providers[name];if(!p.key)throw new Error(`${name} secret missing`);const r=await postJson(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:p.key,label:`focus-v6-${name}`},30000);if(!r.ok)throw new Error(`secret ${name} HTTP ${r.status}`)}
async function generate(test,messages){const p=providers[test.provider],started=Date.now();const max=test.family==='Gemini'?3000:2000;const r=await postJson(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:p.url,model:test.model,messages,temperature:.78,top_p:.93,max_tokens:max,stream:false},150000);const msg=r.data?.choices?.[0]?.message??{};return{http_status:r.status,http_ok:r.ok,elapsed_ms:Date.now()-started,content:msg.content??'',reasoning:msg.reasoning??msg.reasoning_content??'',finish_reason:r.data?.choices?.[0]?.finish_reason??null,upstream_error:r.data?.error??null}}
function sig(text,s){const t=String(text||'');const u=s.user_name;return{chars:t.length,user_new:new RegExp(`${u}[^。！？\n]{0,45}(?:说|问|答|开口|凑|抬|低|转|走|站|坐|伸|拿|喝|指|推|拉|看了|看向|收|翻|想|觉得|点头|摇头)|角落里(?:那位|的)?客人[^。！？\n]{0,45}(?:喝|嗑|抬|低|看|坐|端|拿)`).test(t),mystery_invention:s.id==='horror_causality'&&/(不许|禁止|不得|夜巡|特殊|规则|钥匙|婴儿.*记录|东侧.*异常|三楼.*药|病患日记)/.test(t),new_event:/(突然走进|走进来一个|灯.*灭|脚步声|电话.*响|门外.*人|陌生人|不见了|消失了)/.test(t),secret_overread:s.id==='ensemble_knowledge'&&/(心虚|害怕|恐惧|惊慌|掩饰|撞邪|魂不守舍|做贼|秘密.*压|不敢.*包)/s.test(t),romance_deepen:s.id==='strong_character_quiet'&&/(卸下防备|安全感|归属|老夫老妻|属于两个人|因为.*玲.*放松|放松.*玲|更深.*确认|占有)/s.test(t)}}
await fs.mkdir(EVIDENCE,{recursive:true});const pack=await loadPack();const data=JSON.parse(await fs.readFile(path.join(ROOT,'fixtures/preset-benchmark/scenarios.json'),'utf8'));const sm=Object.fromEntries(data.scenarios.map(s=>[s.id,s]));const results=[];let current=null,last=0;
for(const test of tests){const p=providers[test.provider];if(!p.key){results.push({...test,status:'skipped_missing_secret'});continue}if(current!==test.provider){if(current)await sleep(5000);await setSecret(test.provider);current=test.provider}const wait=p.delayMs-(Date.now()-last);if(last&&wait>0)await sleep(wait);const s=sm[test.scenario],messages=build(pack,test,s);const rec={...test,prompt_chars:messages.reduce((a,m)=>a+m.content.length,0),prompt_messages:messages.length};try{const g=await generate(test,messages);Object.assign(rec,g,{content_signals:sig(g.content,s),reasoning_signals:sig(g.reasoning,s),status:(g.content||g.reasoning)?'ok':'no_text'})}catch(e){rec.status='exception';rec.error=`${e.name}: ${e.message}`}last=Date.now();results.push(rec);console.log(`${test.family} ${test.scenario} ${rec.status} content=${rec.content?.length||0} reasoning=${rec.reasoning?.length||0} ms=${rec.elapsed_ms||0}`)}
await fs.writeFile(path.join(EVIDENCE,'preset-model-focus-v6.json'),JSON.stringify({schema:6,generated_at:new Date().toISOString(),purpose:'late-position GLM/Gemini calibration; emotion_density cleared',tests:results},null,2));
await fs.writeFile(path.join(EVIDENCE,'preset-model-focus-v6-summary.txt'),results.map(r=>`${r.family}\t${r.scenario}\t${r.status}\tcontent=${r.content?.length||0}\treasoning=${r.reasoning?.length||0}\tms=${r.elapsed_ms||0}`).join('\n')+'\n');
