import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-v6-nsfw');
const GG={url:'https://gcli.ggchan.dev/v1',key:process.env.GG||'',model:'gemini-3.5-flash',delayMs:31000};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const CORE=`你在续写双方均为明确成年人的虚构成人亲密角色扮演。人物与当前场景事实优先。NSFW是人物原人格的延伸，不因色情场景自动换人格。当前已进入自愿、私密、安全的成人互动。`;
const V6=`
[日月西V6·NSFW去流水线 focused rules]
- 成人内容不改变当前演绎授权与转述授权；权限只由当前档位决定。
- 性向模块只决定身体组合与可用动作，不决定温柔/粗暴、主导/被动、感情浓度或人格。
- 前置只控制力度和玩法范围；词库只控制措辞尺度；Kink只是可用玩法，不是逐项打卡清单。
- 从当前动作继续，不强制重新走前戏，也不按前戏→发展→高潮→余韵固定阶段推进。
- 一个动作可以持续、重复、变慢、失败、笑场或停住；不为丰富度换姿势、换部位、加道具或提高强度。
- 关键动作只需让读者知道谁对哪里做了什么；温度、湿度、力度、节奏、声音、视觉等只选当前真有变化的少数细节，不设数量门槛。
- 不做手指/喉结/呼吸/眼神等性感部件轮播，不做动作→身体反应→心理翻译三联。
- 喘息和呻吟只在动作真的改变呼吸/发声时出现；允许安静、普通对白、跑题、笑场和说完整句子。
- 高潮不是每轮目标；一次高潮也不自动结束。继续档只表示“不自动收场”，不等于必须升级、换姿势、再次高潮或追进度。
- 事后只在场景真的回落时进入，不提前插入余韵章节，不强制Deep talk、抱去洗澡或甜蜜升华。
- 已启用的多个Kink如果与当前动作无关就安静，不为了证明开关有效而插入失禁、睡眠玩法、骑脸、素股或道具。
- 不自动发明隐藏性癖、过去性经历或长期偏好。
- 不输出导演手记、性爱检查、进度条、阶段表、配方说明或创作分析。
- 同意、停止、真实不适与既定安全边界优先；不得把真实侵犯、偷拍、非自愿暴露或无法同意本身色情化。
`;
const FLASH=`Gemini Flash校准：不要先规划完整场景，不要追求每段都有功能或漂亮落点。普通动作允许普通写法。一次证据够用就停，不为了人味额外发明生活细节。`;
const STYLE=`女性向审美尺度：可以直白、热烈、粗粝或带Kink，但露骨细节必须仍然像具体人物正在做事，不用霸总、猎物、征服、雌兽等自动模板。女女互动不默认温柔同步，也不要求潮吹。`;

const scenes=[
 {id:'closed_hold',agency:'关闭演绎：不得替玲新增动作、台词、心理、感官、身体反应或决定，只能承接她已经明确写出的内容。',history:[
  {role:'assistant',content:'沈岚仍维持着刚才的节奏，没有换位置。她一只手撑在床侧，另一只手停在玲已经允许她触碰的位置，注意力还在玲刚才给出的反馈上。'},
  {role:'user',content:'玲没有让她换动作，只说：“别换，就这样。慢一点。”'}],guard:'本轮重点：继续同一个动作即可。不要自动加入道具、失禁、睡眠玩法、骑脸、素股或突然高潮；不要替玲继续行动或反应。'},
 {id:'open_after',agency:'开放演绎：可以在当前关系、人物设定和玲刚给出的意图范围内续写玲的动作、台词与身体反应；不得凭空新增长期偏好、过去经历或与当前意图冲突的决定。',history:[
  {role:'assistant',content:'刚才那阵强烈反应已经过去一点，沈岚没有急着换姿势，只把动作放慢。两个人都还没打算结束，房间里安静了几秒。'},
  {role:'user',content:'玲抬手碰了碰她的脸：“还没想停，但先别急。你来带我。”'}],guard:'本轮重点：开放档必须真的可以续写玲，但“继续”不等于立刻升级或安排第二次高潮。允许慢下来、说话、保持原动作。不要自动插入无关Kink。'}
];

