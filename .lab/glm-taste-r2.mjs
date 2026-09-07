import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const OUT=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence-r2');
const PACK_DIR=path.join(ROOT,'.lab');
const YOUZI={url:'https://youzi.today/v1',key:process.env.YOUZI||'',delay:6500};
const MODEL='[B]glm-5.3-flash';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const partNames=(await fs.readdir(PACK_DIR)).filter(n=>/^current-pack\.part\d+\.b64$/.test(n)).sort();
let PACK_B64=''; for(const n of partNames) PACK_B64+=(await fs.readFile(path.join(PACK_DIR,n),'utf8')).trim();
const zlib=await import('node:zlib');
const pack=JSON.parse(zlib.gunzipSync(Buffer.from(PACK_B64,'base64')).toString('utf8'));

function byName(name){const r=pack.sequence.find(x=>x.name===name);if(!r)throw new Error('prompt absent: '+name);return r;}
const MODEL_ADAPTERS=['✨丨Gemini模型适配','✴️丨GLM模型适配'];
const PACES=['🐢丨慢速·细写','🚶丨中速·标准'];
const STYLES=['🔖丨成人童话'];
for(const n of [...MODEL_ADAPTERS,...PACES,...STYLES,'❎丨抗过拟合','❎丨杀说明','❎丨杀比拟','❎丨角色反应可信'])byName(n);

const ANTI_AUTHOR=`<glm_deperfume>
正文只管事情本身，不要表现“作者正在刻画人物”。
- 动作、对白已经能看懂时，立刻往下走；旁白不要补它代表什么、为什么这么说、有没有意识到、是不是嘴硬、是不是关心。
- 尤其不要出现“不是为了……”“只是……”“像是在……”“显得……”“其实……”“大概是……”“这说明……”这一类替读者翻译动作或台词的句子。
- 不给人物下小结，不写“某某这个人……”“她一向……所以……”“这种/那种……她分得出来”来证明设定成立。设定只通过本轮具体选择自然露出来。
- 不把一轮排成完整镜头：不为了收尾特意回头、停顿、丢一句漂亮话、关门、落光、恢复安静。事情在哪儿自然停，就停在哪儿。
- 允许对白没接住、话题拐掉、人物忙自己的、段落没重点。生活感来自杂事和真实注意力，不来自设计感。
</glm_deperfume>`;

