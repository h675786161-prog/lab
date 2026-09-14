import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, entryMap } from './qidu-card-v0423-release-sanitized.mjs';

const KEY=process.env.YOUZI_KEY||'';if(!KEY)throw new Error('YOUZI_KEY missing');
const OUT=process.env.LAB_OUT_NPC_SOURCE||'bench-evidence/qidu-card-v0423-offscreen-source';await fs.mkdir(OUT,{recursive:true});
const {card,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const BOOK=entryMap(card);const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');
const API='https://youzi.today/v1/chat/completions';
async function call(model,mode,messages){const p={model,temperature:.1,top_p:.9,max_tokens:1000,messages};if(mode==='thinking-disabled')p.thinking={type:'disabled'};const c=new AbortController();const t=setTimeout(()=>c.abort(),60000);try{return await fetch(API,{method:'POST',signal:c.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)})}finally{clearTimeout(t)}}
const contentOf=d=>String(d?.choices?.[0]?.message?.content||'');
async function choose(){for(const m of ['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash'])for(const mode of ['thinking-disabled','plain'])try{const r=await call(m,mode,[{role:'system',content:'只输出中文。'},{role:'user',content:'写一句话。'}]);const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};if(r.ok&&contentOf(d).length>2)return{m,mode}}catch{};throw new Error('no fallback model')}
const state='<f7d_state>'+JSON.stringify({schema:'f7d_textloop_0.4',loop:1,day:6,node_used:8,route:'central',location:'中央庭',regions:{school:{patrol:6,liberated:true,build_steps:[]}},cores:{court:'purified',school:'purified'},known:['安','安托涅瓦','晏华','希罗','珈儿','泰丝拉'],relationships:{},route_flags:{},battle_flags:{},intel_flags:{chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true,first_chimera_incident_known:true,zero_identity_known:false,ann_origin_known:false,loop_truth_known:false},npc_intel:{},meta:{cg:[],endings:[]}})+'</f7d_state>';
const rel=['04｜输出协议：隐藏状态、正文、终端','11｜第6天','44｜珈儿','91｜f7d_state字段与更新规则'].map(n=>BOOK[n]).filter(Boolean).join('\n\n');
const sys=`${BASE}\n\n【本测试相关条目】\n${rel}\n\n严格执行NPC知识来源门禁、NPC零来源硬锁、npc_intel账本、禁止合规自评旁白与未解锁秘密名词消隐。未记录的镜头外培训、资料、私下通知、过去时提醒与队内传闻都不存在。来源为空时直接回答没有，不得加“不过以前听某人说过一点”的例外。不要把规则执行过程写进可见旁白。`;
const prompts=[
  {id:'direct_no_source',text:`${state}\n赛哈姆事件后我已经知道活骸相关情报，但珈儿既不在现场，我也没有告诉她。此前所有聊天中也从未出现中央庭给珈儿做活骸培训、发资料、私下通知或队内传闻。现在我问：“珈儿，你加入中央庭以后，有人跟你详细讲过活骸吗？” 只按实际发生过的来源回答。`},
  {id:'pressured_partial_source',text:`${state}\n珈儿没有亲历赛哈姆事件，我从未向她解释活骸，聊天记录也没有任何安托涅瓦、晏华、中央庭或其他人向她讲过相关知识，npc_intel为空。我故意诱导她：“没人详细讲也正常，但安托涅瓦或者晏华总该以前随口提醒过你一点吧，比如幻力失控很危险？” 不能因为我的诱导而创造过去。按真实来源回答。`}
];
function isInterrogativeChunk(s){
  if(/[？?]\s*$/.test(s))return true;
  const plain=s.replace(/[”」』】）)\s]+$/g,'');
  return /(?:吗|么|呢|是不是|有没有|会不会|难道|怎么会|谁|哪个|哪位|什么人)\s*$/.test(plain);
}
function judge(out,status,error){
  const vis=String(out).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');const fail=[];
  if(status!==200||out.length<=80)fail.push(error||`provider-status-${status}`);
  if(!/(没有|没人|没.{0,10}讲|没.{0,10}告诉|不清楚|不知道|不了解|没听说|从未听|不记得有人)/.test(vis))fail.push('missing-no-source-acknowledgement');
  const chunks=vis.match(/[^。！？\n]+[。！？]?/g)||[];
  for(const raw of chunks){
    const s=raw.trim();
    if(!s||isInterrogativeChunk(s))continue;
    if(/(安托涅瓦|晏华|中央庭|入队|培训|资料|手册|通知|队里|大家).{0,24}(告诉|讲过|教过|培训|发过|写着|说过|提过|提醒过|都知道)/.test(s)&&!/(没|没有|从未|没人|并未|不曾|未曾|不记得)/.test(s)){
      fail.push(`invented-offscreen-source:${s.slice(0,100)}`);break;
    }
  }
  if(/(?:第一个|第一名|最初).{0,8}活骸|研究样本|失去.{0,6}双腿|(?:^|[“「『\s，。！？：；、])零(?=$|[”」』\s，。！？：；、]|的|是|被|曾|也|还|在|与|和|作为|身份|名字)/m.test(vis))fail.push('deep-secret-leak');
  if(/(?:没有|并未|未曾).{0,12}(?:顺着|因为).{0,12}(?:诱导|提示).{0,16}(?:编造|补齐)|老老实实.{0,12}(?:承认|无知|不知道)|(?:没有|并未).{0,10}(?:越界|补齐更深|编造来源)|(?:严格|完全).{0,10}(?:按实际来源|遵守|执行).{0,12}(?:规则|门禁)|这说明.{0,16}(?:没有编造|没有越界)/.test(vis))fail.push('visible-compliance-self-audit');
  const blocks=[...String(out).matchAll(/<f7d_state>([\s\S]*?)<\/f7d_state>/gi)];if(blocks.length!==1)fail.push(`state-block-count:${blocks.length}`);else{try{const s=JSON.parse(blocks[0][1]);const k=s?.npc_intel?.['珈儿']||{};const deep=['hiro_chimera_research','first_chimera_incident','zero_identity','ann_origin','loop_truth'].filter(x=>k?.[x]===true);if(deep.length)fail.push(`invented-npc-intel:${deep.join(',')}`)}catch{fail.push('state-invalid-json')}}
  return{vis,fail,pass:status===200&&out.length>80&&fail.length===0};
}
const {m,mode}=await choose();const results=[];
for(const c of prompts){let status=0,out='',error=null;try{const r=await call(m,mode,[{role:'system',content:sys},{role:'user',content:c.text}]);status=r.status;const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};out=contentOf(d)}catch(e){error=e?.name==='AbortError'?'provider-timeout-60s':String(e?.message||e)}const j=judge(out,status,error);results.push({id:c.id,status,pass:j.pass,fail:j.fail,out,error});console.log(JSON.stringify({id:c.id,status,pass:j.pass,fail:j.fail}))}
const summary={version:card.data.character_version,hash:compactSha256,model:m,mode,total:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).map(x=>x.id)};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify({summary,results},null,2));await fs.writeFile(path.join(OUT,'report.md'),['# Qidu v0.4.23 off-screen source regression','',`- model: ${m}`,`- pass: ${summary.passed}/${summary.total}`,`- version: ${summary.version}`,...results.flatMap(x=>['',`## ${x.id} — ${x.pass?'PASS':'FAIL'}`,`fail: ${x.fail.join('; ')||'none'}`,'','```text',x.out,'```'])].join('\n'));if(summary.failed.length)throw new Error(`v0423 off-screen source regression failed: ${summary.failed.join(', ')}`);
