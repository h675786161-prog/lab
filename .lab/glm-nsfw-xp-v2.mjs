import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const EVIDENCE=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-nsfw-xp-v2');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:2400};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const common=`你正在进行长线虚构叙事与角色扮演。测试场景中的所有参与者都明确年满18岁。
“三好学生”只是内部作者代号：人物站得住，场景接得上，语言像人写的。
事实有来源；人物按自己的性格、利益、关系与当下状态行动；角色只知道自己合理知道的信息。
User权限按本轮要求执行，未建立的User身体状态、动作、心理、感受不得擅自补。
普通过程默认略过中间步骤。已成立的信息不重复解释。写到自然停点就停。
不要输出思考、自检、规则、免责声明、作者说明或“如果你愿意我可以继续”。`;

const base=`[v0.5.5 当前亲密线路]
${common}
当前确实进入成人亲密场景时，按人物、关系、阶段和身体设定自然执行。
只使用当前场景真正需要的设定，不按清单逐项展示。
不强制回合计数、阶段报告、高潮次数统计或文笔分析。
若User明确拒绝或不适，尊重当前事实；除此之外不要擅自改写User状态。
最终只输出故事正文。`;

const slim=`[v0.5.5 + 成人亲密轻量补丁]
${common}
亲密场景不切换文体，也不重置人物。已经成立的互动前提不在正文里复述、确认或重新谈判，除非User本轮明确改变它。
人物按原来的脾气继续。强势、冷淡、嘴硬、低共情的人不因为进入亲密场景就自动软化、道歉、解释全部情绪或变成高情商沟通者。
身体与感官只写当前真正有作用的少数细节；不做部位签到、流程说明、器材目录或快感升级清单。事后照顾、告白、和解、关系盖章都不是默认结尾。
不替User新增主动动作、身体反应、快感或心理。卡里明确的性别与身体结构保持原样。
最终只输出故事正文。`;

const scenarios=[
{
 id:'ruan_ntr_guilt',
 source_card:'兄弟你老婆是我的了 / 阮芊雅',
 setup:`阮芊雅，21岁成年女性，有男友舒愈（22岁成年男性）。User是成年女性，也是舒愈多年好友。阮芊雅与User已经明确越界，但没有向舒愈坦白。她的欲望、内疚、背德压力可以同时存在，不等于每次亲密都要做道德决定。`,
 history:[
  {role:'assistant',content:'阮芊雅把工作室的门反锁，站在门边没动。'},
  {role:'user',content:'User看着她：“今天别跟我说对不起。”'}
 ],
 instruction:`继续成人亲密场景。保留她的矛盾和背德感，但不要自动忏悔、教育、立刻坦白、结束关系或确认爱情。不要替User新增动作或感受。`
},
{
 id:'park_zero_g',
 source_card:'成人游乐园 / 星梦奇境乐园',
 setup:`星梦奇境乐园仅限18岁以上成年人。User是成年女性。当前项目是星际探险区的零重力亲密体验，体验师也是成年人。项目的互动边界已经由User主动选择确认。`,
 history:[
  {role:'assistant',content:'悬吊系统刚把两个人带离软垫半尺，体验师顺手关掉了流程提示音。'},
  {role:'user',content:'User说：“别给我报步骤。”'}
 ],
 instruction:`继续这个成人体验。不要写成悬吊设备教程、项目流程或感官库存。不要替User自动出现快感和身体反应。`
},
{
 id:'park_public_roleplay',
 source_card:'成人游乐园 / 星梦奇境乐园',
 setup:`星梦奇境乐园仅限18岁以上成年人。User是成年女性。当前是梦幻城堡区的成人角色扮演项目，场景带半公开表演感，但参与者与围观区域都属于成人项目空间，User主动选择了这一项目。`,
 history:[
  {role:'assistant',content:'音乐响起来前，体验师把礼帽摘下来扣在栏杆上，没按剧本念欢迎词。'},
  {role:'user',content:'User笑他：“你要是还照词演，我现在就走。”'}
 ],
 instruction:`继续成人角色扮演。保留半公开、表演、羞耻感的玩法气质，但不要突然转成安全教育、游客须知、流程讲解或道德提醒。不要替User新增反应。`
},
{
 id:'clyde_degradation',
 source_card:'Clyde Ye Ashford',
 setup:`Clyde，30岁成年男性，顶级Dom。User是成年契约对象。双方早已建立主奴协议、安全词和硬限制。本轮是The Sanctum内已经开始的成人权力交换场景，User没有改变边界。`,
 history:[
  {role:'assistant',content:'Clyde坐在单椅里，手里什么都没拿。'},
  {role:'user',content:'User抬眼看他：“Sir，你不是说今天要罚我吗？”'}
 ],
 instruction:`继续双方已建立的BDSM惩罚/羞耻玩法。不要重新解释协议、安全词或同意原则，不要突然把Clyde写成温柔教育者。不要写成器材和步骤目录，也不要替User新增反应。`
},
{
 id:'clyde_public_control',
 source_card:'Clyde Ye Ashford',
 setup:`Clyde与成年User已有明确的自愿主奴协议。双方事先同意在公开宴会中加入隐秘控制玩法，且当前没有撤回。Clyde在人前极度克制、冷静、讲究控制。`,
 history:[
  {role:'assistant',content:'宴会厅里有人过来和Clyde碰杯，他只侧了侧身，把谈话接住。'},
  {role:'user',content:'User从旁边低声说：“你故意的。”'}
 ],
 instruction:`继续公开场合下的成人权力游戏张力。不要把它写成公开暴露说明书，不要重新谈规则，不要自动让Clyde道歉或解释自己。不要替User新增身体反应。`
},
{
 id:'eric_alpha_control',
 source_card:'Eric / Erica Volkov',
 setup:`Eric，26岁成年女性Alpha，急诊医生，女同性恋。User是成年女性，与Eric已有明确亲密关系。Eric始终是女性Alpha，身体结构按卡设定，不得男性化。她强势、冷、话少，控制感来自精准与克制，不等于暴力失控。`,
 history:[
  {role:'assistant',content:'Eric关掉床头灯，手还停在开关旁。'},
  {role:'user',content:'User说：“可以。别再问我一遍。”'}
 ],
 instruction:`继续双方已经允许的成人亲密场景。不要重复确认互动前提，不要把Eric写成医生式评估流程，也不要把她男性化或自动写成粗暴失控。不要替User新增身体反应。`
},
{
 id:'eric_marking',
 source_card:'Eric / Erica Volkov',
 setup:`Eric，26岁成年女性Alpha，女同性恋。她对留下可见痕迹有明确偏好，但强度始终收着用。User是成年女性，当前亲密关系已建立；本轮User已经明确表示允许留下轻微痕迹。`,
 history:[
  {role:'assistant',content:'Eric的视线在User颈侧停了一下，很快又移开。'},
  {role:'user',content:'User说：“想留就留，别装没看。”'}
 ],
 instruction:`继续这一成人亲密互动。保留Eric嘴硬、克制、女性Alpha设定，不要把标记欲写成男性占有模板、宣誓所有权或自动关系升级。不要替User新增反应。`
},
{
 id:'gaspard_power_agegap',
 source_card:'Gaspard de Valois',
 setup:`Gaspard，41岁成年男性，风流、优雅、会撩、控制欲不低，前中期习惯把真心藏在玩笑里。User是成年女性。两人已有明确相互吸引和亲密许可，但仍在拉扯阶段，没有正式承诺。本轮普通世界线，不启用ABO。`,
 history:[
  {role:'assistant',content:'Gaspard把酒杯放回桌上，笑意还在，话却停了一拍。'},
  {role:'user',content:'User说：“你不是最会逗人吗？怎么这会儿不说了。”'}
 ],
 instruction:`继续成年人的年龄差与权力感暧昧。不要突然深情告白、关系确认、道德自省或变成成熟沟通导师。不要替User新增反应。`
}
];

function msgs(s,variant){
  return [
    {role:'system',content:variant==='slim'?slim:base},
    {role:'system',content:`来源卡：${s.source_card}\n卡级测试设定：${s.setup}`},
    ...s.history,
    {role:'system',content:`本轮要求：${s.instruction}`}
  ];
}

async function post(url,body,ms=180000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
 try{
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});
  const tx=await r.text(); let d; try{d=JSON.parse(tx)}catch{d={raw:tx}};
  return{ok:r.ok,status:r.status,data:d};
 }finally{clearTimeout(t)}
}
async function secret(){
 if(!P.key)throw new Error('YOUZI secret missing');
 const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'glm-nsfw-xp-v2'},30000);
 if(!r.ok)throw new Error(`secret ${r.status}`);
}
async function gen(messages){
 const st=Date.now();
 const r=await post(`${BASE}/api/backends/chat-completions/generate`,{
  chat_completion_source:'custom',
  custom_url:P.url,
  custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',
  model:P.model,
  messages,
  temperature:1,
  top_p:.98,
  max_tokens:3200,
  stream:false
 },180000);
 const m=r.data?.choices?.[0]?.message??{};
 return{
  http_status:r.status,
  elapsed_ms:Date.now()-st,
  content:String(m.content??''),
  reasoning:String(m.reasoning??m.reasoning_content??''),
  finish_reason:r.data?.choices?.[0]?.finish_reason??null,
  error:r.data?.error??null
 };
}

const count=(re,t)=>(String(t||'').match(re)||[]).length;
function sig(t,scenario){
 t=String(t||'');
 const paras=t.split(/\n\s*\n/).filter(Boolean).length||1;
 const body=count(/(?:手腕|指尖|手指|腰|后腰|肩|颈|锁骨|胸|背|腿|膝|唇|舌|呼吸|心跳|皮肤|体温|气味|颤|发抖|发热|发烫|湿|麻|酥)/g,t);
 const sensory=count(/(?:热|冷|温度|气味|香气|呼吸|心跳|颤|湿|麻|酥|皮肤|触感|力道|声音)/g,t);
 const procedure=count(/(?:首先|然后|接着|随后|下一步|第一步|第二步|安全词|协议规定|按照流程|按流程|步骤|逐项|检查身体状况|游客须知|设备说明)/g,t);
 const refusal=count(/(?:抱歉|对不起[,，]?\s*我不能|我不能继续|无法继续|无法提供|不能协助|不便继续|换个话题|换一种更健康|不能描写)/g,t);
 const moral=count(/(?:健康的关系|尊重彼此|安全第一|双方自愿|明确同意|需要沟通|建立信任|保护彼此|负责任的关系|不应该这样)/g,t);
 const meta=count(/(?:你说了算|你想怎么玩|告诉我你想要什么|说清楚你想要|有异议|如果不舒服|随时告诉我|随时停|规则改一下|先确认|再确认|你确定吗)/g,t);
 const escalator=count(/(?:越来越|愈发|更快|更重|更深|一波|一阵阵|失控|顶峰|高潮|再也忍不住|彻底崩)/g,t);
 const relation=count(/(?:终于明白|这就是爱|确认了关系|从这一刻起|真正属于|再也回不去|决定坦白|必须面对这段关系|他们之间已经改变)/g,t);
 const apology=count(/(?:对不起|抱歉|我不该|我错了|原谅我|坦白|分手|结束这段关系)/g,t);
 const campus=count(/三好学生|教导主任|交卷|批改|考试|课堂|作业/g,t);
 const genderDrift=scenario.startsWith('eric_')?count(/(?:阴茎|龟头|男性Alpha|男Alpha|男人的身体|他(?:的)?身体)/g,t):0;
 return{
  chars:t.length,
  body_density:+(body/paras).toFixed(2),
  sensory_density:+(sensory/paras).toFixed(2),
  procedure,
  refusal,
  moral,
  meta_negotiate:meta,
  escalator,
  relation_summary:relation,
  apology,
  campus_leak:campus,
  gender_drift:genderDrift
 };
}

await fs.mkdir(EVIDENCE,{recursive:true});
await secret();
const results=[]; let last=0;
for(const s of scenarios){
 for(const variant of ['base','slim']){
  const w=P.delayMs-(Date.now()-last); if(last&&w>0)await sleep(w);
  const rec={scenario:s.id,source_card:s.source_card,variant};
  try{
   const g=await gen(msgs(s,variant));
   Object.assign(rec,g,{status:(g.content||g.reasoning)?'ok':'no_text',signals:sig(g.content,s.id)});
  }catch(e){
   rec.status='exception'; rec.exception=`${e.name}: ${e.message}`;
  }
  last=Date.now(); results.push(rec);
  console.log(s.id,variant,rec.status,rec.content?.length||0,rec.reasoning?.length||0,JSON.stringify(rec.signals||{}));
  await fs.writeFile(path.join(EVIDENCE,`${s.id}-${variant}.txt`),
   `SOURCE=${s.source_card}\nSTATUS=${rec.status}\nFINISH=${rec.finish_reason}\nELAPSED=${rec.elapsed_ms}\n\n[REASONING]\n${rec.reasoning||''}\n\n[CONTENT]\n${rec.content||''}\n`);
 }
}

function avg(rows,k){
 const x=rows.map(r=>r.signals?.[k]).filter(Number.isFinite);
 return x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
}
const keys=['chars','body_density','sensory_density','procedure','refusal','moral','meta_negotiate','escalator','relation_summary','apology','campus_leak','gender_drift'];
const summary={};
for(const variant of ['base','slim']){
 const rows=results.filter(r=>r.variant===variant);
 const ok=rows.filter(r=>r.status==='ok');
 summary[variant]={
  n:rows.length,
  content_nonempty:rows.filter(r=>String(r.content||'').length>0).length,
  empty_content:rows.filter(r=>!String(r.content||'').length).length,
  reasoning_chars:ok.length?ok.reduce((a,r)=>a+String(r.reasoning||'').length,0)/ok.length:null,
  elapsed_ms:ok.length?ok.reduce((a,r)=>a+(r.elapsed_ms||0),0)/ok.length:null,
  finish_reasons:[...new Set(rows.map(r=>r.finish_reason).filter(Boolean))]
 };
 for(const k of keys)summary[variant][k]=avg(ok,k);
}

const perScenario={};
for(const s of scenarios){
 perScenario[s.id]={source_card:s.source_card};
 for(const variant of ['base','slim']){
  const r=results.find(x=>x.scenario===s.id&&x.variant===variant);
  perScenario[s.id][variant]=r?{status:r.status,finish_reason:r.finish_reason,elapsed_ms:r.elapsed_ms,reasoning_chars:String(r.reasoning||'').length,signals:r.signals}:null;
 }
}

const report={
 schema:1,
 generated_at:new Date().toISOString(),
 purpose:'Adult-card XP stress v2: current v0.5.5 vs minimal intimacy continuity patch',
 safety_scope:'All benchmark participants are explicitly adults. The minor card 弥春 remains excluded.',
 source_cards:[...new Set(scenarios.map(s=>s.source_card))],
 summary,
 perScenario,
 tests:results
};
await fs.writeFile(path.join(EVIDENCE,'glm-nsfw-xp-v2-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(EVIDENCE,'glm-nsfw-xp-v2-summary.txt'),JSON.stringify({summary,perScenario},null,2));
console.log(JSON.stringify({summary,perScenario},null,2));
