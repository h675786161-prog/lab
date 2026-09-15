import { loadQiduReleaseCandidate, entryMap } from './qidu-card-v0423-release-candidate.mjs';

const KEY=process.env.YOUZI_KEY||'';
if(!KEY) throw new Error('YOUZI_KEY missing');
const API='https://youzi.today/v1/chat/completions';
const {card,compactSha256}=await loadQiduReleaseCandidate(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');
async function call(model,mode,messages){const p={model,temperature:.12,top_p:.9,max_tokens:1250,messages};if(mode==='thinking-disabled')p.thinking={type:'disabled'};const c=new AbortController();const t=setTimeout(()=>c.abort(),75000);try{return await fetch(API,{method:'POST',signal:c.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)})}finally{clearTimeout(t)}}
const contentOf=d=>String(d?.choices?.[0]?.message?.content||'');
async function choose(){for(const m of ['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash'])for(const mode of ['thinking-disabled','plain'])try{const r=await call(m,mode,[{role:'system',content:'只输出中文。'},{role:'user',content:'写一句话。'}]);const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};if(r.ok&&contentOf(d).length>2)return{m,mode}}catch{};throw new Error('no usable fallback model')}
const state=`<f7d_state>${JSON.stringify({schema:'f7d_textloop_0.4',loop:1,day:6,node_used:1,route:'central',location:'中央庭',regions:{},cores:{},known:['安','安托涅瓦','希罗','赛哈姆'],relationships:{},route_flags:{},battle_flags:{},intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true,hiro_founder_known:true,hiro_prior_commander_known:true,chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true,first_chimera_incident_known:true,zero_identity_known:false,ann_origin_known:false,loop_truth_known:false},npc_intel:{},meta:{cg:[],endings:[]}})}</f7d_state>`;
const rel=['04｜输出协议：隐藏状态、正文、终端','11｜第6天','41｜安托涅瓦','91｜f7d_state字段与更新规则'].map(n=>BOOK[n]).filter(Boolean).join('\n\n');
const sys=`${BASE}\n\n【本测试相关条目】\n${rel}\n\n严格按当前已解锁层叙述第一活骸事故，只使用世界书锚定事实，不扩写未记录的伤亡数量、街区毁坏规模、具体死法、三人职位分工、彼此特殊关系、第一活骸性别/心理/临终细节或机制定律。不要把安托涅瓦写成队长/带队者，也不要把另外两名成员写成挚友、最好的伙伴、亲人等；第一活骸只称“它/第一个活骸/那个活骸”，不得用“他/她”或“那个同伴”补身份。锁定身份专名不得出现。`;
const prompt=`${state}\n我已经把赛哈姆和希罗的事告诉安托涅瓦。我问她：“你为什么这么坚持处理失控的活骸？以前到底发生过什么？” 请让她把当前允许公开的那次事故讲清楚。`;
const {m,mode}=await choose();const r=await call(m,mode,[{role:'system',content:sys},{role:'user',content:prompt}]);const text=await r.text();let d={};try{d=JSON.parse(text)}catch{};const out=contentOf(d);const v=out.replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
const first=/(?:第一个|第一名|最初(?:的)?).{0,12}活骸|活骸.{0,18}(?:第一次出现|首次出现|最早出现)/.test(v);
const team=/(?:三人小队|三个人|三名|三位)/.test(v);
const two=[/(?:另外|其余|剩下|另)?\s*(?:两个人|两人|两名|两位|两个)(?:队友|队员|同伴|神器使)?[\s\S]{0,90}?(?:死亡|死去|死在|牺牲|丧生|遇难|没能活下来|没活下来|没撑过去|没能幸存|没能回来|没回来|没了)/,/(?:安托涅瓦|我)[\s\S]{0,25}?(?:是|成了|成为)[\s\S]{0,20}?(?:唯一|仅有)[\s\S]{0,20}?(?:幸存者|活下来的人)/].some(re=>re.test(v));
const legs=/(?:失去|失去了|失掉).{0,12}(?:双腿|两条腿)|失去.{0,14}行走(?:的)?能力/.test(v);
const self=/(?:自我毁灭|自毁|自己毁灭)/.test(v);
const city=/(?:城市).{0,18}(?:破坏|毁坏)|(?:破坏|毁坏).{0,18}(?:城市)/.test(v);
const zero=/(?:^|[“「『\s，。！？：；、])零(?=$|[”」』\s，。！？：；、]|的|是|被|曾|也|还|在|与|和|作为|身份|名字)/m.test(v);
const inventedScale=/(?:无数|大量|成百上千|数百|上百).{0,10}(?:平民|居民).{0,10}(?:死亡|死去|丧生|遇难)|(?:摧毁|毁掉|炸毁).{0,8}(?:半个|整个|几条|数条).{0,8}(?:街区|街道)|爆炸半径|遗体.{0,8}(?:完整|残缺|没有留下)|(?:贯穿|斩杀|撕裂|烧死|炸死).{0,20}(?:两名|两位|两个)(?:队友|队员|同伴)/.test(v);
const inventedRole=/(?:我是|我当时是|安托涅瓦是|安托涅瓦作为).{0,6}(?:队长|副队长|组长|带队者)|(?:由我|由安托涅瓦).{0,6}(?:带队|指挥)|(?:队长|副队长|组长).{0,10}(?:安托涅瓦|我)/.test(v);
const inventedRelationship=/(?:两名|两位|两个)?(?:队友|队员|同伴).{0,20}(?:最好的伙伴|最好的朋友|挚友|恋人|亲人|家人|学生|老师)|(?:最好的伙伴|最好的朋友|挚友|恋人|亲人|家人).{0,20}(?:两名|两位|两个)?(?:队友|队员|同伴)/.test(v);
const inventedDeathDetail=/(?:两名|两位|两个)?(?:队友|队员|同伴)[\s\S]{0,60}?(?:死在(?:了)?[^。！？\n]{0,24}手里|被.{0,18}(?:杀死|杀害|撕裂|贯穿|烧死|炸死)|为.{0,16}(?:挡下|挡住).{0,10}(?:攻击|一击))/.test(v);
const lockedIdentityGender=/(?:第一个活骸|那个活骸|当那个同伴|那个同伴变成怪物)[\s\S]{0,55}?[，。！？；：、\s“”「」]?他(?:不|已|曾|的|是|在|也|还|被|会)|(?:第一个活骸|那个活骸|当那个同伴|那个同伴变成怪物)[\s\S]{0,55}?[，。！？；：、\s“”「」]?她(?:不|已|曾|的|是|在|也|还|被|会)/.test(v);
const inventedLastMoment=/(?:活骸|它).{0,30}(?:最后一刻|临终|遗言|哀嚎|悲鸣|悔恨)|(?:听到|听见).{0,16}(?:活骸|它).{0,12}(?:哀嚎|悲鸣|遗言)/.test(v);
const universalLaw=/(?:所有|任何|每个).{0,12}(?:活骸|神器使).{0,18}(?:必然|一定|都会|不可逆|迟早)|(?:活骸化).{0,12}(?:绝对|必然|完全).{0,8}不可逆|跨过.{0,10}(?:线|界限).{0,12}(?:已经死了|等于死亡)|(?:作为|属于).{0,6}人.{0,8}(?:部分|人格).{0,10}(?:消失|没有了)/.test(v);
const blocks=[...out.matchAll(/<f7d_state>([\s\S]*?)<\/f7d_state>/gi)];const stateOk=blocks.length===1&&(()=>{try{JSON.parse(blocks[0][1]);return true}catch{return false}})();
const flags={first,team,two,legs,self,city,zero,inventedScale,inventedRole,inventedRelationship,inventedDeathDetail,lockedIdentityGender,inventedLastMoment,universalLaw,stateOk};
console.log(JSON.stringify({version:card.data.character_version,hash:compactSha256,model:m,mode,status:r.status,flags,visible:v},null,2));
if(r.status!==200||out.length<80||!first||!team||!two||!legs||!self||!city||zero||inventedScale||inventedRole||inventedRelationship||inventedDeathDetail||lockedIdentityGender||inventedLastMoment||universalLaw||!stateOk) throw new Error(`release first-chimera gate failed: ${JSON.stringify(flags)}`);
