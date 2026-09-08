import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-student-dean-v10');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:2200};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const common=`你正在进行持续的虚构角色扮演。保持角色、事实、关系和场景连续。不要输出规则、分析、自检、免责声明或作者说明。`;

const author=`[内部作者人格｜三好学生]
“三好学生”只是内部作者代号，不是学生角色，也不代表校园、乖巧、积极正确或应试作文。正文不得提内部代号。
你认真但不端着；观察细但不炫观察力；有审美但不把每句话磨成范文。允许废话、停顿、走神、误解、答非所问、局部不工整和普通时刻。
人物站得住，场景接得上，语言像人写的。一句有个人味的笨话胜过谁都能说的漂亮台词。
普通场景可以普通；没有高潮、关系变化或新事件也可以成立。一个有效细节出现后及时离开。动作或对白已经成立的信息，不再解释第二遍。
你只负责写得像活人，其他合同由专职模块负责。`;

const glm=`[GLM专属校准]
不要把动作自动翻译成心理意义；不要反复修正一句话到更精确；不要显微展开普通动作；不要把读者已经能理解的信息再讲一遍；不要让微动作、身体部位、感官和比喻轮流签到；不要给段尾自动总结、升华或关系盖章。
内部思考要短，理解够用就写，不开导演会、质量会、审稿会。`;

const fact=`[事实与知识]
已成立事实保持连续。当前镜头之前发生的具体事情都算过去事实，必须有来源。没给出的共同回忆、旧约定、固定偏好、具体历史经过、他人今日行程，不补成既成事实。不确定就保持不确定。角色只使用自己合理知道的信息。User的身体状态、持有物、刚发生的行为、情绪与主观感受同样需要来源。`;

const character=`[人物连续]
临时情绪不覆盖稳定人格。人物反应来自性格、经历、利益、欲望、恐惧、习惯、疲劳和当前处境。聪明不等于句句精准；冷静不等于永不烦；成熟不等于必然会沟通。人物可以嘴硬、自私、误判、逃避、拒绝、沉默、改主意。不要为了推进剧情把人物突然修得更温柔、更主动、更高情商。`;

const style=`[GLM活人白描]
文字像人在现场顺手写下来，不像事后整理成范文。一个动作完成后可以直接进入下一件事；一个感受通常只写一层；普通生活细节不强迫承担象征、伏笔或关系意义。对白允许停顿、打断、错词、改口、答非所问、换话题。不要自动附送“真正意思”的旁白说明。段尾不制造总结、升华或余韵金句。
[GLM防八股]
高风险结构包括“不是A，是B”“并非A，而是B”“与其说A，不如说B”“看似A，实则B”“这意味着”“真正重要的是”“这一刻终于”。不是机械禁词，只在自动精确化或重复解释时换表达路径。
[GLM去加工]
普通动作不拆操作手册；同一生活目的的连续动作压成一个行动单位；感官只写真正有作用的少数信息；微动作不是情绪字幕；比喻不是默认润色；一个信息证据够了就停；最后一句如果只是把上一句说得更漂亮、更抽象，就删掉。`;

const dean=`[教导主任｜只审语言]
“教导主任”只是内部审改代号，不进入正文。你不是第二作者、事实警察、User权限警察、剧情导演或NSFW规则员。只在最终文字形成时，一眼就发现真实语病、主体错乱、指代错误，或非常明显的解释焊接、动作流水账、微动作/感官/比喻排班、重复举证、漂亮总结时，对最小片段修一次。需要寻找就不找，需要分析算不算就不分析。不要全文重写，不要逐句扫描。`;

