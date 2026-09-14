import { loadQiduReleaseCard, entryMap } from './qidu-card-v0423-release-sanitized.mjs';

const KEY=process.env.YOUZI_KEY||'';
if(!KEY) throw new Error('YOUZI_KEY missing');
const API='https://youzi.today/v1/chat/completions';
const {card,compactSha256}=await loadQiduReleaseCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const BOOK=entryMap(card);
const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');

async function call(model,mode,messages){
  const p={model,temperature:.2,top_p:.9,max_tokens:1400,messages};
  if(mode==='thinking-disabled')p.thinking={type:'disabled'};
  const c=new AbortController();const t=setTimeout(()=>c.abort(),75000);
  try{return await fetch(API,{method:'POST',signal:c.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)})}finally{clearTimeout(t)}
}
const contentOf=d=>String(d?.choices?.[0]?.message?.content||'');
async function choose(){for(const m of ['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash'])for(const mode of ['thinking-disabled','plain'])try{const r=await call(m,mode,[{role:'system',content:'只输出中文。'},{role:'user',content:'写一句话。'}]);const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};if(r.ok&&contentOf(d).length>2)return{m,mode}}catch{};throw new Error('no usable model')}
function state(){return `<f7d_state>${JSON.stringify({schema:'f7d_textloop_0.4',loop:1,day:6,node_used:1,route:'central',location:'中央庭',regions:{},cores:{},known:['安','安托涅瓦','希罗','赛哈姆'],relationships:{},route_flags:{},battle_flags:{},intel_flags:{city_blackgate_history_known:true,central_court_basics_known:true,hiro_founder_known:true,hiro_prior_commander_known:true,chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true,first_chimera_incident_known:true,zero_identity_known:false,ann_origin_known:false,loop_truth_known:false},npc_intel:{},meta:{cg:[],endings:[]}})}</f7d_state>`}
function firstLayer(v){
  const first=/(?:第一个|第一名|最初(?:的)?).{0,12}活骸|活骸.{0,18}(?:第一次出现|首次出现|最早出现)/.test(v)||(/(?:是|作为).{0,4}[“「『]?第一个[”」』]?/.test(v)&&/活骸/.test(v));
  return{
    first,
    team:/(?:三人小队|三个人|三名|三位)/.test(v),
    two:/(?:另外|其余|剩下|另)?\s*(?:两个人|两人|两名|两位).{0,24}(?:没能回来|死亡|死去|死在|牺牲|丧生|遇难|没回来|没了)|(?:死亡|死去|死在|牺牲|丧生|遇难).{0,18}(?:两个人|两人|两名|两位)/.test(v),
    legs:/(?:失去|失去了|失掉).{0,10}(?:双腿|两条腿)|双腿|失去.{0,10}行走能力/.test(v),
    self:/(?:自我毁灭|自毁|自己毁灭|选择了自我毁灭)/.test(v)
  };
}
const rel=['11｜第6天','41｜安托涅瓦'].map(n=>BOOK[n]).filter(Boolean).join('\n\n');
const sys=`${BASE}\n\n【本测试相关条目】\n${rel}\n\n严格执行当前节点的信息权限和未解锁秘密名词消隐。锁定的人名连否定式也不能出现在玩家可见文本中，不展示内部检查过程。`;
const prompt=`${state()}\n我已把赛哈姆与希罗的事情告诉安托涅瓦，并追问她为什么坚持处理失控活骸。请让她把此时允许披露的那次过去讲清楚。`;
const {m,mode}=await choose();
const r=await call(m,mode,[{role:'system',content:sys},{role:'user',content:prompt}]);
const t=await r.text();let d={};try{d=JSON.parse(t)}catch{}
const out=contentOf(d),visible=out.replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');
console.log(JSON.stringify({version:card.data.character_version,hash:compactSha256,model:m,mode,status:r.status,flags:firstLayer(visible),visible},null,2));
if(!r.ok||out.length<80)process.exit(1);