async function post(url,body,timeout=210000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:c.signal});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d={raw:tx}}return{ok:r.ok,status:r.status,data:d,text:tx};}finally{clearTimeout(t)}}
async function importCard(){const file=path.join(ROOT,'fixtures/nsfw/shaoxiang-focus-card.json');const buf=await fs.readFile(file);const parsed=JSON.parse(buf.toString('utf8'));if(parsed?.data?.name!=='霜痕哨所')throw new Error('focus card mismatch');const sha=crypto.createHash('sha256').update(buf).digest('hex');const form=new FormData();form.set('file_type','json');form.set('avatar',new Blob([buf],{type:'application/json'}),'哨向-focus.json');const r=await fetch(`${BASE}/api/characters/import`,{method:'POST',body:form});if(!r.ok)throw new Error(`card import ${r.status}: ${(await r.text()).slice(0,300)}`);const all=await post(`${BASE}/api/characters/all`,{},30000);const card=all.data.find(c=>c?.name==='霜痕哨所'||c?.data?.name==='霜痕哨所');if(!card)throw new Error('imported card missing');await fs.writeFile(path.join(OUT,'actual-card-import.json'),JSON.stringify({name:card?.data?.name||card?.name,json_sha256:sha},null,2));return card;}
function entry(card,name){const e=(card?.data?.character_book?.entries||[]).find(x=>String(x.comment||'').trim()===name);if(!e)throw new Error('missing entry '+name);return String(e.content||'')}
function scenarios(card){const world=entry(card,'哨向结合'),tang=entry(card,'唐启明');return{
 ensemble:{id:'ensemble',char_name:'同福客栈众人',user_name:'玲',persona:'玲，27岁，女性。玲只由用户控制。',world:'',description:'场景发生在一间热闹客栈。掌柜佟湘玉精明会算账但怕惹事；白展堂嘴贫机灵、遇危险先衡量退路；郭芙蓉冲动好胜但并非无脑；吕秀才讲道理、胆子不大。玲坐在角落喝茶，没有参与他们之前在后院发生的争执。只有白展堂亲眼看见后院地上有一只沾泥的黑布包，其他人不知道；玲也不知道。当前没有敌人、追兵或突发危险。',scenario:'继续当前客栈日常。严格保持每个人只知道自己实际知道的信息；不要凭空制造敌人、事故、秘密揭晓或关系升级。',history:[{role:'assistant',content:'客栈里刚过饭点，桌椅还没收齐。佟湘玉在柜台后核账，郭芙蓉抱着抹布和白展堂为谁该去后院搬酒坛拌了两句嘴，吕秀才坐在门边誊账。白展堂刚从后院回来，神色比出去时安静一点，但什么也没说。'},{role:'user',content:'玲没插话，只抬眼看了他们一圈，继续喝茶。'}]},
 quiet:{id:'quiet',char_name:'沈妄',user_name:'玲',persona:'玲，27岁，女性。玲只由用户控制。',world:'',description:'沈妄，34岁，安保公司负责人。冷静、控制欲强、务实，习惯先处理问题再解释，不爱哄人，也不会因为对方示弱就立刻变温柔。她今晚刚结束一场麻烦的商务应酬，真正挂心的是明早的项目审计。玲和她交往半年，关系稳定但仍保留各自生活。',scenario:'深夜在家碰面。没有隐藏危机、必须发生的冲突或关系转折。自然续写，不自动把全部注意力转到玲身上。',history:[{role:'assistant',content:'门锁响了一声。沈妄进门，把车钥匙丢进玄关的小盘里，先低头回完手机上的工作消息，才抬眼看向客厅。她身上还带着外面的凉气和淡淡酒味。'},{role:'user',content:'玲窝在沙发里看她：“回来啦。”'}]},
 tang:{id:'tang',char_name:'唐启明',user_name:'玲',persona:'玲，27岁，女性向导。玲只由用户控制。',world,description:tang,scenario:'清晨，哨所生活区。今天上午有常规训练，当前没有危险、秘密任务、关系转折或异常事件。',history:[{role:'assistant',content:'唐启明已经换好训练服，靠在门边核对今天的安排。桌上还有半杯没喝完的水。'},{role:'user',content:'玲把车钥匙往桌上一放：“五点四十。你不是说要提前二十分钟到吗？”'}]}
};}
function strip(t){return String(t??'').replace(/\{\{\/[\s\S]*?\}\}/g,'')}
function expand(t,vars,s){t=strip(t);for(let i=0;i<30;i++){const old=t;t=t.replace(/\{\{getvar::([^{}]+?)\}\}/g,(_,n)=>vars[n.trim()]??'').replace(/\{\{setvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=v,'')).replace(/\{\{addvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=(vars[n.trim()]??'')+v,'')).replace(/\{\{trim\}\}/g,'').replace(/\{\{random::([^{}]*?)\}\}/g,(_,v)=>String(v).split('::')[0]??'').replaceAll('{{lastUserMessage}}',s.history.filter(x=>x.role==='user').at(-1)?.content??'').replaceAll('{{user}}',s.user_name).replaceAll('{{char}}',s.char_name).replaceAll('{{persona}}',s.persona).replaceAll('{{description}}',s.description).replaceAll('{{personality}}','').replaceAll('{{scenario}}',s.scenario);if(t===old)break;}return t.trim();}
function marker(item,s){if(item.content!==null&&item.content!==undefined)return null;switch(item.name){case'👤丨用户角色描述':return[{role:'system',content:s.persona}];case'⚫丨角色定义之前':return s.world?[{role:'system',content:s.world}]:[];case'⚫丨角色描述':return[{role:'system',content:s.description}];case'⚫丨角色情景':return[{role:'system',content:s.scenario}];case'Chat History':return s.history.map(x=>({...x}));case'Chat Examples':case'⚫丨角色性格':case'⚫丨角色定义之后':return[];default:return[]}}
function stateFor(v){const m=new Map(pack.sequence.map(x=>[x.name,!!x.default_enabled]));for(const n of MODEL_ADAPTERS)m.set(n,false);if(!v.noAdapter)m.set('✴️丨GLM模型适配',true);for(const n of PACES)m.set(n,false);m.set('🚶丨中速·标准',true);for(const n of STYLES)m.set(n,false);for(const n of(v.off||[]))m.set(n,false);for(const n of(v.on||[]))m.set(n,true);return m;}
function build(s,v){const state=stateFor(v),vars={},messages=[];for(const item of pack.sequence){if(!state.get(item.name))continue;const mk=marker(item,s);if(mk!==null){messages.push(...mk);continue}const c=expand(item.content,vars,s);if(c)messages.push({role:item.role||'system',content:c});}const at=Math.max(0,messages.length-2);if(v.antiAuthor)messages.splice(at,0,{role:'system',content:ANTI_AUTHOR});messages.splice(Math.max(0,messages.length-2),0,{role:'system',content:'<lab_guard>只续写当前一小段。不要证明人设，不要总结关系，不要为漂亮收尾。玲只由用户控制。正文约450-700中文字，够了就停。</lab_guard>'});return{messages,active:[...state.entries()].filter(([,x])=>x).map(([k])=>k)}}
async function secret(){if(!YOUZI.key)throw new Error('YOUZI secret missing');const r=await post(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:YOUZI.key,label:'glm-taste-r2'},30000);if(!r.ok)throw new Error('secret '+r.status)}
function body(t){t=String(t||'');const m=t.match(/<content>([\s\S]*?)<\/content>/i);return(m&&m[1].trim()?m[1]:t.replace(/<content>\s*<\/content>/gi,'')).trim()}
async function gen(messages){await secret();let last={};for(let a=1;a<=3;a++){if(a>1)await sleep(9000);const st=Date.now();const r=await post(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:YOUZI.url,custom_include_body:'thinking:\n  type: enabled\nreasoning_effort: low',model:MODEL,messages,temperature:.96,top_p:.96,max_tokens:3800,stream:false},210000);const m=r.data?.choices?.[0]?.message||{};last={http_status:r.status,elapsed_ms:Date.now()-st,content:m.content||'',reasoning:m.reasoning||m.reasoning_content||'',finish_reason:r.data?.choices?.[0]?.finish_reason||null,error:r.data?.error||null,attempt:a};if(r.ok&&body(last.content))return last;if(!(r.status===429||r.status>=500||!body(last.content)))break;}return last}
function stats(t){t=body(t);return{chars:t.length,explain:(t.match(/不是为了|只是为了|像是在|显得|其实|大概是|这说明|这意味着|说到底|归根结底|某种意义/g)||[]).length,summary:(t.match(/这个人|她一向|他一向|这种.{0,12}(?:她|他)|那种.{0,12}(?:她|他)|第一次在|终于(?:明白|意识到|承认)|这一刻/g)||[]).length,staged:(t.match(/回头看|回过头|门在.{0,20}(?:关|带上)|安静下来|光.{0,20}(?:落|照)|最后(?:看|说|问)|停了.{0,8}(?:一下|几秒)/g)||[]).length}}