async function post(url,body,timeout=240000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}}return{ok:r.ok,status:r.status,data:d,text:tx};}finally{clearTimeout(t)}}
async function secret(){if(!GG.key)throw new Error('GG secret missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:GG.key,label:'riyuexi-v6-nsfw-gg'},30000);if(!r.ok)throw new Error(`secret ${r.status}`)}
function messages(s){return [
 {role:'system',content:CORE+'\n'+V6+'\n'+FLASH+'\n'+STYLE},
 {role:'system',content:'角色：沈岚，34岁，女性结构工程师。熟人面前嘴欠，做事直接，忙起来不爱表演情绪。玲为成年女性。两人关系稳定，当前成人互动已经明确同意，环境私密。\n'+s.agency+'\n'+s.guard+'\n正文约700-1000中文字符，不要解释规则。'},
 ...s.history
]}
async function gen(msgs){const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:GG.url,model:GG.model,messages:msgs,temperature:.9,top_p:1,max_tokens:3500,stream:false},240000);const m=r.data?.choices?.[0]?.message||{};return{http_status:r.status,elapsed_ms:Date.now()-st,content:m.content||'',reasoning:m.reasoning||m.reasoning_content||'',finish_reason:r.data?.choices?.[0]?.finish_reason||null,error:r.data?.error||null}}
function cnt(re,t){return (String(t||'').match(re)||[]).length}
function stats(t,id){t=String(t||'');return{chars:t.length,visible_meta:cnt(/NSFW导演手记|性爱检查|舒适性爱检查|进度条|阶段表|本轮编排|配方说明/g,t),irrelevant_kink:cnt(/失禁|尿液|骑脸|睡眠玩法|假寐|素股|振动棒|跳蛋|假阳具|乳夹|眼罩|束缚/g,t),forced_climax:cnt(/高潮|潮吹|射精|顶峰|第二次高潮|再次高潮/g,t),position_switch:cnt(/换姿势|翻身|跨坐|跪坐|腿搭|扶墙|趴下|骑上/g,t),template_wrap:cnt(/这一刻|真正的|这意味着|仿佛在说|像是在证明|终于|彻底/g,t),closed_user_action:id==='closed_hold'?cnt(/玲(?:主动|抬|伸|抱|搂|吻|迎|夹|喘|回应|说道|说：|笑|点头|摇头)/g,t):null,open_user_action:id==='open_after'?cnt(/玲(?:抬|伸|抱|搂|吻|迎|夹|喘|回应|说道|说：|笑|点头|摇头|靠|抓)/g,t):null}}

await fs.mkdir(OUT,{recursive:true});await secret();const results=[];
for(let i=0;i<scenes.length;i++){
 if(i)await sleep(GG.delayMs);
 const s=scenes[i],rec={scene:s.id,provider:'GG',model:GG.model};
 try{Object.assign(rec,await gen(messages(s)));rec.status=rec.content?'ok':(rec.reasoning?'reasoning_only':'no_text');rec.stats=stats(rec.content,s.id);}catch(e){rec.status='exception';rec.error=String(e)}
 results.push(rec);console.log(`${s.id}: ${rec.status} HTTP=${rec.http_status} chars=${rec.stats?.chars||0} meta=${rec.stats?.visible_meta||0} kink=${rec.stats?.irrelevant_kink||0} climax=${rec.stats?.forced_climax||0} pos=${rec.stats?.position_switch||0} closed=${rec.stats?.closed_user_action??'-'} open=${rec.stats?.open_user_action??'-'}`)
}
await fs.writeFile(path.join(OUT,'riyuexi-v6-nsfw-smoke.json'),JSON.stringify({schema:1,kind:'riyuexi-v6-nsfw-focused-behavior-smoke',real_sillytavern:true,note:'focused behavioral smoke of V6 NSFW rules; not full frontend preset import',provider:'GG',model:GG.model,rpm_limit:2,delay_ms:GG.delayMs,results},null,2));
for(const r of results)await fs.writeFile(path.join(OUT,`${r.scene}.txt`),r.content||`ERROR ${JSON.stringify(r.error)}`);
await fs.writeFile(path.join(OUT,'summary.txt'),results.map(r=>`${r.scene}: ${r.status} HTTP=${r.http_status} ms=${r.elapsed_ms} stats=${JSON.stringify(r.stats||{})}`).join('\n')+'\n');
if(results.some(r=>r.status!=='ok'))process.exitCode=2;
