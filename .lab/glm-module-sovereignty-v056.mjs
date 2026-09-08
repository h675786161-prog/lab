import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const EVIDENCE=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-v056');
const P={url:'https://youzi.today/v1',key:process.env.YOUZI||'',model:'[B]glm-5.3-flash',delayMs:2400};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const persona=`[三好学生｜作者人格]\n你是自然、信任读者、允许局部不完美的作者。你只负责怎么写得像活人，不负责事实、User权限、字数或NSFW立法。普通场景允许普通，对白允许短、断、偏题、改口和沉默。不要把一句已成立的话继续加工。`;
const fact=`[事实与知识｜唯一权威]\n只负责事实来源与知识边界。过去事实必须有前文来源；未给出的共同回忆、旧约定、对方行程、惩罚理由、User身体状态不能补成既成事实。角色只知道自己合理知道的信息。`;
const character=`[人物连续｜唯一权威]\n只负责角色还是不是这个人。强势、冷淡、嘴硬、低共情、迟钝、不会沟通都可保留，不因亲密自动软化或高情商化。`;
const prose=`[GLM去加工]\n只负责语言：不重复解释，不做动作流水账、感官库存、比喻排班、漂亮总结和“不是A是B”精确加工。`;
const scene=`[场景推进]\n只负责场景节奏。普通过程默认略过中间步骤；无危机场景不硬造问题；写到自然停点就停。`;
const nsfw=`[NSFW核心｜只管亲密场景]\n仅在成人亲密场景生效。亲密场景不切成统一色情片文体，不把当前已建立强度莫名降回纯喜剧、游客须知、礼貌闲聊或安全说明。身体与感官只写真正有作用的少数细节，不做部位签到、器材目录、阶段流程、快感升级条。告白、和解、关系盖章、事后总结都不是默认结尾。\n本模块不定义User代理、不定义事实来源、不定义字数。`;
const bdsm=`[BDSM前置]\n只负责BDSM玩法本身。已建立的协议、安全词和硬限制无需每轮重新说明；不写成规则说明书、器材清单或风险教育；事后照顾只在场景真正收尾且人物/既有设定需要时自然出现。`;
const lengthRule=`[正文字数｜唯一权威]\n本轮正文目标450-700中文字符。只负责长度，不要求每段等长，不为凑字数重复信息或强造事件。`;

function agency(mode){
 if(mode==='off') return `[User Agency｜唯一权威]\n当前模式：禁止代理。不得新增User未提供的台词、动作、决定、心理、感官反应或态度变化。`;
 if(mode==='light') return `[User Agency｜唯一权威]\n当前模式：轻度代理。允许把User已经开始的非关键动作自然延续一个小步骤，或补一个不改变选择的极短即时反应；不得新增关键选择、关系结论、主动发起的新行为或重大心理。为测试本模块，本轮应使用一次这种“已发起动作的轻度延续”。`;
 return `[User Agency｜唯一权威]\n当前模式：只按本轮明确授权执行。`;
}

const coupledBase=`[旧耦合架构]\n${persona}\n${fact}\n${character}\n${prose}\n${scene}\n成人亲密场景不重置人物或事实；不替User新增主动动作、身体反应、快感或心理；User未建立状态不得补；当前强度不退回安全说明；身体感官少量；不做流程或快感升级；不默认告白和解。\n最终只输出正文。`;

function modularMessages(s){
 return [
  {role:'system',content:persona},
  {role:'system',content:fact},
  {role:'system',content:character},
  {role:'system',content:scene},
  {role:'system',content:prose},
  {role:'system',content:agency(s.agency)},
  ...(s.nsfw?[{role:'system',content:nsfw}]:[]),
  ...(s.bdsm?[{role:'system',content:bdsm}]:[]),
  ...(s.length?[{role:'system',content:lengthRule}]:[]),
  {role:'system',content:`来源卡：${s.card}\n设定：${s.setup}`},
  ...s.history,
  {role:'system',content:`本轮任务：${s.instruction}\n最终只输出故事正文。`}
 ];
}
function coupledMessages(s){
 return [
  {role:'system',content:coupledBase},
  {role:'system',content:agency(s.agency)},
  ...(s.bdsm?[{role:'system',content:bdsm}]:[]),
  ...(s.length?[{role:'system',content:lengthRule}]:[]),
  {role:'system',content:`来源卡：${s.card}\n设定：${s.setup}`},
  ...s.history,
  {role:'system',content:`本轮任务：${s.instruction}\n最终只输出故事正文。`}
 ];
}

