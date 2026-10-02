
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const out='.lab/fixtures/qidu-day-gate/live';
await fs.mkdir(out,{recursive:true});
const card=JSON.parse(await fs.readFile('.lab/fixtures/qidu-day-gate/Qidu-v0.4.42-day-gate.json','utf8'));
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/https:\/\/gcore\.jsdelivr\.net\/gh\/MagicalAstrogy\/MagVarUpdate@[^']+/, '/f7d-mvu.js');
const init=JSON.parse(card.data.character_book.entries.find(e=>e.comment.includes('[InitVar]')).content);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1080,height:1400}});
page.setDefaultTimeout(30000);
const rounds=[],requests=[],errors=[];
page.on('pageerror',e=>errors.push(e.message.slice(0,500)));
page.on('request',r=>{if(r.url().endsWith('/api/backends/chat-completions/generate')){try{const d=r.postDataJSON();requests.push({model:d.model,source:d.chat_completion_source,message_count:d.messages?.length,chars:JSON.stringify(d.messages).length,messages:d.messages});void fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));}catch{}}});
let failure;
const checkpoint=async phase=>fs.writeFile(out+'/checkpoint.json',JSON.stringify({phase,rounds:rounds.length,requests:requests.map(r=>({model:r.model,chars:r.chars})),errors},null,2));
const limit=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error(label+' timeout')),ms);t.unref();})]);
const evalNative=page.evaluate.bind(page);page.evaluate=(...args)=>limit(evalNative(...args),60000,'native page operation');
try{
 await checkpoint('opening native ST');await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.TavernHelper);
 if(await page.locator('dialog:visible .popup-button-ok').count())await page.locator('dialog:visible .popup-button-ok').last().click();
 await checkpoint('importing card');const imported=await page.evaluate(async c=>{const csrf=await(await fetch('/csrf-token')).json();const fd=new FormData();fd.set('file_type','json');fd.set('avatar',new File([JSON.stringify(c)],'qidu-live.json',{type:'application/json'}));const r=await fetch('/api/characters/import',{method:'POST',headers:{'X-CSRF-Token':csrf.token},body:fd});if(!r.ok)throw Error('card import '+r.status);return r.json();},card);
 await page.evaluate(async version=>{const st=await import('/script.js');await st.getCharacters();const id=st.characters.findIndex(c=>c.data?.character_version===version);if(id<0)throw Error('missing imported card');st.setCharacterId(id);st.setCharacterName(st.characters[id].name);const pu=await import('/scripts/power-user.js');pu.power_user.world_import_dialog=false;const wi=await import('/scripts/world-info.js');$('#import_character_info').data('chid',id);await wi.importEmbeddedWorldInfo(true);},card.data.character_version);
 await checkpoint('native lorebook imported');await page.locator('#API-status-top').click();await page.locator('#main_api').selectOption('openai');await page.locator('#chat_completion_source').selectOption('custom');
 await page.evaluate(async()=>{const st=await import('/script.js'),o=await import('/scripts/openai.js');Object.assign(o.oai_settings,{chat_completion_source:'custom',custom_url:'https://gcli.ggchan.dev/v1',custom_model:'gemini-3-flash-preview',stream_openai:false,openai_max_context:65000,openai_max_tokens:4096,custom_exclude_body:'[presence_penalty, frequency_penalty, top_p, top_k, temperature]',reverse_proxy:'',proxy_password:''});st.setOnlineStatus('Connected');});
 await page.locator('#API-status-top').click();
 await page.evaluate(scripts=>{TavernHelper.replaceScriptTrees([],{type:'character'});TavernHelper.replaceScriptTrees(scripts,{type:'global'});},card.data.extensions.tavern_helper.scripts);
 await checkpoint('waiting real scripts');await page.waitForFunction(()=>window.Mvu&&window.f7dDayGate&&window.f7dTacticalTerminal,{timeout:90000});
 await page.evaluate(()=>{const c=SillyTavern.getContext();window.__gates=[];c.eventSource.on(c.eventTypes.WORLDINFO_ENTRIES_LOADED,p=>{__gates.push(Object.fromEntries(['globalLore','characterLore','chatLore','personaLore'].map(k=>[k,(p[k]||[]).filter(e=>String(e.comment).includes('F7D_GATE')).map(e=>({id:e.uid,comment:e.comment}))])));});});
 const cases=[
 {id:'day6',day:6,intel:0,scene:'第七天已完成高校救援和东方古街解放。你昨夜回中央庭休息，现在尚未醒来。',inputs:['继续到我醒来，遇到需要我回应时停下。','我先观察异常并和安一同阻挡，不贸然接近。','我问希罗这到底是什么，赛哈姆怎么了？','我不答应替你保密。先看着你带走她，之后我要把亲眼所见告诉安托涅瓦。']},
 {id:'split-intel4',day:5,intel:4,scene:'第六天已经结束。希罗昨日已带走赛哈姆，你亲眼见到并把事情告诉了安托涅瓦。你已获得四份互不重复的有效希罗情报，晏华知道这些材料。现在是次日清晨，尚未醒来。',inputs:['继续到我醒来，遇到需要我回应时停下。','我随安来到会议室，先听他们说。','我拒绝希罗的邀请，留在中央庭。请承接眼前的现场。']},
 {id:'split-intel0',day:5,intel:0,scene:'第六天已经结束。希罗昨日已带走赛哈姆，你亲眼见到但并未得到可用于判断他下一步的有效材料。现在是次日清晨，尚未醒来。',inputs:['继续到我醒来，遇到需要我回应时停下。','我随安来到会议室，先听他们说。','我拒绝希罗的邀请，留在中央庭。请承接眼前的现场。']}
 ];
 await checkpoint('scripts ready');for(const scene of cases){
  await checkpoint('seed '+scene.id);
  const state=structuredClone(init);Object.assign(state,{day:scene.day,clock_minutes:480,location:'中央庭寝室',known:['安','安托涅瓦','晏华','希罗','珈儿','泰丝拉','赛哈姆']});state.regions.school.liberated=true;state.regions.east.liberated=true;state.cores.court='purified';state.hiro.intel=scene.intel;state.route_flags.first_second_region='east';state.tasks.DAY7_OPENING.status='completed';state.morning_flags.day6_monologue=scene.day<6;state.morning_flags.day6_saiham=scene.day<6;state.intel_flags.chimera_exists_known=scene.day<6;state.intel_flags.hiro_chimera_research_known=scene.day<6;
  await page.evaluate(async({state,scene})=>{const st=await import('/script.js');await st.clearChat();st.chat.splice(0,st.chat.length,{name:st.name2,is_user:false,is_system:false,mes:scene,swipe_id:0,variables:{0:{stat_data:state}}});await st.printMessages();const frame=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow?.__f7dCommitHook)?.contentWindow;if(!frame)throw Error('missing real MVU iframe');await frame.replaceVariables({stat_data:state},{type:'message',message_id:0});await st.eventSource.emit(st.event_types?.CHAT_CHANGED||'chat_id_changed',st.getCurrentChatId?.());}, {state,scene:scene.scene});
  for(let i=0;i<scene.inputs.length;i++){
   const before=await page.evaluate(()=>{const c=SillyTavern.getContext();return Mvu.getMvuData({type:'message',message_id:c.chat.length-1}).stat_data;});
   const start=requests.length;
   await page.locator('#send_textarea').fill(scene.inputs[i]);
   await checkpoint('generating '+scene.id+' '+(i+1));
   await limit(page.evaluate(async()=>{const st=await import('/script.js');st.setOnlineStatus('Connected');await st.Generate('normal');}),180000,'native generation '+scene.id+' '+(i+1));
   await page.waitForTimeout(2000);
   const data=await page.evaluate(()=>{const c=SillyTavern.getContext();const n=c.chat.length-1;return {text:c.chat[n]?.mes,is_user:c.chat[n]?.is_user,variables:Mvu.getMvuData({type:'message',message_id:n}),gates:window.__gates.at(-1),terminal:window.f7dTacticalTerminal?.getSnapshot?.()};});
   if(requests.length===start)throw Error('No native model request was sent');
   if(data.is_user||!data.text)throw Error('no native assistant reply');
   rounds.push({case:scene.id,round:i+1,user:scene.inputs[i],before,after:data.variables?.stat_data,text:data.text,gates:data.gates,terminal:data.terminal,requests:requests.slice(start).map(r=>({model:r.model,source:r.source,message_count:r.message_count,chars:r.chars}))});
   await page.screenshot({path:out+'/'+scene.id+'-'+(i+1)+'.jpg',type:'jpeg',quality:90,fullPage:true});
   await checkpoint('completed '+scene.id+' '+(i+1));
   await fs.writeFile(out+'/native-live.json',JSON.stringify({model:'gemini-3-flash-preview',rounds,errors},null,2));
   await fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));
  }
 }
}catch(e){failure={message:e.message,stack:e.stack};await checkpoint('blocked: '+e.message);await page.screenshot({path:out+'/blocked.jpg',type:'jpeg',quality:90}).catch(()=>{});}
await fs.writeFile(out+'/native-live.json',JSON.stringify({model:'gemini-3-flash-preview',native:true,rounds,errors,failure},null,2));
await fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));
await browser.close();
if(failure)throw Error(failure.message);