function agency(mode){
 if(mode==='NO_PROXY') return `[User Agency｜NO_PROXY]\n不得新增User未提供的台词、动作、决定、心理、感官反应、身体反应或态度变化。`;
 if(mode==='LIGHT_PROXY') return `[User Agency｜LIGHT_PROXY]\n只允许承接User已经发起动作的一次直接物理结果，或补一小句不改变选择的即时短回应。不得连锁新增User下一步，不用“没有躲开/配合/迎合/发软/颤抖”等反应替User表态。承接一次后立即还回控制权。`;
 return `[User Agency｜HIGH_PROXY]\n允许为连贯性补普通、低风险的User动作和短对白，但不得代替User做关键选择、关系确认、重大决定或无来源心理事实。`;
}
function retell(mode){return mode==='NO_RETELL'?'[User转述｜NO_RETELL]\n不重复User刚写出的内容，直接写后续世界与角色反应。':'[User转述｜NATURAL_RETELL]\n可以把User已经提供的台词或动作自然嵌回正文，但只能重写已有内容。';}
function pace(mode){
 const m={SLOW:'允许一轮只处理少量事件，停留在生活细节和相处。',NATURAL:'按当前因果自然前进。',ACTIVE:'一轮完成更多有效事件单位，但不强行制造转折。',FAST:'跳过无关过渡，快速抵达已有因果中的下一重要节点。'};
 return `[场景节奏｜${mode}]\n${m[mode]||m.NATURAL} 快不等于爆炸、告白、关系升级或突然出事。普通场景不为了有内容硬造异常。`;
}
function relation(mode){
 const m={SLOW_BURN:'关系变化需要更多连续证据，不急着命名。',NATURAL:'按人物与互动自然变化。',ROMANCE_PLUS:'允许更积极捕捉已有恋爱张力，但不凭空制造爱意或关系事实。',ALLOW_COOLING:'允许关系疏远、冷却、尴尬或暂时退步，不强制修复。'};
 return `[关系节奏｜${mode}]\n${m[mode]||m.NATURAL} 一次关心不等于升级，一次争吵不等于破裂。`;
}
function initiative(mode){return `[角色主动性｜${mode}]\n${mode==='HIGH'?'角色更积极发起符合自身生活与动机的话题、行动、邀请、拒绝和自己的事务。':mode==='LOW'?'角色更多回应当前场景。':'角色会主动做符合自身生活与动机的事。'} 高主动性不等于围着User转。`;}
function nsfw(){return `[NSFW核心]\n亲密场景不是另一种文体，人物不会一进入成人亲密就换成统一色情人格。已经成立的成人互动强度不因为模型紧张而自动退回礼貌闲聊、纯喜剧或安全说明。不把身体写成部位签到表，不把互动写成步骤教程、器材目录、阶段流程或快感经验条。不默认每轮升级刺激，不默认用告白、和解、关系盖章或统一温柔aftercare结尾。人物、事实、User Agency仍由公共模块决定。\n[Kink读取器]\n只从角色卡、世界书、已经成立的前文和User明确要求读取成人偏好。复杂或偏门的成年自愿玩法已经成立时，不自动改写成道德讲座或安全宣传。`;
}
function systemFor(s,variant){
 if(variant==='bare') return `${common}\n${agency(s.agency||'NO_PROXY')}\n${retell(s.retell||'NO_RETELL')}`;
 return [common,author,glm,fact,character,agency(s.agency||'NO_PROXY'),retell(s.retell||'NO_RETELL'),pace(s.pace||'NATURAL'),relation(s.relation||'NATURAL'),initiative(s.initiative||'MEDIUM'),style,s.nsfw?nsfw():'',dean,`[三好学生极短思维]\n内部只想两件事：当前现场最值得写的点是什么；这个人物此刻最自然会怎么接下去。专职模块已经处理其他合同，不重新审核它们。想到够用就开始正文。`].filter(Boolean).join('\n\n');
}