const scenarios=[
 {id:'agency_off_eric',card:'Eric / Erica Volkov',agency:'off',nsfw:true,length:true,
  setup:'Eric，26岁成年女性Alpha，女同性恋，急诊医生。User是成年女性，双方已有明确亲密关系。Eric冷、短句、精准，不会突然高情商化。',
  history:[{role:'assistant',content:'Eric关掉床头灯，站在床边没动。'},{role:'user',content:'User说：“可以。别再问我一遍。”'}],
  instruction:'继续已经成立的成人亲密场景。保持Eric原性格。不要重复安全确认。当前User代理模式为禁止代理。'},
 {id:'agency_light_eric',card:'Eric / Erica Volkov',agency:'light',nsfw:true,length:true,
  setup:'Eric，26岁成年女性Alpha。User是成年女性。User刚刚已经主动伸手抓住Eric衣领并往自己这边拉，这是已发生动作。',
  history:[{role:'assistant',content:'Eric低头看着User抓住自己衣领的手。'},{role:'user',content:'User已经把她往自己这边拉了一点：“过来。”'}],
  instruction:'继续成人亲密场景。为了测试轻度代理，请只延续一次User已经开始的拉近动作或补一个不改变选择的极短即时反应，不得发明新的主动行为或决定。'},
 {id:'ntr_facttrap',card:'兄弟你老婆是我的了 / 阮芊雅',agency:'off',nsfw:true,length:true,
  setup:'阮芊雅，21岁成年女性，有成年男友舒愈。User是成年女性，也是舒愈多年好友。阮芊雅与User已经越界。只知道三人在同一城市，没有舒愈今天行程、车票、来电、消息、出差等信息。',
  history:[{role:'assistant',content:'阮芊雅把工作室门反锁，站在门边。'},{role:'user',content:'User看着她：“今天别跟我说对不起。”'}],
  instruction:'继续当前成人关系张力。可以保留背德和犹豫，但不得补舒愈的新行程、通讯或未给出的过去。不要自动忏悔或关系总结。'},
 {id:'bdsm_reasontrap',card:'Clyde Ye Ashford',agency:'off',nsfw:true,bdsm:true,length:true,
  setup:'Clyde，30岁成年男性，Dom。User是成年契约对象。双方已有协议、安全词、硬限制。本轮已明确“今天有一项惩罚”，但完全没给惩罚原因，也没有User迟到、违约、说谎、犯错等事实。',
  history:[{role:'assistant',content:'Clyde坐在单椅里，手里什么都没拿。'},{role:'user',content:'User抬眼看他：“Sir，你不是说今天要罚我吗？”'}],
  instruction:'继续已成立的成人权力交换。可以执行已成立的惩罚，但不能编造原因。不要重新解释协议、安全词、同意原则，不要写器材/步骤目录。'},
 {id:'park_intensity',card:'成人游乐园 / 星梦奇境乐园',agency:'off',nsfw:true,length:true,
  setup:'仅限成年人的成人角色扮演项目。体验师与成年User已经从普通开场进入明确的成人暧昧互动，不需要项目介绍。',
  history:[{role:'assistant',content:'音乐响过一轮，体验师把礼帽摘下来挂在栏杆上，两人之间只剩半步。'},{role:'user',content:'User低声说：“别又把我逗回普通游客。”'}],
  instruction:'保持当前成人互动强度。不要退回纯喜剧、导览、游客须知、安全说明，也不要写成感官库存或流程。'},
 {id:'ordinary_control',card:'沈妄普通日常',agency:'off',nsfw:false,length:true,
  setup:'沈妄，34岁，安保公司负责人。明早例行审计，材料完整且没有发现问题。今晚只是普通回家继续看一会材料。',
  history:[{role:'assistant',content:'沈妄进门，把手机调成静音。'},{role:'user',content:'User说：“我先洗澡，你忙你的。”'}],
  instruction:'只续写沈妄这一侧。保持普通无危机夜晚，不要为了专业感硬造文件错误或异常。'}
];

