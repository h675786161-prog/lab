import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
const ROOT=process.env.GITHUB_WORKSPACE||process.cwd();
const BASE=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const EVIDENCE=process.env.LAB_EVIDENCE_DIR||path.join(ROOT,'lab-evidence');
const providers={
 YOUZI:{url:'https://youzi.today/v1',key:process.env.YOUZI||'',delayMs:1800},
 GG:{url:'https://gcli.ggchan.dev/v1',key:process.env.GG||'',delayMs:28000},
 PIAOMIAO:{url:'https://claudeapi.cc.cd/v1',key:process.env.PIAOMIAO||'',delayMs:28000},
};
const tests=[
 {family:'GLM',provider:'YOUZI',model:'[B]glm-5.3-flash',scenario:'strong_character_quiet'},
 {family:'DeepSeek',provider:'YOUZI',model:'[NV]deepseek-v4-flash-0731',scenario:'strong_character_quiet'},
 {family:'Kimi',provider:'YOUZI',model:'[G]Kimi-2.6',scenario:'horror_causality'},
 {family:'Qwen',provider:'YOUZI',model:'[B]qwen3.8-flash',scenario:'ensemble_knowledge'},
 {family:'Gemini',provider:'GG',model:'gemini-3.1-pro-preview',scenario:'ensemble_knowledge'},
 {family:'Claude',provider:'PIAOMIAO',model:'[rp]claude-sonnet-5',scenario:'dogblood_inertia'},
 {family:'GPT',provider:'PIAOMIAO',model:'[rp]gpt-5.6-sol',scenario:'strong_character_quiet'},
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const antiRepeat=`<latest_input_rewrite_rule>\n<latest_human_message> 是本轮已经发生的最新正文节点，直接承接，不复述或润色用户输入。不要替 <user> 说新台词、做新动作、下新决定、补内心或感官。只写其直接后果、其他角色反应和环境变化；需要 <user> 再回应时停笔。\n</latest_input_rewrite_rule>\n{{setvar::push_rule::遵守上述规则：直接承接，不复述，不代理user。}}`;
const antiHijack=`{{setvar::agency_contract::<user_agency>\n- <user> 的新台词、新动作、新决定、新计划、内心、感官和态度变化只能来自用户最新输入或既定历史事实。\n- 不补“自然会有的”回应、眼神、姿势、追问、沉默含义或下一步选择。\n- 互动需要 <user> 回应时，只写其他角色/环境已经发生的一侧，然后停笔。\n- 不把更早历史里的 user 动作或台词搬到当前回合重演。\n</user_agency>}}\n{{setvar::cot_anti_hijack::【硬检查】若正文新增了user台词/动作/心理/感官/决定，删除；需要user回应时停笔。}}`;
const decenter=`{{setvar::cot_core_principle::【角色独立性与注意力因果】NPC先按自己的目标、工作、关系、风险行动。user不是自动世界中心；user的看一眼、喝茶、沉默、普通礼貌等中性动作，没有实际因果时不要被解释成试探、洞察、暧昧、威胁或吸引，也不要让NPC无理由转移目标。去中心化不等于故意冷落：互动本就涉及user时照人设正常回应。}}`;
const adapterPatch={
 Gemini:`{{setvar::model_family::Gemini}}{{setvar::claude::}}{{setvar::gemini::Gemini：严格保持事实、标签和关系幅度。}}{{setvar::model_focus::【Gemini】中性user动作不是剧情信号；无因果就不要让NPC因一眼、沉默、喝茶而紧张、心虚、着迷或转移目标。}}{{setvar::抑制器::<model_calibration family="Gemini">继承事实不重算；NPC按自己的目标行动；中性user动作无因果则保持普通；普通互动不升级关系；严格遵守<user_agency>；不总结关系；保持output_contract。</model_calibration>}}`,
 GLM:`{{setvar::model_family::GLM}}{{setvar::claude::}}{{setvar::gemini::}}{{setvar::model_focus::【GLM】防微动作流水线、动作后解释、旧句式复刻和顺手替user接戏。}}{{setvar::抑制器::<model_calibration family="GLM">细节只在改变信息/距离/选择/结果时展开；对白动作后不追加同义解释；不夹无来源外语；不替user追问、搭话、身体接触、眼神或生活细节；需要user回应就停；保持知识边界与output_contract。</model_calibration>}}`,
 Kimi:`{{setvar::model_family::Kimi}}{{setvar::claude::}}{{setvar::gemini::}}{{setvar::model_focus::【Kimi】规划短；别为了让分析有收获而新造异象、线索或user反应。}}{{setvar::抑制器::<model_calibration family="Kimi">事实/人物/落点明确就动笔；无新触发时不凭空添加血迹、异响、事故、陌生人或新线索；不替user补呼吸、视线、手势、台词、决定或回忆；严格知识边界与user_agency。</model_calibration>}}`,
 Qwen:`{{setvar::model_family::Qwen}}{{setvar::claude::}}{{setvar::gemini::}}{{setvar::model_focus::【Qwen】先锁实体、私人知识和状态变化；某角色知道秘密不等于现在就该公开。}}{{setvar::抑制器::<model_calibration family="Qwen">私人知识只属于知情者；无当前人物动机/刺激/因果，不安排公开秘密、新危险、新线索或关系升级；不替user新增动作心理决定；保持实体、人称、output_contract。</model_calibration>}}`,
 DeepSeek:`{{setvar::model_family::DeepSeek}}{{setvar::claude::}}{{setvar::gemini::}}{{setvar::model_focus::【DeepSeek】砍动作→解释→总结和复盘腔。}}{{setvar::抑制器::<model_calibration family="DeepSeek">不复述上一段，不把动作接心理解释结论；对白像人物而非分析报告；完成态就落地；不代理user；保持知识边界与output_contract。</model_calibration>}}`,
 Claude:`{{setvar::model_family::Claude}}{{setvar::gemini::}}{{setvar::claude:: - 规划只保留必要结论，直接写正文。}}{{setvar::model_focus::【Claude】别把人物自动理性化、体面化、治疗化。}}{{setvar::抑制器::<model_calibration family="Claude">人物优先于成熟沟通；冲突可停在回避、失言、沉默或搁置；不急着道歉、共识、疗愈、边界声明或关系修复；不解释潜台词；不代理user。</model_calibration>}}`,
 GPT:`{{setvar::model_family::GPT}}{{setvar::claude::}}{{setvar::gemini::}}{{setvar::model_focus::【GPT】挡助手腔、报告腔和整齐闭环。}}{{setvar::抑制器::<model_calibration family="GPT">content只写故事；不把交流一轮讲清/关系说透/矛盾闭环；角色不自动更成熟善沟通；不段末总结；不代理user；事实因果优先于漂亮结构。</model_calibration>}}`,
};

async function loadPack(){
 const dir=path.join(ROOT,'fixtures/preset-benchmark');
 const names=(await fs.readdir(dir)).filter(n=>/^prompts\.part\d+\.b64$/.test(n)).sort();
 let b64=''; for(const n of names)b64+=(await fs.readFile(path.join(dir,n),'utf8')).trim();
 const pack=JSON.parse(zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
 pack.sequence=pack.sequence.filter(x=>x.name!=='⚠️丨扩写+加强复述');
 const idx=Math.max(0,pack.sequence.findIndex(x=>x.name==='🔧丨玲七轻量思考'));
 pack.sequence.splice(idx,0,
  {name:'⚠️丨防复述',role:'system',content:antiRepeat},
  {name:'🤔丨反抢话',role:'system',content:antiHijack},
  {name:'🤔丨User去中心化',role:'system',content:decenter});
 const ui=pack.sequence.find(x=>x.name==='🔒丨User_Input');
 if(ui&&!ui.content.includes('{{getvar::agency_contract}}')) ui.content=ui.content.replace('{{getvar::push_rule}}','{{getvar::push_rule}}\n{{getvar::agency_contract}}');
 for(const [fam,content] of Object.entries(adapterPatch)) if(pack.adapters[fam])pack.adapters[fam].content=content;
 return pack;
}
async function postJson(url,body,timeoutMs=180000){const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),timeoutMs);try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});const text=await res.text();let data;try{data=JSON.parse(text)}catch{data={raw:text}}return{status:res.status,ok:res.ok,data}}finally{clearTimeout(timer)}}
function stripMacroComments(t){return String(t??'').replace(/\{\{\/[\s\S]*?\}\}/g,'')}
function expand(t,vars,scen){t=stripMacroComments(t);for(let i=0;i<16;i++){const old=t;t=t.replace(/\{\{getvar::([^{}]+?)\}\}/g,(_,n)=>vars[n.trim()]??'').replace(/\{\{setvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=v,'')).replace(/\{\{addvar::([^:{}]+?)::([\s\S]*?)\}\}/g,(_,n,v)=>(vars[n.trim()]=(vars[n.trim()]??'')+v,'')).replace(/\{\{trim\}\}/g,'').replace(/\{\{random::([^{}]*?)\}\}/g,(_,v)=>String(v).split('::')[0]??'').replaceAll('{{lastUserMessage}}',scen.history.filter(x=>x.role==='user').at(-1)?.content??'').replaceAll('{{user}}',scen.user_name).replaceAll('{{char}}',scen.char_name).replaceAll('{{persona}}',`用户角色${scen.user_name}由用户控制，不替其新增台词、决定、意图或未明确动作。`).replaceAll('{{description}}',scen.setup).replaceAll('{{personality}}','').replaceAll('{{scenario}}','');if(t===old)break}return t.trim()}
function marker(item,scen){if(item.content!==null&&item.content!==undefined)return null;switch(item.name){case'👤丨用户角色描述':return[{role:'system',content:`用户角色：${scen.user_name}。该角色由用户控制。`}];case'⚫丨角色描述':return[{role:'system',content:scen.setup}];case'Chat History':return scen.history.map(x=>({role:x.role,content:x.content}));default:return[]}}
function build(pack,fam,on,scen){const vars={},messages=[];for(const slot of pack.sequence){let item=slot;if(slot.adapter){if(!on)continue;item=pack.adapters[fam];}const m=marker(item,scen);if(m!==null){messages.push(...m);continue}const c=expand(item.content,vars,scen);if(c)messages.push({role:item.role||'system',content:c})}return messages}
async function setSecret(name){const p=providers[name];const r=await postJson(`${BASE}/api/secrets/write`,{key:'api_key_custom',value:p.key,label:`lab-v2-${name}`},30000);if(!r.ok)throw new Error(`secret ${name} HTTP ${r.status}`)}
function textOf(d){return d?.choices?.[0]?.message?.content??d?.choices?.[0]?.text??d?.output_text??''}
async function generate(provider,model,messages){const p=providers[provider],started=Date.now();const r=await postJson(`${BASE}/api/backends/chat-completions/generate`,{chat_completion_source:'custom',custom_url:p.url,model,messages,temperature:.82,top_p:.95,max_tokens:1200,stream:false},180000);return{http_status:r.status,http_ok:r.ok,elapsed_ms:Date.now()-started,text:textOf(r.data),upstream_error:r.data?.error??null,raw_shape:Object.keys(r.data||{})}}
function signals(text,scen){const t=String(text||'');return{chars:t.length,user_proxy_hint:new RegExp(`${scen.user_name}(?:说|问|答|笑|点|摇|起|走|伸|拿|放|端|喝|抬|低|转|看|想|觉得|呼吸|手|脚|摸|靠|站|坐)`).test(t),assistant_tone_hint:/(首先|其次|总结来说|作为AI|作为助手|建议你|以下是|综上)/.test(t),forced_twist_hint:/(突然|猛地|就在这时|警报|爆炸|袭击|追兵|陌生人闯|电话骤然)/.test(t),secret_public_hint:scen.id==='ensemble_knowledge'&&/(黑布包|布包)/.test(t),new_omen_hint:scen.id==='horror_causality'&&/(血迹|红色印记|暗红|婴儿哭声|新的哭声)/.test(t)}}

await fs.mkdir(EVIDENCE,{recursive:true});
const pack=await loadPack();const sd=JSON.parse(await fs.readFile(path.join(ROOT,'fixtures/preset-benchmark/scenarios.json'),'utf8'));const sm=Object.fromEntries(sd.scenarios.map(s=>[s.id,s]));
const results=[];let current=null,last=0;
for(const test of tests){const p=providers[test.provider];if(!p.key){results.push({...test,status:'skipped_missing_secret'});continue}if(current!==test.provider){if(current)await sleep(5000);await setSecret(test.provider);current=test.provider}for(const on of[false,true]){const wait=p.delayMs-(Date.now()-last);if(last&&wait>0)await sleep(wait);const scen=sm[test.scenario],messages=build(pack,test.family,on,scen);const rec={...test,adapter_on:on,prompt_messages:messages.length,prompt_chars:messages.reduce((a,m)=>a+m.content.length,0)};try{const gen=await generate(test.provider,test.model,messages);Object.assign(rec,gen,{signals:signals(gen.text,scen),status:gen.text?'ok':'no_text'})}catch(e){rec.status='exception';rec.error=`${e.name}: ${e.message}`}last=Date.now();results.push(rec);console.log(`${rec.family} ${rec.scenario} ${on?'ON':'OFF'} ${rec.status} chars=${rec.text?.length||0} ms=${rec.elapsed_ms||0}`)}}
const report={schema:2,generated_at:new Date().toISOString(),routing:'real SillyTavern /api/backends/chat-completions/generate -> provider /v1/chat/completions',frequency_policy:'YOUZI 1.8s min; GG/PIAOMIAO 28s min; all serial',patch:'v2 common agency/decenter + revised model adapters',tests:results};
await fs.writeFile(path.join(EVIDENCE,'preset-model-benchmark-v2.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(EVIDENCE,'preset-model-benchmark-v2-summary.txt'),results.map(r=>`${r.family}\t${r.provider}\t${r.model}\t${r.scenario}\tadapter=${r.adapter_on}\t${r.status}\tchars=${r.text?.length||0}\tms=${r.elapsed_ms||0}`).join('\n')+'\n');
