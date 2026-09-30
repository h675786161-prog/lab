import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const out=path.join(root,'morning-split-evidence');
await fs.mkdir(out,{recursive:true});
const card=JSON.parse(await fs.readFile(path.join(root,'.lab/fixtures/qidu-harbor-v0440/card.json'),'utf8'));
const entries=card.data.character_book.entries;
const relevant=entries.filter(e=>e.constant||[4,11,12,13,37,40,41,42,43,48,49,64,70,91,92,93].includes(e.id));
const system=[card.data.system_prompt,card.data.personality,card.data.scenario,...relevant.map(e=>e.content),card.data.post_history_instructions,card.data.extensions?.depth_prompt?.prompt].filter(Boolean).join('\n\n');
const initial=JSON.parse(entries.find(e=>e.id===92).content);

const results=[];
const updateErrors=[];
function seed(day,intel){const q=structuredClone(initial);q.day=day;q.clock_minutes=480;q.location='中央庭';q.cores.court='purified';q.regions.school.liberated=true;q.regions.east.liberated=true;q.hiro.intel=intel;q.tasks.DAY7_OPENING.status='completed';q.known=['安','安托涅瓦','晏华','希罗','珈儿','雯梓','钟函谷','赛哈姆'];q.intel_flags.hiro_founder_known=true;q.intel_flags.hiro_prior_commander_known=true;if(day<6){q.morning_flags.day6_monologue=true;q.morning_flags.day6_saiham=true;q.intel_flags.chimera_exists_known=true;}return q;}
function clean(s){return s.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,'').replace(/<f7d_choices>[\s\S]*?<\/f7d_choices>/gi,'').replace(/<branches>[\s\S]*?<\/branches>/gi,'').trim()}
function getPath(o,p){return p.replace(/^stat_data\./,'').split('.').reduce((v,k)=>v?.[k],o)}
function setPath(o,p,v){const keys=p.replace(/^stat_data\./,'').split('.');if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))throw Error('invalid path');let t=o;for(const k of keys.slice(0,-1)){if(!t[k]||typeof t[k]!=='object')throw Error('missing path '+p);t=t[k]}const k=keys.at(-1);if(!(k in t))throw Error('unknown path '+p);if(typeof t[k]!==typeof v||Array.isArray(t[k])!==Array.isArray(v))throw Error('type mismatch '+p);if(p.startsWith('cores.')&&!['unknown','available','purified','lost'].includes(v))throw Error('invalid core enum');t[k]=v;}
function update(state,raw){const code=raw.match(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i)?.[1];if(!code){updateErrors.push({turn:results.length,error:'missing update block'});return}const draft=structuredClone(state);try{vm.runInNewContext(code,{_:{get:p=>getPath(draft,p),set:(p,...args)=>{if(args.length===2&&JSON.stringify(getPath(draft,p))!==JSON.stringify(args[0]))throw Error('old value mismatch '+p);setPath(draft,p,args.at(-1))}}},{timeout:100,contextCodeGeneration:{strings:false,wasm:false}});Object.assign(state,draft)}catch(e){updateErrors.push({turn:results.length,error:String(e),code})}}
const groups=[
 {name:'day6-morning',day:6,intel:0,actions:['上一日已经结束。现在是第六天醒前，请继续当前固定剧情直到给我回应机会。','我拒绝替希罗保密，问他赛哈姆究竟发生了什么，随后让安陪我去向安托涅瓦报告亲眼见到的事。请继续固定事件对话。']},
 {name:'split-intel4',day:5,intel:4,actions:['现在是第五天醒前，请继续晨间固定剧情与中央庭会议，让希罗把分歧和邀请说完，停在需要我回应处。','我拒绝转投希罗，留在中央庭。请继续眼前的分裂事件，直到希罗离开与安托涅瓦病情变化实际发生。','现在进入独立的第四天清晨检查点：此前日程已经结束，请演出本日晨间固定事件，并按当前已有的有效情报结算港湾区后果。我只听汇报，不采取普通行动。']},
 {name:'split-intel3',day:5,intel:3,actions:['现在是第五天醒前，请继续晨间固定剧情与中央庭会议，让希罗把分歧和邀请说完，停在需要我回应处。','我拒绝转投希罗，留在中央庭。请继续眼前的分裂事件，直到希罗离开与安托涅瓦病情变化实际发生。','现在进入独立的第四天清晨检查点：此前日程已经结束，请演出本日晨间固定事件，并按当前已有的有效情报结算港湾区后果。我只听汇报，不采取普通行动。']}
];
for(const group of groups){let state=seed(group.day,group.intel);let messages=[{role:'system',content:system}];for(let i=0;i<group.actions.length;i++){if(i===2){state.day=4;state.clock_minutes=480;state.morning_flags.day5_monologue=true;state.morning_flags.day5_split=true;messages=[{role:'system',content:system}];}const before=structuredClone(state);messages.push({role:'user',content:'<status_current_variable>'+JSON.stringify(state)+'</status_current_variable>\n'+group.actions[i]});const response=await fetch(process.env.MODEL_API_BASE.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.MODEL_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.RELEASE_MODEL,temperature:0.35,max_tokens:5500,messages})});const body=await response.text();if(!response.ok)throw Error(response.status+' '+body.slice(0,200));const data=JSON.parse(body);const raw=data.choices?.[0]?.message?.content||'';results.push({turn:results.length+1,group:group.name,groupTurn:i+1,prompt:group.actions[i],raw,visible:clean(raw),stateBefore:before});update(state,raw);results.at(-1).stateAfter=structuredClone(state);messages.push({role:'assistant',content:raw});await fs.writeFile(path.join(out,'model-story.json'),JSON.stringify({model:process.env.RELEASE_MODEL,cardVersion:card.data.character_version,results,updateErrors},null,2));}}
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
    await page.waitForTimeout(250);await page.evaluate(()=>{const n=document.querySelector('#chat .mes');if(n){n.style.maxHeight='none';n.style.height='auto';n.style.overflow='visible';for(const q of n.querySelectorAll('*')){q.style.maxHeight='none';q.style.overflow='visible'}}});await page.locator('#chat .mes').last().screenshot({path:path.join(out,`morning-split-${String(i+1).padStart(2,'0')}.jpg`),type:'jpeg',quality:86,animations:'disabled'});
  }
  await fs.writeFile(path.join(out,'render-check.json'),JSON.stringify({imported:true,rendered:results.filter(x=>x.raw).length},null,2));
}finally{await browser.close()}