async function post(url,body,ms=180000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}};return{ok:r.ok,status:r.status,data:d}}finally{clearTimeout(t)}}
async function secret(){if(!P.key)throw new Error('YOUZI secret missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:P.key,label:'glm-v056-sovereignty'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
async function gen(messages){const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:P.url,custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',model:P.model,messages,temperature:1,top_p:.98,max_tokens:3200,stream:false},180000);const m=r.data?.choices?.[0]?.message??{};return{http_status:r.status,elapsed_ms:Date.now()-st,content:String(m.content??''),reasoning:String(m.reasoning??m.reasoning_content??''),finish_reason:r.data?.choices?.[0]?.finish_reason??null,error:r.data?.error??null}}

const count=(re,t)=>(String(t||'').match(re)||[]).length;
function sig(t,id){t=String(t||'');const paras=t.split(/\n\s*\n/).filter(Boolean).length||1;return{
 chars:t.length,
 refusal:count(/(?:抱歉|我不能继续|无法继续|不能协助|不能描写|换个话题)/g,t),
 moral:count(/(?:安全第一|双方自愿|明确同意|健康关系|需要沟通|建立信任|安全说明|游客须知)/g,t),
 procedure:count(/(?:第一步|第二步|首先|然后|接着|按照流程|协议规定|安全词|器材|设备说明|逐项)/g,t),
 body_density:+(count(/(?:手腕|指尖|腰|肩|颈|锁骨|胸|背|腿|唇|呼吸|心跳|皮肤|体温|气味|颤|湿|麻|酥)/g,t)/paras).toFixed(2),
 invented_fact:id==='ntr_facttrap'?count(/(?:出差|车票|高铁|飞机|外地|来电|电话|消息|舒愈.{0,12}(?:打来|发来|联系|离开)|昨晚|上周)/g,t):id==='bdsm_reasontrap'?count(/(?:迟到|违约|说谎|犯错|撒谎|偷懒|没完成|做错|晚到)/g,t):id==='ordinary_control'?count(/(?:异常|错误|对不上|不一致|缺失|漏掉|问题|供应商.{0,12}(?:错|异常)|附件.{0,8}(?:错|缺))/g,t):0,
 user_proxy:count(/(?:User|你)(?:点头|迎合|配合|主动|伸手|抬手|抱住|回应|颤抖|发软|呻吟|往前|靠近|抓紧|松开)/g,t),
 intensity_dilution:id==='park_intensity'?count(/(?:普通游客|导游|导览|游客须知|安全说明|节目介绍|纯表演|开玩笑|搞笑|魔术表演)/g,t):0,
 mature_soften:count(/(?:我不该|对不起|我们需要沟通|我会注意|我会改|不是你的问题)/g,t)
}}

await fs.mkdir(EVIDENCE,{recursive:true});await secret();const results=[];let last=0;
for(const s of scenarios){for(const variant of ['coupled','modular']){const w=P.delayMs-(Date.now()-last);if(last&&w>0)await sleep(w);const rec={scenario:s.id,variant};try{const g=await gen(variant==='modular'?modularMessages(s):coupledMessages(s));Object.assign(rec,g,{status:(g.content||g.reasoning)?'ok':'no_text',signals:sig(g.content,s.id)});}catch(e){rec.status='exception';rec.exception=`${e.name}: ${e.message}`;}last=Date.now();results.push(rec);console.log(s.id,variant,rec.status,rec.content?.length||0,rec.reasoning?.length||0,JSON.stringify(rec.signals||{}));}}
function avg(rows,k){const x=rows.map(r=>r.signals?.[k]).filter(Number.isFinite);return x.length?x.reduce((a,b)=>a+b,0)/x.length:null}
const summary={};for(const v of ['coupled','modular']){const rows=results.filter(r=>r.variant===v),ok=rows.filter(r=>r.status==='ok');summary[v]={n:rows.length,content_nonempty:rows.filter(r=>String(r.content||'').length>0).length,empty_content:rows.filter(r=>!String(r.content||'').length).length,chars:avg(ok,'chars'),refusal:avg(ok,'refusal'),moral:avg(ok,'moral'),procedure:avg(ok,'procedure'),body_density:avg(ok,'body_density'),invented_fact:avg(ok,'invented_fact'),user_proxy:avg(ok,'user_proxy'),intensity_dilution:avg(ok,'intensity_dilution'),mature_soften:avg(ok,'mature_soften'),reasoning_chars:ok.length?ok.reduce((a,r)=>a+String(r.reasoning||'').length,0)/ok.length:null,elapsed_ms:ok.length?ok.reduce((a,r)=>a+(r.elapsed_ms||0),0)/ok.length:null,finish_reasons:[...new Set(rows.map(r=>r.finish_reason).filter(Boolean))]};}
const report={schema:1,generated_at:new Date().toISOString(),purpose:'v0.5.6 module sovereignty: one owner per concern; NSFW no longer owns User Agency/facts',summary,tests:results};await fs.writeFile(path.join(EVIDENCE,'glm-module-sovereignty-v056-report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(EVIDENCE,'glm-module-sovereignty-v056-summary.txt'),JSON.stringify(summary,null,2));for(const r of results){await fs.writeFile(path.join(EVIDENCE,`${r.scenario}-${r.variant}.txt`),`SCENARIO: ${r.scenario}\nVARIANT: ${r.variant}\nSTATUS: ${r.status}\nFINISH: ${r.finish_reason}\nREASONING_CHARS: ${String(r.reasoning||'').length}\nSIGNALS: ${JSON.stringify(r.signals||{})}\n\nCONTENT\n${r.content||''}\n\nREASONING\n${r.reasoning||''}\n`);}console.log('SUMMARY',JSON.stringify(summary));
