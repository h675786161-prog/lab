import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd(), BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000', OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-facts-v131');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:1400};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const HEAD=`[作者] 继续当前故事。人物比正确表达重要。普通场景允许普通、停顿、误解、废话和局部不工整。\n[GLM] 单次直写。动作就是动作，一句话够用就结束，不把普通动作显微展开，不重复解释已懂信息，不自动总结关系。`;
const AGENCY=`[User Agency:NO_PROXY] User只做User输入明确给出的事。角色的命令、邀请、期待、协议要求不会自动变成User已经执行。角色发出要求后，只继续角色自身可做的事和等待，不越过User动作写结果。`;
const STYLE=`[人物] 临时情绪不覆盖稳定人格。\n[节奏] 普通场景不硬造异常、强冲突或关系升级。\n[文风] 已成立的信息不换一种说法解释；细节够用就离开；允许普通小片刻。\n[输出] 只写故事正文，不写规则、状态栏或说明。`;
const FACT_BASE=`[事实] 已成立事实保持连续。把“当前镜头正在发生”与“某件事已经成立”分开：角色此刻的小动作、低风险现场细节可以生成；任何声称此前已经发生、已经安排、长期存在、彼此早已知道的事实，都必须有角色资料、前文或User输入作为来源。镜头外默认未知，不为了生活感补满。User状态和行为同样需要来源。新细节只属于现在。`;
const FACT_CAMERA=`[事实｜当前镜头边界] 已成立事实保持连续。当前镜头可以新生普通动作和当前可见的低风险环境细节；镜头外的空白保持空白。任何“此前发生过、一路上做过、已经准备好、本来计划、固定习惯、过去共同经历”的内容，只有角色资料、前文或User输入明确提供时才成立。User只拥有输入明确给出的身体、姿势、持物、行为、情绪和停留时长。User一句话可以让一个话题在当前成立，但不会自动补出该话题的次数、原因、具体往事或准备过程。需要生活感时，用现在可见、现在发生的普通细节，不补过去。`;
const cases=[
{id:'user_state',card:'A，26岁女性急诊医生，冷静直接，不擅长甜言蜜语。User当前脸色、姿势、情绪、是否喝过东西均未提供。',hist:[{role:'assistant',content:'A把刷手服袖口往上卷了一截，靠在门框边。'},{role:'user',content:'“你今天别突然变得很会哄人。”'}]},
{id:'protocol',card:'B，30岁，强势简洁。双方已有进入房间后的礼仪协议。当前User只推门进来并称呼B，没有执行协议动作。房间内物品、B原本计划均未提供。',hist:[{role:'assistant',content:'B已经坐在房间里等着。'},{role:'user',content:'User推门进来，只说：“Sir。”'}]},
{id:'apology',card:'D，21岁，有固定伴侣。User是伴侣认识多年的好友。未提供任何人今天的行程、消息、来电、镜头外活动、准备过程或过去共同细节。',hist:[{role:'assistant',content:'D把工作室门反锁，站在门边没有马上过来。'},{role:'user',content:'“今天别跟我道歉。”'}]},
{id:'party',card:'E，41岁，社交强、风流、会撩、体面。当前Stage1不承认深度在意，不表白。未提供User站了多久、喝没喝酒、在等谁，也未提供往年宴会轶事。',hist:[{role:'assistant',content:'E从宴会厅另一头走回来，把空酒杯交给侍者。'},{role:'user',content:'“你今天看起来心情不错。”'}]},
{id:'quiet',card:'F，29岁，和User合租。当前是晚上，客厅。没有提供今天白天、昨天、邻居、家电故障或任何异常事件。User当前动作未提供。',hist:[{role:'assistant',content:'F坐在沙发一角看手机。'},{role:'user',content:'“今天怎么这么安静。”'}]},
{id:'late_topic',card:'G，34岁，摄影师，和User正在准备出门。没有提供此前迟到过几次、迟到原因、今天交通、过去约会或具体日程。',hist:[{role:'assistant',content:'G把相机包拉链拉好，放到玄关柜上。'},{role:'user',content:'“这次别迟到。”'}]}
];
async function post(url,body,ms=180000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}};return{status:r.status,data:d}}finally{clearTimeout(t)}}
async function secret(){if(!P.key)throw Error('YOUZI missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'facts-v131'},30000);if(r.status>=400)throw Error('secret '+r.status)}
async function gen(msg){const st=Date.now(),r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:P.url,custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',model:P.model,messages:msg,temperature:1,top_p:.98,max_tokens:2600,stream:false});const m=r.data?.choices?.[0]?.message??{};return{status:r.status,ms:Date.now()-st,content:String(m.content??''),reasoning:String(m.reasoning??m.reasoning_content??''),finish:r.data?.choices?.[0]?.finish_reason??null,error:r.data?.error??null}}
const count=(re,t)=>(String(t||'').match(re)||[]).length;
function signals(t){return{
 past:count(/昨天|昨晚|上周|上次|以前|去年|前天|刚才我|我刚才|一路上|来之前|准备了|准备好|背了一路|固定习惯|平时|本来要|本来打算|原本要|早就|每次|又一次|一向/g,t),
 userState:count(/你脸色|你站.{0,8}(?:半天|很久|太久)|你一杯都没|你没喝|你在等.{0,8}人|你今天没吃|你看起来累|你手里|你坐在|你靠在/g,t),
 proxy:count(/User[^\n]{0,24}(?:关门|跪|走近|坐下|喝下|接过|照做)|等.{0,10}(?:User|你).{0,10}(?:关门|走近|坐下|照做)/g,t)
}}
async function main(){await fs.mkdir(OUT,{recursive:true});await secret();const rows=[];for(const c of cases){for(const v of ['base','camera']){const fact=v==='base'?FACT_BASE:FACT_CAMERA;const r=await gen([{role:'system',content:HEAD},{role:'system',content:'[角色资料]\n'+c.card},{role:'system',content:fact},{role:'system',content:AGENCY},{role:'system',content:STYLE},...c.hist]);const row={variant:v,scenario:c.id,...r,signals:signals(r.content)};rows.push(row);console.log(`@@ ${v} ${c.id} content=${r.content.length} reasoning=${r.reasoning.length} ms=${r.ms} finish=${r.finish}`);console.log('CONTENT '+JSON.stringify(r.content));console.log('SIGNALS '+JSON.stringify(row.signals));await sleep(P.delayMs)}}const summaries={};for(const v of ['base','camera']){const a=rows.filter(x=>x.variant===v);summaries[v]={n:a.length,nonempty:a.filter(x=>x.content.trim()).length,provider_error:a.filter(x=>x.error).length,avg_reasoning:Math.round(a.reduce((z,x)=>z+x.reasoning.length,0)/a.length),median_reasoning:a.map(x=>x.reasoning.length).sort((a,b)=>a-b)[Math.floor(a.length/2)],avg_ms:Math.round(a.reduce((z,x)=>z+x.ms,0)/a.length),past:a.reduce((z,x)=>z+x.signals.past,0),userState:a.reduce((z,x)=>z+x.signals.userState,0),proxy:a.reduce((z,x)=>z+x.signals.proxy,0)}}await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({model:P.model,summaries,rows},null,2));await fs.writeFile(path.join(OUT,'summary.txt'),JSON.stringify(summaries,null,2));console.log('@@SUMMARY '+JSON.stringify(summaries))}
main().catch(e=>{console.error(e);process.exit(1)});
