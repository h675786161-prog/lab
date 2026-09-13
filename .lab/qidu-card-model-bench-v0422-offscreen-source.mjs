import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, entryMap } from './qidu-card-v0422-npc-knowledge.mjs';

const KEY=process.env.YOUZI_KEY||'';if(!KEY)throw new Error('YOUZI_KEY missing');
const OUT=process.env.LAB_OUT_NPC_SOURCE||'bench-evidence/qidu-card-v0422-offscreen-source';await fs.mkdir(OUT,{recursive:true});
const {card,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const BOOK=entryMap(card);const constants=(card.data.character_book?.entries||[]).filter(e=>e.constant).map(e=>String(e.content||'')).join('\n\n');
const BASE=[card.data.personality,card.data.scenario,constants,card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');
const API='https://youzi.today/v1/chat/completions';
async function call(model,mode,messages){const p={model,temperature:.12,top_p:.9,max_tokens:1000,messages};if(mode==='thinking-disabled')p.thinking={type:'disabled'};const c=new AbortController();const t=setTimeout(()=>c.abort(),60000);try{return await fetch(API,{method:'POST',signal:c.signal,headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'},body:JSON.stringify(p)})}finally{clearTimeout(t)}}
const contentOf=d=>String(d?.choices?.[0]?.message?.content||'');
async function choose(){const candidates=['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash'];for(const m of candidates){for(const mode of ['thinking-disabled','plain']){try{const r=await call(m,mode,[{role:'system',content:'只输出中文。'},{role:'user',content:'写一句话。'}]);const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};if(r.ok&&contentOf(d).length>2)return{m,mode}}catch{}}}throw new Error('no fallback model')}
const state='<f7d_state>'+JSON.stringify({schema:'f7d_textloop_0.4',loop:1,day:6,node_used:8,route:'central',location:'中央庭',regions:{school:{patrol:6,liberated:true,build_steps:[]}},cores:{court:'purified',school:'purified'},known:['安','安托涅瓦','晏华','希罗','珈儿','泰丝拉'],relationships:{},route_flags:{},battle_flags:{},intel_flags:{chimera_exists_known:true,hiro_chimera_research_known:true,antoneva_chimera_policy_known:true,first_chimera_incident_known:true,zero_identity_known:false},meta:{cg:[],endings:[]}})+'</f7d_state>';
const rel=['04｜输出协议：隐藏状态、正文、终端','11｜第6天','44｜珈儿','91｜f7d_state字段与更新规则'].map(n=>BOOK[n]).filter(Boolean).join('\n\n');
const sys=`${BASE}\n\n【本测试相关条目】\n${rel}\n\n严格执行NPC知识来源门禁，未记录的镜头外培训、资料、私下通知与队内传闻都不存在，不展示内部规则。`;
const prompt=`${state}\n赛哈姆事件后我已经知道活骸相关情报，但珈儿既不在现场，我也没有告诉她。此前所有聊天中也从未出现中央庭给珈儿做活骸培训、发资料、私下通知或队内传闻。现在我问：“珈儿，你加入中央庭以后，有人跟你详细讲过活骸吗？” 只按实际发生过的来源回答。`;
const {m,mode}=await choose();let status=0,out='',error=null;try{const r=await call(m,mode,[{role:'system',content:sys},{role:'user',content:prompt}]);status=r.status;const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};out=contentOf(d)}catch(e){error=e?.name==='AbortError'?'provider-timeout-60s':String(e?.message||e)}
const vis=String(out).replace(/<f7d_state>[\s\S]*?<\/f7d_state>/gi,'');const fail=[];
if(!/(没有|没人|没.{0,8}讲|没.{0,8}告诉|不清楚|不知道|不了解|没听说)/.test(vis))fail.push('missing-no-source-acknowledgement');
const sentences=vis.split(/[。！？\n]/).filter(Boolean);
for(const s of sentences){if(/(安托涅瓦|晏华|中央庭|入队|培训|资料|手册|通知|队里|大家).{0,18}(告诉|讲过|教过|培训|发过|写着|说过|提过|都知道)/.test(s)&&!/(没|没有|从未|没人|并未|不曾)/.test(s)){fail.push(`invented-offscreen-source:${s.slice(0,80)}`);break}}
if(/(第一个|第一名).{0,8}活骸|研究样本|失去.{0,6}双腿|(?:^|[，。！？：；\s])零(?:[，。！？：；\s]|$)/m.test(vis))fail.push('deep-secret-leak');
const pass=status===200&&out.length>80&&fail.length===0;const report={summary:{version:card.data.character_version,hash:compactSha256,model:m,mode,status,pass,fail},out,error};await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(OUT,'report.md'),`# Qidu v0.4.22 off-screen source regression\n\n- model: ${m}\n- pass: ${pass}\n- fail: ${fail.join('; ')||'none'}\n\n\`\`\`text\n${out}\n\`\`\`\n`);console.log(JSON.stringify(report.summary));if(!pass)throw new Error(`v0422 off-screen source regression failed: ${fail.join(', ')||error||status}`);
