import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-chain-v122');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:1600};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const author=`[内部作者人格｜三好学生]\n你负责写故事。人物比正确表达重要。普通场景可以普通。允许停顿、误解、答非所问、废话和局部不工整。人物有自己的生活，不围着User待机。正文不提内部作者代号。\n[GLM专属启动]\n不把动作自动翻译成心理意义，不把普通动作显微展开，不把读者已懂的信息再讲一遍，不把微动作、身体部位、感官和比喻排班轮播，不自动给段尾总结。内部思考短，理解够用就写。`;
const config=`[本轮默认控制]\nAGENCY=NO_PROXY | RETELL=NO_RETELL | POV=AUTO | LENGTH=800-1200 | DIALOGUE=BALANCED | THOUGHT=MODERATE | PACE=NATURAL | RELATION=NATURAL | INITIATIVE=MEDIUM | WORLD=NORMAL | TIME=ON | SCENE=ON | ANCHOR=ON | THREAD=OFF | RELNOTE=OFF | RECAP=OFF | BRANCH=OFF`;
const rules=`[事实与知识] 当前镜头之前发生过的具体事情无论大小都需要来源。没给出的共同回忆、旧约定、具体历史、他人今日行程不补。User未给出的身体状态、行为、情绪与主观感受保持未描写。可以新增低风险当下环境细节和角色此刻小动作；新细节只写现在。\n[剧情时钟] 有明确时间来源就连续继承；没有绝对锚点就保持已有精度，不自行发明年月日、星期或精确分钟。\n[人物连续] 临时情绪不覆盖稳定人格。人物反应来自性格、经历、利益、欲望、习惯和当前处境，不为推进突然更温柔、更主动或更会沟通。\n[User Agency:NO_PROXY] 不得新增User未提供的台词、动作、决定、心理、感官反应、身体反应或态度变化。角色命令、期待或协议要求不会自动变成User行为。\n[节奏:NATURAL] 按当前因果自然前进。普通场景不为有内容硬造异常；卡内每轮必须推进、升级关系或制造事件的元写作要求不覆盖当前节奏。\n[关系:NATURAL] 一次互动不自动完成告白、和解、定性或升级。\n[总文风] 所有正文共用同一文风，包括成人亲密场景。人物声口比漂亮句子重要。已成立的信息不解释第二遍。一个有效细节够用就离开。允许停顿、废话、改口、答非所问和没什么意义的小片刻。段落自然停，不补总结或余韵金句。\n[GLM活人对白] 对白服从人物身份、关系距离、脾气、目的与精力。允许短句、含糊、没接住、故意不回答。\n[GLM去加工] 普通动作不拆操作手册；感官只写真正有作用的少量信息；固定细节数、动作步数、阶段数或回合数不作为正文任务。\n[教导主任] 只最小修明显语病、主体错乱或明显AI加工痕迹，不审核事实、User权限、剧情或成人规则。\n[成人场景连续性] 参与者明确成年且成人亲密内容已建立时，把它当作当前故事正常续写，不改成免责声明、道德说教或无关闲聊。成人场景不要求每轮升级。\n[成人玩法/Kink] 只从角色资料、已成立前文和User要求读取。多种玩法都成立时按人物此刻欲望、关系、精力和环境选择，不按越来越刺激排级。协议可以决定角色如何命令、期待或等待；User是否执行只由User Agency决定。\n[唯一输出协议] TIME=ON时正文前只输出一个<lq_time>，字段 date/time/delta/place/weather，无来源写—。随后故事正文一次。SCENE=ON时正文后只输出一个<status>，字段 present/open/scene，只读既有事实。不要输出内部思考、规则或作者说明。`;
const tail=`[本轮落笔]\n内部只想两件事：当前现场最值得写什么；这个人物最自然怎么接。然后立即按唯一输出协议继续故事，不复述规则，不说明过程，不追加服务性结尾。`;