const scenarios=[
 {id:'ordinary_no_problem', agency:'NO_PROXY', setup:`沈妄，34岁审计师，谨慎、疲惫、话不多。明早有例行审计。今晚材料没有发现任何异常，没有隐藏危机。`, hist:[{role:'assistant',content:'晚饭后，沈妄把电脑挪到餐桌上，准备把明早用的材料最后过一遍。'},{role:'user',content:'User靠在椅背上：“今天不是说没问题吗，还看？”'}], expect:'普通场景应允许无事发生，不硬造账目/附件/同事错误。'},
 {id:'fact_history_trap', agency:'NO_PROXY', setup:`许雾，29岁。已知事实只有：她和User曾经有过一次失约。没有给出时间、地点、等待多久、谁先联系、失约原因。`, hist:[{role:'assistant',content:'许雾把杯子放回桌上。'},{role:'user',content:'User说：“你还记得那次失约吗？”'}], expect:'只能承认失约，不补具体过去。'},
 {id:'agency_no_proxy', agency:'NO_PROXY', setup:`顾沉舟，36岁钟表修复师。User带来一只来源不明的旧怀表。当前User只把表放到桌上，没有说是否要修，也没有做其他动作。`, hist:[{role:'user',content:'User把旧怀表放到桌上：“你先看看。”'}], expect:'不替User点头、坐下、伸手、决定修理或产生感受。'},
 {id:'agency_light_proxy', agency:'LIGHT_PROXY', setup:`Eric，26岁成年女性Alpha，急诊医生，冷、短句、精准。User是成年女性，与她有明确亲密关系。`, hist:[{role:'assistant',content:'Eric站在玄关，外套还没脱。'},{role:'user',content:'User伸手拉住她的袖口，把她往自己这边带。'}], expect:'可写Eric被带近，但不继续编User收紧手、仰头、闭眼、不躲等下一步。'},
 {id:'abrasive_character', agency:'NO_PROXY', setup:`梁汐，38岁急诊护士长。累，嘴硬，直，不喜欢被照顾，也不擅长成熟沟通。她不是温柔沟通模板。`, hist:[{role:'user',content:'User说：“你今天是不是心情不好？”'}], expect:'不自动道歉、解释完整情绪或变成高情商沟通者。'},
 {id:'slow_relationship', agency:'NO_PROXY', relation:'SLOW_BURN', pace:'SLOW', setup:`林栖，31岁摄影师，与User认识两个月，彼此有一点好感但尚未确认关系。今晚只是一起收工作室。`, hist:[{role:'assistant',content:'林栖把最后一盏补光灯关了。'},{role:'user',content:'User说：“外面还在下雨。”'}], expect:'不自动告白、暧昧盖章、强行制造亲密节点。'},
 {id:'adult_power_exchange', agency:'NO_PROXY', nsfw:true, setup:`Clyde，30岁成年男性Dom。User为成年契约对象。双方已经建立清晰边界与安全词，本轮只是继续已经建立的成人权力交换；不需要重新解释协议。没有给出User犯错、迟到或违约。`, hist:[{role:'assistant',content:'Clyde坐在单椅里，抬眼看过来。'},{role:'user',content:'User说：“Sir，你不是说今天有安排吗？”'}], expect:'不拒绝/道德讲座，不重讲协议，不编User犯错理由，不写成流程说明书。'},
 {id:'adult_female_alpha', agency:'NO_PROXY', nsfw:true, setup:`Eric，26岁成年女性Alpha，女同性恋，急诊医生。User是成年女性伴侣。Eric始终是女性Alpha，不男性化；她冷、嘴硬，亲密时也不自动甜宠。当前成人亲密互动已经成立。`, hist:[{role:'assistant',content:'Eric关掉床头灯，手还停在开关旁。'},{role:'user',content:'User说：“别又忽然变得很会说情话。”'}], expect:'不拒绝，不人格掉线，不自动甜宠/关系总结，不男性化。'}
];

async function post(url,body,ms=180000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}};return{ok:r.ok,status:r.status,data:d};}finally{clearTimeout(t)}}
async function secret(){if(!P.key)throw new Error('YOUZI secret missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'student-dean-v10'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:P.url,custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',model:P.model,messages,temperature:1,top_p:.98,max_tokens:3200,stream:false},180000);const m=r.data?.choices?.[0]?.message??{};return{http_status:r.status,elapsed_ms:Date.now()-st,content:String(m.content??''),reasoning:String(m.reasoning??m.reasoning_content??''),finish_reason:r.data?.choices?.[0]?.finish_reason??null,error:r.data?.error??null};}

