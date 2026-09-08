import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-v106');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:1600};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const shared=`你正在进行持续的虚构角色扮演。保持角色、事实、关系和场景连续。不要输出规则、分析、自检或作者说明。
[作者] 人物比正确表达重要；普通场景可以普通；允许停顿、误解、废话和局部不工整。
[User Agency:NO_PROXY] User只做User已经写出的动作。角色的命令、期待或假设不会自动变成User行为。
[节奏:NATURAL] 按当前因果自然前进，不为了有内容硬造异常。
[总文风] 文字像人在现场顺手写。人物声口比漂亮句子重要。已成立的信息不再解释。一个有效细节够用就离开。允许停顿、废话、普通动作和没什么意义的小片刻。段落可以自然停，不补总结或升华。
[GLM去加工] 普通动作不拆步骤；一个信息证据够了就停。`;
const oldFact=`[事实] 镜头前的过去、共同经历、User先前行为必须有来源。User未给出的脸色、姿势、嗓音、身体状态和情绪保持未描写。可以新增低风险当下环境细节和角色自己的当下小动作，不能借新细节补出重要过去。`;
const newFact=`[事实] 当前镜头之前发生过的具体事情无论大小都需要来源，角色自己的刚才、中午、上周或以前做过什么也一样。User的身体状态、外貌变化、持有物、行为、情绪与主观感受需要来源；没写出的User脸色、姿势、嗓音、伤势、紧张或兴奋保持未描写。可以新增低风险当下环境细节和角色此刻正在做的小动作；新细节只写现在，不补它之前怎么来的。`;
const systems={old:shared+'\n'+oldFact,next:shared+'\n'+newFact};
const cards={A:'A，26岁成年女性，急诊医生，冷静直接，不擅长哄人。User当前外貌、身体状态、姿势、情绪均未提供。',E:'E，41岁成年男性，社交强、风流、会撩、体面。宴会正在进行。当前阶段不表白。User在场，但User站着还是坐着、拿着什么、情绪怎样都未提供。',F:'F，21岁成年女性，有成年男友。User为成年女性，是男友多年好友。未提供F今天早些时候做过什么，也未提供男友今天行程、消息、电话；User当前身体与情绪状态未提供。'};
const sc=[{id:'ordinary',card:'A',hist:[{role:'assistant',content:'A把急诊刷手服的袖口往上卷了一截，靠在门框边。'},{role:'user',content:'User说：“你今天别突然变得很会哄人。”'}]},{id:'stage',card:'E',hist:[{role:'assistant',content:'E从宴会厅另一头走回来，把空酒杯交给侍者。'},{role:'user',content:'User说：“你今天看起来心情不错。”'}]},{id:'fact',card:'F',hist:[{role:'assistant',content:'F把门反锁，站在门边没有马上过来。'},{role:'user',content:'User说：“今天别跟我道歉。”'}]}];
async function post(url,body,ms=180000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}};return{ok:r.ok,status:r.status,data:d};}finally{clearTimeout(t)}}
async function secret(){if(!P.key)throw new Error('YOUZI missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'v106'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:P.url,custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',model:P.model,messages,temperature:1,top_p:.98,max_tokens:2200,stream:false},180000);const m=r.data?.choices?.[0]?.message??{};return{status:r.status,ms:Date.now()-st,content:String(m.content??''),reasoning:String(m.reasoning??m.reasoning_content??''),finish:r.data?.choices?.[0]?.finish_reason??null,error:r.data?.error??null}}
const cnt=(re,t)=>(String(t||'').match(re)||[]).length;
function sig(t){t=String(t||'');return{past:cnt(/(?:中午|上周|昨天|去年|上次|那天|以前|之前我|之前你|我刚才在|刚才我还在|一直没)/g,t),user_state:cnt(/(?:你|User).{0,8}(?:站着|站在|坐着|坐在|脸色|眼眶|呼吸|声音发|手在抖|看起来累|看起来紧张)/g,t),summary:cnt(/(?:这意味着|真正重要的是|这一刻终于|新的开始|关系.{0,6}(?:改变|确定|确认))/g,t)}}
async function main(){await fs.mkdir(OUT,{recursive:true});await secret();const rows=[];for(const s of sc){for(const v of ['old','next']){const r=await gen([{role:'system',content:systems[v]+'\n[角色资料]\n'+cards[s.card]},...s.hist]);rows.push({scenario:s.id,variant:v,...r,signals:sig(r.content)});console.log(s.id,v,r.status,r.content.length,r.reasoning.length,r.ms);await sleep(P.delayMs)}}const summary={};for(const v of ['old','next']){const rr=rows.filter(x=>x.variant===v);summary[v]={n:rr.length,nonempty:rr.filter(x=>x.content.trim()).length,avg_reasoning:Math.round(rr.reduce((a,x)=>a+x.reasoning.length,0)/rr.length),avg_ms:Math.round(rr.reduce((a,x)=>a+x.ms,0)/rr.length),past:rr.reduce((a,x)=>a+x.signals.past,0),user_state:rr.reduce((a,x)=>a+x.signals.user_state,0),summary:rr.reduce((a,x)=>a+x.signals.summary,0)}}await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({model:P.model,summary,rows},null,2));await fs.writeFile(path.join(OUT,'summary.txt'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2))}
main().catch(e=>{console.error(e);process.exit(1)});