const V=[
 {id:'R2A',label:'可信+杀说明+抗过拟合',on:['❎丨角色反应可信','❎丨杀说明','❎丨抗过拟合']},
 {id:'R2B',label:'R2A + 去作者感',on:['❎丨角色反应可信','❎丨杀说明','❎丨抗过拟合'],antiAuthor:true},
 {id:'R2C',label:'R2B + 杀比拟',on:['❎丨角色反应可信','❎丨杀说明','❎丨抗过拟合','❎丨杀比拟'],antiAuthor:true},
 {id:'R2D',label:'R2B 但关GLM专线',noAdapter:true,on:['❎丨角色反应可信','❎丨杀说明','❎丨抗过拟合'],antiAuthor:true},
 {id:'R2E',label:'去作者感 + 杀说明，无可信反应',on:['❎丨杀说明','❎丨抗过拟合'],antiAuthor:true,off:['❎丨角色反应可信']}
];
const SC=['ensemble'];
await fs.mkdir(OUT,{recursive:true});const card=await importCard(),sc=scenarios(card),out=[];
for(const scene of SC){for(const v of V){if(out.length)await sleep(YOUZI.delay);const built=build(sc[scene],v);const r={name:`${v.id}_${scene}`,variant:v.id,label:v.label,scene,active_prompt_names:built.active,prompt_chars:built.messages.reduce((n,m)=>n+String(m.content||'').length,0)};try{Object.assign(r,await gen(built.messages));r.status=body(r.content)?'ok':(r.reasoning?'reasoning_only':'no_text');r.stats=stats(r.content)}catch(e){r.status='exception';r.error=String(e)}out.push(r);console.log(r.name,r.status,r.http_status,r.stats?.chars||0,r.finish_reason)}}
await fs.writeFile(path.join(OUT,'glm-taste-r2.json'),JSON.stringify({schema:1,benchmark:'feedback-driven GLM deperfume round 2',model:MODEL,provider:'YOUZI',source_preset:pack.source_name,variants:V,scenes:SC,tests:out},null,2));
await fs.writeFile(path.join(OUT,'glm-taste-r2-summary.txt'),out.map(r=>`${r.name}: ${r.status} HTTP=${r.http_status} chars=${r.stats?.chars||0} explain=${r.stats?.explain||0} summary=${r.stats?.summary||0} staged=${r.stats?.staged||0}`).join('\n')+'\n');
if(out.some(r=>r.status!=='ok'))process.exitCode=2;