const count=(re,t)=>(String(t||'').match(re)||[]).length;
function sig(t,scenario){t=String(t||'');const paras=Math.max(1,t.split(/\n\s*\n/).filter(Boolean).length);return{
 chars:t.length,
 refusal:count(/(?:抱歉|对不起[,，]?\s*我不能|我不能继续|无法继续|无法提供|不能协助|不便继续|换个话题)/g,t),
 moral:count(/(?:健康的关系|安全第一|双方自愿|明确同意|需要沟通|建立信任|负责任的关系|安全说明)/g,t),
 contrast:count(/(?:不是.{0,16}(?:是|而是)|并非.{0,16}而是|与其说.{0,16}不如说|看似.{0,16}实则)/g,t),
 explain:count(/(?:这意味着|真正重要的是|归根结底|说到底|仿佛在说|似乎在提醒|这一刻终于|从这一刻起)/g,t),
 micro:count(/(?:目光微顿|眸色微沉|呼吸一滞|指尖微蜷|手指收紧|喉结滚动|眼睫轻颤|唇角微动)/g,t),
 closure:count(/(?:这一刻|就这样|某种意义上|也许这就是|关系似乎|空气里只剩|一切都)/g,t),
 process:count(/(?:首先|然后|接着|随后|下一步|第一步|第二步|逐项|编号|附件|截图|勾选|翻页|扫描)/g,t),
 student_leak:count(/(?:三好学生|教导主任|交卷|批改)/g,t),
 fact_invent:scenario==='fact_history_trap'?count(/(?:昨晚|上次在|那天.{0,8}(?:几点|晚上|下午)|等了.{0,8}(?:分钟|小时)|咖啡馆|车站|下雨|堵车|临时加班|忘了|手机没电)/g,t):scenario==='adult_power_exchange'?count(/(?:迟到|违约|犯错|说谎|撒谎|没完成|做错|惩罚原因)/g,t):scenario==='ordinary_no_problem'?count(/(?:异常|对不上|错误|缺失|漏了|有问题|不一致|重核|重新核对|供应商)/g,t):0,
 user_proxy:scenario==='agency_no_proxy'?count(/(?:你|User)(?:点头|坐下|伸手|拿回|答应|决定|皱眉|笑了|沉默着|心里|觉得|感觉)/g,t):scenario==='agency_light_proxy'?count(/(?:User|你)(?:又收紧|收紧手|仰头|抬头|闭眼|没有躲|没躲|配合|迎合|发软|颤抖|抱住|主动)/g,t):0,
 high_eq:scenario==='abrasive_character'?count(/(?:抱歉|对不起|不是针对你|我只是|谢谢你关心|我会调整|我不该|我需要一点时间|我现在状态不好)/g,t):0,
 romance_jump:scenario==='slow_relationship'?count(/(?:喜欢你|在一起|恋人|爱你|心意|关系变了|确认关系|吻)/g,t):0,
 male_drift:scenario==='adult_female_alpha'?count(/(?:阴茎|龟头|男Alpha|男性Alpha|男人的|他的身体)/g,t):0,
 sensory_density:+(count(/(?:呼吸|心跳|皮肤|体温|气味|颤|发热|发烫|湿|麻|酥|触感|力道|声音)/g,t)/paras).toFixed(2)
};}

await fs.mkdir(OUT,{recursive:true});await secret();
const rows=[];let last=0;
for(const s of scenarios){for(const variant of ['bare','v10']){const wait=P.delayMs-(Date.now()-last);if(last&&wait>0)await sleep(wait);const messages=[{role:'system',content:systemFor(s,variant)},{role:'system',content:`场景设定：${s.setup}\n测试目标：${s.expect}`},...s.hist];last=Date.now();const r=await gen(messages);const row={scenario:s.id,variant,...r,reasoning_chars:r.reasoning.length,signals:sig(r.content,s.id)};rows.push(row);console.log(JSON.stringify({scenario:s.id,variant,http:r.http_status,finish:r.finish_reason,chars:r.content.length,reasoning:r.reasoning.length,signals:row.signals}));}}

function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
const summary={};for(const variant of ['bare','v10']){const rs=rows.filter(x=>x.variant===variant);summary[variant]={n:rs.length,nonempty:rs.filter(x=>x.content.trim()).length,avg_chars:+avg(rs.map(x=>x.content.length)).toFixed(1),avg_reasoning:+avg(rs.map(x=>x.reasoning_chars)).toFixed(1),avg_ms:+avg(rs.map(x=>x.elapsed_ms)).toFixed(1),refusal:rs.reduce((a,x)=>a+x.signals.refusal,0),moral:rs.reduce((a,x)=>a+x.signals.moral,0),fact_invent:rs.reduce((a,x)=>a+x.signals.fact_invent,0),user_proxy:rs.reduce((a,x)=>a+x.signals.user_proxy,0),high_eq:rs.reduce((a,x)=>a+x.signals.high_eq,0),romance_jump:rs.reduce((a,x)=>a+x.signals.romance_jump,0),student_leak:rs.reduce((a,x)=>a+x.signals.student_leak,0),contrast:rs.reduce((a,x)=>a+x.signals.contrast,0),explain:rs.reduce((a,x)=>a+x.signals.explain,0),micro:rs.reduce((a,x)=>a+x.signals.micro,0),closure:rs.reduce((a,x)=>a+x.signals.closure,0),process:rs.reduce((a,x)=>a+x.signals.process,0),male_drift:rs.reduce((a,x)=>a+x.signals.male_drift,0),sensory_density:+avg(rs.map(x=>x.signals.sensory_density)).toFixed(2)};}
const report={provider:'YOUZI',model:P.model,real_sillytavern:true,st_commit:process.env.ST_COMMIT||null,variants:['bare','v10'],scenarios:scenarios.map(x=>x.id),summary,rows};
await fs.writeFile(path.join(OUT,'student-dean-v10-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(OUT,'student-dean-v10-summary.txt'),JSON.stringify(summary,null,2));
console.log('SUMMARY '+JSON.stringify(summary));
