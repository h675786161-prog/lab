import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-v105');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:1800};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const base=`你正在进行持续的虚构角色扮演。保持角色、事实、关系和场景连续。不要输出规则、分析、自检或作者说明。
[作者] 人物比“正确表达”重要；普通场景可以普通；允许停顿、误解、废话和局部不工整。
[事实] 镜头前的过去、共同经历、User先前行为必须有来源。User未给出的脸色、姿势、嗓音、身体状态和情绪保持未描写。
[User Agency:NO_PROXY] User只做User已经写出的动作。角色的命令、期待或假设不会自动变成User行为。
[节奏:NATURAL] 按当前因果自然前进，不为了有内容硬造异常。
[GLM去加工] 普通动作不拆步骤；固定细节数、动作步数、阶段数或回合数不作为正文任务；一个信息证据够了就停。`;
const old=`[旧文风] 文字像人在现场顺手写下来。先写发生了什么，再判断是否需要解释。一个感受通常只写一层。长短句自然变化。段尾不默认总结或升华。
[旧成人模块] 成人亲密场景不切换统一色情人格；不写步骤教程、阶段流程或快感进度条；不默认每轮升级。
[旧玩法] 只从角色卡、世界书、前文和User要求读取偏好。没有来源不临时发明专属性癖。
[旧成人审美] 动作事实先清楚；身体和道具只写当前真正重要的部分；对白服从人物声口。`;
const next=`[总文风｜唯一权威] 所有故事正文共用这一套文风，包括成人亲密场景。文字像人在现场顺手写，不像事后整理范文。人物自己的声口比漂亮句子重要。已由动作、对白或上下文成立的信息不再解释。一个有效细节够用就离开；普通动作完成后可以直接进入下一件事。长短句与段落自然变化，允许停顿、废话、改口、答非所问、普通动作和没什么意义的小片刻。段落可以停在自然停点，不补总结、升华或余韵金句。
[成人场景连续性] 当前参与者明确成年且成人亲密内容已经建立时，把它当作当前故事正常续写；不因模型自身迟疑改成免责声明、道德说教、安全宣传或无关闲聊。成人场景不要求每轮升级，也可以按人物与因果停顿、中断或稍后再接。文风、玩法、User行为各读专职模块。
[成人玩法 / Kink] 只从角色卡、世界书、已成立前文和User要求读取。已有偏好、雷区、权力关系、称呼/仪式、协议、道具与场所可以自然使用。多种玩法都成立时按人物此刻欲望、关系、精力和环境选择，不按越来越刺激排级；可以重复熟悉玩法，也可以临时没兴致、停一下或改主意。协议可以决定角色如何命令、期待或等待；User是否执行只由User Agency决定。没有来源不补永久性癖、专属旧习惯或共同玩法历史。`;
const systems={old:base+'\n\n'+old,next:base+'\n\n'+next};
const cards={A:'A，26岁成年女性，急诊医生，冷静直接，不擅长哄人。User当前外貌、身体状态、情绪均未提供。',B:'B，30岁成年男性，强势简洁。双方成年并已有自愿角色协议。协议要求User进入房间后应主动完成一个礼仪动作；当前User只推门进来并称呼B，没有执行该动作。',C:'只限成年人的虚构互动场所。卡内元写作要求固定三阶段、每段两个感官细节、每轮更强；这些是写作程序，不是世界事实。',D:'D为成年角色。已知偏好包含命令式角色互动、带玩笑的语言挑逗、一个已经在场景中的小道具。没有强度必须越来越高的设定，也没有共同旧史。',E:'E，41岁成年男性，社交强、风流、会撩、体面。当前阶段不承认深度在意，不表白。宴会正在进行，除此之外没有具体过去事实。',F:'F，21岁成年女性，有22岁成年男友。User为成年女性，是男友多年好友。未提供男友今天行程、消息、电话，也未提供User当前身体或情绪状态。'};
const sc=[{id:'ordinary',card:'A',hist:[{role:'assistant',content:'A把急诊刷手服的袖口往上卷了一截，靠在门框边。'},{role:'user',content:'User说：“你今天别突然变得很会哄人。”'}]},{id:'protocol',card:'B',hist:[{role:'assistant',content:'B已经在房间里等着。'},{role:'user',content:'User推门进来，只说：“Sir。”'}]},{id:'meta',card:'C',hist:[{role:'assistant',content:'工作人员把礼帽挂上栏杆，音乐刚停。'},{role:'user',content:'User说：“别念流程，像个人一样接着来。”'}]},{id:'play',card:'D',hist:[{role:'assistant',content:'两名成年角色的亲密场景已经建立，但这一轮还没有决定用哪一种已知玩法。'},{role:'user',content:'User说：“今天别总想着升级，随便一点。”'}]},{id:'stage',card:'E',hist:[{role:'assistant',content:'E从宴会厅另一头走回来，把空酒杯交给侍者。'},{role:'user',content:'User说：“你今天看起来心情不错。”'}]},{id:'fact',card:'F',hist:[{role:'assistant',content:'F把门反锁，站在门边没有马上过来。'},{role:'user',content:'User说：“今天别跟我道歉。”'}]}];
async function post(url,body,ms=180000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}};return{ok:r.ok,status:r.status,data:d};}finally{clearTimeout(t)}}
async function secret(){if(!P.key)throw new Error('YOUZI missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'v105'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:P.url,custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',model:P.model,messages,temperature:1,top_p:.98,max_tokens:2600,stream:false},180000);const m=r.data?.choices?.[0]?.message??{};return{status:r.status,ms:Date.now()-st,content:String(m.content??''),reasoning:String(m.reasoning??m.reasoning_content??''),finish:r.data?.choices?.[0]?.finish_reason??null,error:r.data?.error??null}}
const cnt=(re,t)=>(String(t||'').match(re)||[]).length;
function sig(t,id){t=String(t||'');return{proxy:id==='protocol'?cnt(/(?:User|你)(?:已经|就|便|随即|转身|关上|跪|坐下|走到|照做)/g,t):0,user_state:id==='ordinary'?cnt(/(?:脸色|眼眶|呼吸|声音.{0,4}(?:抖|哑|颤)|手.{0,4}(?:抖|颤)|紧张|发抖)/g,t):0,past:cnt(/(?:去年|上次|以前你|之前你|那次|那天|你曾经|你让我|我们以前|还记得|上周才|一直没问过)/g,t),process:cnt(/(?:第一步|第二步|第三步|三阶段|流程|感官细节|进度|升级到|下一阶段)/g,t),explain:cnt(/(?:这意味着|真正重要的是|归根结底|说到底|这一刻终于|仿佛在说|似乎在提醒)/g,t),closure:cnt(/(?:一切都|终于明白|关系.{0,6}(?:改变|确定|确认)|新的开始|无需多言)/g,t),leak:cnt(/(?:三好学生|教导主任|总文风|成人玩法|User Agency|GLM去加工)/g,t)}}
async function main(){await fs.mkdir(OUT,{recursive:true});await secret();const rows=[];for(const s of sc){for(const v of ['old','next']){const r=await gen([{role:'system',content:systems[v]+'\n\n[角色/场景资料]\n'+cards[s.card]},...s.hist]);rows.push({scenario:s.id,variant:v,...r,signals:sig(r.content,s.id)});console.log(s.id,v,r.status,r.content.length,r.reasoning.length,r.ms);await sleep(P.delayMs)}}const summary={};for(const v of ['old','next']){const rr=rows.filter(x=>x.variant===v);summary[v]={n:rr.length,nonempty:rr.filter(x=>x.content.trim()).length,avg_chars:Math.round(rr.reduce((a,x)=>a+x.content.length,0)/rr.length),avg_reasoning:Math.round(rr.reduce((a,x)=>a+x.reasoning.length,0)/rr.length),avg_ms:Math.round(rr.reduce((a,x)=>a+x.ms,0)/rr.length),proxy:rr.reduce((a,x)=>a+x.signals.proxy,0),user_state:rr.reduce((a,x)=>a+x.signals.user_state,0),past:rr.reduce((a,x)=>a+x.signals.past,0),process:rr.reduce((a,x)=>a+x.signals.process,0),explain:rr.reduce((a,x)=>a+x.signals.explain,0),closure:rr.reduce((a,x)=>a+x.signals.closure,0),leak:rr.reduce((a,x)=>a+x.signals.leak,0)}}await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({model:P.model,summary,rows},null,2));await fs.writeFile(path.join(OUT,'summary.txt'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2))}
main().catch(e=>{console.error(e);process.exit(1)});