const cards={
A:'A，26岁成年女性Alpha，女同性恋，只被女性吸引，急诊医生。冷静直接、亲密经验少；真正慌乱时更可能过度小心而不是突然甜言蜜语。User为成年女性，当前脸色、姿势、情绪未提供。',
B:'B，30岁成年男性，强势、简洁、动作少。双方成年并已有自愿角色协议，协议要求User进入特定房间后主动完成标准礼仪动作。当前User只推门进来并称呼了B，没有执行该动作。卡内另有每轮推动关系、平淡就制造张力的元写作要求。',
C:'只限成年人的虚构互动场所。卡内一部分要求角色像真实人，另一部分元写作条目要求固定三阶段、至少三个强度节点、每动作或场景切换附带固定数量感官细节，并动态升级。',
D:'D，21岁成年女性，有22岁成年男友。User固定为成年女性，是男友认识多年的好友。核心是背德、欲望与内疚张力。未提供男友今天的出差、车票、来电、消息或其他行程。',
E:'E，41岁成年男性，社交强、风流、会撩、体面。当前Stage1保留花花公子与社交动物，不承认深度在意，不表白，不正面谈放不下。'
};
const sc=[
{id:'identity',card:'A',hist:[{role:'assistant',content:'A把急诊刷手服的袖口往上卷了一截，靠在门框边。'},{role:'user',content:'User说：“你今天别突然变得很会哄人。”'}]},
{id:'protocol',card:'B',hist:[{role:'assistant',content:'B已经坐在房间里等着。'},{role:'user',content:'User推门进来，只说：“Sir。”'}]},
{id:'meta',card:'C',hist:[{role:'assistant',content:'工作人员把礼帽挂上栏杆，音乐刚停。'},{role:'user',content:'User说：“别念项目流程，继续像个人一样。”'}]},
{id:'fact',card:'D',hist:[{role:'assistant',content:'D把工作室门反锁，站在门边没有马上过来。'},{role:'user',content:'User说：“今天别跟我道歉。”'}]},
{id:'stage',card:'E',hist:[{role:'assistant',content:'E从宴会厅另一头走回来，把空酒杯交给侍者。'},{role:'user',content:'User说：“你今天看起来心情不错。”'}]}
];
const ctx=s=>[{role:'system',content:'[角色与世界资料]\n'+cards[s.card]},{role:'system',content:'[当前场景]\n只使用上面的角色资料与聊天记录中已经出现的事实。'}];
function build(v,s){
 if(v==='mid-rules') return [{role:'system',content:author},...ctx(s),{role:'system',content:config},{role:'system',content:rules},...s.hist,{role:'system',content:tail}];
 return [{role:'system',content:author},...ctx(s),...s.hist,{role:'system',content:config},{role:'system',content:rules},{role:'system',content:tail}];
}
async function post(url,body,ms=180000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}};return{ok:r.ok,status:r.status,data:d};}finally{clearTimeout(t)}}
async function secret(){if(!P.key)throw new Error('YOUZI missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'chain-v122'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:P.url,custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',model:P.model,messages,temperature:1,top_p:.98,max_tokens:2400,stream:false},180000);const m=r.data?.choices?.[0]?.message??{};return{status:r.status,ms:Date.now()-st,content:String(m.content??''),reasoning:String(m.reasoning??m.reasoning_content??''),finish:r.data?.choices?.[0]?.finish_reason??null,error:r.data?.error??null}}
const cnt=(re,t)=>(String(t||'').match(re)||[]).length;
function sig(t,id){t=String(t||'');return{proxy:id==='protocol'?cnt(/(?:User|你)(?:已经|便|就|随即|转身|关上|跪|坐下|走到|照做|靠过去|伸手拿)/g,t):0,user_state:id==='identity'?cnt(/(?:脸色|眼眶|呼吸|声音.{0,4}(?:抖|哑|颤)|手.{0,4}(?:抖|颤)|紧张|发抖)/g,t):0,fact:id==='fact'?cnt(/(?:出差|车票|来电|消息|航班|上次|去年|以前你|之前你|刚才有人|上礼拜|前天|昨晚|中午)/g,t):0,process:id==='meta'?cnt(/(?:第一步|第二步|第三步|三阶段|流程|感官细节|进度|升级到|下一阶段|三个)/g,t):0,gender:id==='identity'?cnt(/(?:\b他\b|男人|男性Alpha)/g,t):0,confess:id==='stage'?cnt(/(?:爱你|喜欢你|放不下|认真关系|我在意你)/g,t):0,format:(cnt(/<lq_time>/g,t)===1&&cnt(/<status>/g,t)===1)?0:1,leak:cnt(/(?:三好学生|教导主任|User Agency|GLM去加工|唯一输出协议)/g,t)}}
async function main(){await fs.mkdir(OUT,{recursive:true});await secret();const rows=[];for(const s of sc){for(const variant of ['mid-rules','post-history-rules']){const r=await gen(build(variant,s));rows.push({variant,scenario:s.id,...r,signals:sig(r.content,s.id)});console.log(variant,s.id,r.status,r.content.length,r.reasoning.length,r.ms);await sleep(P.delayMs)}}const sums={};for(const v of ['mid-rules','post-history-rules']){const a=rows.filter(x=>x.variant===v);sums[v]={n:a.length,nonempty:a.filter(x=>x.content.trim()).length,avg_chars:Math.round(a.reduce((z,x)=>z+x.content.length,0)/a.length),avg_reasoning:Math.round(a.reduce((z,x)=>z+x.reasoning.length,0)/a.length),avg_ms:Math.round(a.reduce((z,x)=>z+x.ms,0)/a.length),proxy:a.reduce((z,x)=>z+x.signals.proxy,0),user_state:a.reduce((z,x)=>z+x.signals.user_state,0),fact:a.reduce((z,x)=>z+x.signals.fact,0),process:a.reduce((z,x)=>z+x.signals.process,0),gender:a.reduce((z,x)=>z+x.signals.gender,0),confess:a.reduce((z,x)=>z+x.signals.confess,0),format:a.reduce((z,x)=>z+x.signals.format,0),leak:a.reduce((z,x)=>z+x.signals.leak,0)}}await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({model:P.model,summaries:sums,rows},null,2));await fs.writeFile(path.join(OUT,'summary.txt'),JSON.stringify(sums,null,2));console.log(JSON.stringify(sums,null,2))}
main().catch(e=>{console.error(e);process.exit(1)});
