import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'harbor-evidence');
await fs.mkdir(out,{recursive:true});
const card=JSON.parse(await fs.readFile(path.join(root,'.lab/fixtures/qidu-seaside-v0439/card.json'),'utf8'));
const entries=card.data.character_book.entries;
const relevant=entries.filter(e=>e.constant||[4,11,12,13,14,36,37,59,60,91,92,93].includes(e.id));
const system=[card.data.system_prompt,card.data.personality,card.data.scenario,...relevant.map(e=>e.content),card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');
const initial=JSON.parse(entries.find(e=>e.id===92).content);
const state=structuredClone(initial);
state.day=4;state.clock_minutes=480;state.location='中央庭';state.route='central';
state.regions.school.liberated=true;state.regions.east.liberated=true;state.regions.central.liberated=true;state.regions.institute.liberated=true;
state.regions.harbor.liberated=false;
state.cores.court='purified';state.cores.school='purified';state.cores.harbor='unknown';
state.hiro.intel=4;state.hiro.handled=['DAY4_HARBOR'];
for(const k of ['day6_monologue','day6_saiham','day6_seth','day5_monologue','day5_split','day4_monologue','day4_speech'])state.morning_flags[k]=true;
state.known=['安','安托涅瓦','晏华','珈儿','希罗','雯梓','赛斯','羽弥'];
const messages=[{role:'system',content:system}];
const actions=[
  '第4天晨间固定剧情已结束。安和我从中央庭前往港湾区，先在工业码头确认失联工人、撤离道路与目击线索。按人物和区域因果推进，不输出节点说明。',
  '我先协助工人撤离，向现场的神器使和目击者询问封锁区内发生了什么，记录可核查的线索。',
  '我与安沿安全通道调查船坞和仓储设施，确认异常的来源，遭遇危险则先救人。',
  '我们沿着现场留下的证据调查机械蜘蛛、装置与海面的异常，寻找仍被困的人。',
  '我把收集的线索与中央庭情报核对，再深入可能有召唤设施的区域；只依据实际证据判断利维坦是否出现。',
  '继续处理港湾区的眼前危机，和在场的人协调行动。遇到新的神器使时让她自然登场并交谈。',
  '我带队处理召唤设施及利维坦造成的危险，尽量保护港口人员，按实际经过结算区域结果。',
  '区域危机平息后，我确认海底黑核的线索与到达条件，联络中央庭核实研究所潜艇资料，不跳过建造或深海潜入。'
];
function setPath(obj,p,v){let q=p.replace(/^stat_data\./,'').split('.');let x=obj;for(let i=0;i<q.length-1;i++){if(x[q[i]]==null)x[q[i]]={};x=x[q[i]]}x[q.at(-1)]=v}
const updateErrors=[];
function applyUpdates(raw){
 const block=raw.match(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i)?.[1]||'';
 for(const line of block.split('\n')){
  const m=line.match(/^\s*_\.set\(\s*(['"])(.*?)\1\s*,\s*(.*?)\)\s*;?/);
  if(!m)continue;
  const parts=m[3].split(/,(?=\s*(?:[\[{"'\d-]|true|false|null))/);
  let value;
  try{value=JSON.parse((parts.length>1?parts.at(-1):parts[0]).trim().replace(/'/g,'"'))}catch(e){updateErrors.push({path:m[2],line,error:String(e)});continue}
  setPath(state,m[2],value);
 }
}
function clean(s){return s.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,'').replace(/<f7d_choices>[\s\S]*?<\/f7d_choices>/gi,'').replace(/<branches>[\s\S]*?<\/branches>/gi,'').trim()}
const cached=path.join(root,'.lab/fixtures/qidu-harbor-v0439/cached-story.json');
const cache=await fs.readFile(cached,'utf8').then(JSON.parse).catch(()=>null);
const results=cache?.results??[];
if(!cache){
for(let i=0;i<actions.length;i++){
  const prompt=`<status_current_variable>${JSON.stringify(state)}</status_current_variable>\n${actions[i]}`;
  messages.push({role:'user',content:prompt});
  let response=null,error='';
  for(let attempt=0;attempt<3;attempt++){
    try{const r=await fetch(`${process.env.MODEL_API_BASE.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${process.env.MODEL_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.RELEASE_MODEL,temperature:0.45,max_tokens:4500,messages})});const body=await r.text();if(!r.ok)throw Error(`${r.status} ${body.slice(0,250)}`);response=JSON.parse(body);break}catch(e){error=String(e);await new Promise(r=>setTimeout(r,5000))}
  }
  if(!response){results.push({turn:i+1,prompt:actions[i],error});break}
  const c=response.choices?.[0]?.message?.content;
  const raw=Array.isArray(c)?c.map(v=>v.text||v.content||'').join(''):String(c||'');
  results.push({turn:i+1,prompt:actions[i],raw,visible:clean(raw),stateBefore:JSON.parse(prompt.match(/<status_current_variable>(.*?)<\/status_current_variable>/s)[1])});
  messages.push({role:'assistant',content:raw});applyUpdates(raw);
  
  await new Promise(r=>setTimeout(r,7000));
}
}
await fs.writeFile(path.join(out,'model-story.json'),JSON.stringify({model:process.env.RELEASE_MODEL,provider:process.env.BEHAVIOR_PROVIDER_SELECTED,cardVersion:card.data.character_version,results,finalState:state,updateErrors},null,2));
const form=new FormData();form.set('file_type','json');form.set('avatar',new Blob([JSON.stringify(card)],{type:'application/json'}),'qidu-v0439.json');
const imported=await fetch('http://127.0.0.1:8000/api/characters/import',{method:'POST',body:form});if(!imported.ok)throw Error(`ST import ${imported.status}: ${(await imported.text()).slice(0,250)}`);
const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
try{const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(2200);
  await page.evaluate(()=>{const save=[...document.querySelectorAll('button,.menu_button,[role="button"]')].find(x=>/^(?:Save|保存)$/i.test(x.textContent.trim()));save?.click();for(const d of document.querySelectorAll('dialog[open]'))try{d.close()}catch{}});
  await page.waitForTimeout(600);
  await page.evaluate(()=>{for(const el of document.querySelectorAll('dialog,.popup,.modal,[role="dialog"]')){if(/Welcome to SillyTavern|Your Persona|Persona Name/.test(el.textContent||''))el.remove()}});
  await page.evaluate(async({name,version})=>{const st=await import('/script.js');await st.getCharacters();const i=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version);if(i>=0)st.setCharacterId(i);},{name:card.data.name,version:card.data.character_version});
  for(let i=0;i<results.length;i++){
    if(!results[i].raw)continue;
    await page.evaluate(async({raw,n})=>{const st=await import('/script.js');const ctx=window.SillyTavern?.getContext();if(!ctx)return;document.querySelector('#chat')?.replaceChildren();const id=ctx.chat.length;ctx.chat.push({name:'七都',is_user:false,is_system:false,mes:raw});const node=document.createElement('div');node.className='mes';node.setAttribute('mesid',String(id));node.style.cssText='width:370px;min-height:100px;padding:16px;background:#252525;color:#e8e8e8';const body=document.createElement('div');body.className='mes_text';body.innerHTML=st.messageFormatting(raw,'七都',false,false,id,{},false);node.append(body);document.querySelector('#chat')?.append(node);},{raw:results[i].raw,n:i});
    await page.waitForTimeout(250);await page.locator('#chat .mes').last().screenshot({path:path.join(out,`harbor-${String(i+1).padStart(2,'0')}.png`),animations:'disabled'});
  }
  await fs.writeFile(path.join(out,'render-check.json'),JSON.stringify({imported:true,rendered:results.filter(x=>x.raw).length},null,2));
}finally{await browser.close()}
