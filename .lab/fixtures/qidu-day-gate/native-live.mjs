
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const out='.lab/fixtures/qidu-day-gate/live';
await fs.mkdir(out,{recursive:true});
const card=JSON.parse(await fs.readFile('.lab/fixtures/qidu-day-gate/Qidu-v0.4.47-node2-day6-live-fix.json','utf8'));
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/https:\/\/gcore\.jsdelivr\.net\/gh\/MagicalAstrogy\/MagVarUpdate@[^']+/, '/f7d-mvu.js');
for(const script of card.data.extensions.tavern_helper.scripts)if(script.content.includes("host[KEY]={version:1,allow,dispose}"))script.content=script.content.replace("host[KEY]={version:1,allow,dispose}","host[KEY]={version:1,allow,dispose,state}");
const init=JSON.parse(card.data.character_book.entries.find(e=>e.comment.includes('[InitVar]')).content);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1080,height:2500}});
page.setDefaultTimeout(30000);
const rounds=[],requests=[],apiResponses=[],errors=[];const testedRevision='node2-day6-3f-v047-natural';
page.on('pageerror',e=>errors.push(e.message.slice(0,500)));const runtimeLog=[];page.on('console',m=>{const t=m.text();if(/Set '|七都|变量|mag_|过期|MVU|script error/i.test(t))runtimeLog.push(t.slice(0,2000));});
page.on('request',r=>{if(r.url().endsWith('/api/backends/chat-completions/generate')){try{const d=r.postDataJSON();requests.push({model:d.model,source:d.chat_completion_source,message_count:d.messages?.length,chars:JSON.stringify(d.messages).length,messages:d.messages});void fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));}catch{}}});
page.on('response',async r=>{if(r.url().endsWith('/api/backends/chat-completions/generate')){let body='';try{body=(await r.text()).slice(0,4000);}catch{}apiResponses.push({status:r.status(),body});void fs.writeFile(out+'/native-api-responses.json',JSON.stringify(apiResponses,null,2));}});
let failure;const pending=new Set();page.on('request',r=>{if(r.url().endsWith('/api/backends/chat-completions/generate'))pending.add(r);});for(const event of ['requestfinished','requestfailed'])page.on(event,r=>pending.delete(r));const waitIdle=async()=>{const deadline=Date.now()+180000;while(pending.size){if(Date.now()>deadline)throw Error('native background requests timeout');await page.waitForTimeout(500);}await page.waitForTimeout(1000);};
let lastPhase;const checkpoint=async phase=>{lastPhase=phase;return fs.writeFile(out+'/checkpoint.json',JSON.stringify({phase,rounds:rounds.length,requests:requests.map(r=>({model:r.model,chars:r.chars})),apiResponses,errors},null,2));};
const limit=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error(label+' timeout')),ms);t.unref();})]);
const evalNative=page.evaluate.bind(page);page.evaluate=(...args)=>limit(evalNative(...args),60000,'native page operation');
try{
 await checkpoint('opening native ST');await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.TavernHelper);
 if(await page.locator('dialog:visible .popup-button-ok').count())await page.locator('dialog:visible .popup-button-ok').last().click();
 await checkpoint('importing card');const imported=await page.evaluate(async c=>{const csrf=await(await fetch('/csrf-token')).json();const fd=new FormData();fd.set('file_type','json');fd.set('avatar',new File([JSON.stringify(c)],'qidu-live.json',{type:'application/json'}));const r=await fetch('/api/characters/import',{method:'POST',headers:{'X-CSRF-Token':csrf.token},body:fd});if(!r.ok)throw Error('card import '+r.status);return r.json();},card);
 await page.evaluate(async version=>{const st=await import('/script.js');await st.getCharacters();const id=st.characters.findIndex(c=>c.data?.character_version===version);if(id<0)throw Error('missing imported card');st.setCharacterId(id);st.setCharacterName(st.characters[id].name);const regex=await import('/scripts/extensions/regex/engine.js');regex.allowScopedScripts(st.characters[id]);const pu=await import('/scripts/power-user.js');pu.power_user.world_import_dialog=false;const wi=await import('/scripts/world-info.js');$('#import_character_info').data('chid',id);await wi.importEmbeddedWorldInfo(true);},card.data.character_version);
 await checkpoint('native lorebook imported');
 if(await page.getByRole('button',{name:'收好纸条',exact:true}).isVisible())await page.getByRole('button',{name:'收好纸条',exact:true}).click();
 await page.locator('#API-status-top').click();await page.locator('#main_api').selectOption('openai');await page.locator('#chat_completion_source').selectOption('custom');
 await page.evaluate(async()=>{const st=await import('/script.js'),o=await import('/scripts/openai.js');Object.assign(o.oai_settings,{chat_completion_source:'custom',custom_url:'https://gcli.ggchan.dev/v1',custom_model:'gemini-3-flash-preview',stream_openai:false,openai_max_context:65000,openai_max_tokens:4096,custom_exclude_body:'[presence_penalty, frequency_penalty, top_p, top_k, temperature]',reverse_proxy:'',proxy_password:''});st.setOnlineStatus('Connected');});
 await page.locator('#API-status-top').click();
 await page.evaluate(scripts=>{TavernHelper.replaceScriptTrees([],{type:'character'});TavernHelper.replaceScriptTrees(scripts,{type:'global'});},card.data.extensions.tavern_helper.scripts);
 await checkpoint('waiting real scripts');await page.waitForFunction(()=>window.Mvu&&window.f7dDayGate&&window.f7dTacticalTerminal,{timeout:90000});
 await page.evaluate(()=>{const c=SillyTavern.getContext();c.extensionSettings.world_backstage.worldAutoEnabled=false;c.extensionSettings.world_backstage.publicOpinionAutoEnabled=false;window.__commitDiagnostics=[];const b=window.__f7dCommitBridge,valid=b.valid;b.valid=t=>{const ok=valid(t);if(!ok){const now=b.capture();__commitDiagnostics.push({epochMatch:t?.epoch===now.epoch,chatMatch:t?.chatId===now.chatId,signatureMatch:t?.signature===now.signature,oldSignature:t?.signature,newSignature:now.signature});}return ok;};window.__gates=[];c.eventSource.on(c.eventTypes.WORLDINFO_ENTRIES_LOADED,p=>{__gates.push(Object.fromEntries(['globalLore','characterLore','chatLore','personaLore'].map(k=>[k,(p[k]||[]).filter(e=>String(e.comment).includes('F7D_GATE')).map(e=>({id:e.uid,comment:e.comment}))])));});});
 const cases=[
 {id:'day6',day:6,intel:0,scene:'第七天已完成高校救援和东方古街解放。你昨夜回中央庭休息，现在尚未醒来。',inputs:['继续到我醒来，遇到需要我回应时停下。','我先观察异常并和安一同阻挡，不贸然接近。','我还没答应，先解释清楚什么叫活骸化，还有你为什么要把她带走。','我不答应替你保密，但赛哈姆现在需要救治。你可以带她离开中央庭去研究所；我会把亲眼所见如实告诉安托涅瓦。请先把人安全转移。','此事告一段落后，我和安去中央庭做一轮完整巡查，完成后回来汇报。']},
 {id:'split-intel4',day:5,intel:4,scene:'第六天已经结束。希罗昨日已带走赛哈姆，你亲眼见到并把事情告诉了安托涅瓦。你已获得四份互不重复的有效希罗情报，晏华知道这些材料。现在是次日清晨，尚未醒来。',inputs:['继续到我醒来，遇到需要我回应时停下。','我随安来到会议室，先听他们说。','我拒绝希罗的邀请，留在中央庭。请承接眼前的现场。','晨间的事已结束，我和安去中央庭完成一轮巡查，之后回来汇报。']},
 {id:'split-intel0',day:5,intel:0,scene:'第六天已经结束。希罗昨日已带走赛哈姆，你亲眼见到但并未得到可用于判断他下一步的有效材料。现在是次日清晨，尚未醒来。',inputs:['继续到我醒来，遇到需要我回应时停下。','我随安来到会议室，先听他们说。','我拒绝希罗的邀请，留在中央庭。请承接眼前的现场。','晨间的事已结束，我和安去中央庭完成一轮巡查，之后回来汇报。']}
 ];
 await checkpoint('scripts ready');for(const scene of cases.filter(scene=>scene.id==='day6')){
  await checkpoint('seed '+scene.id);
  const state=structuredClone(init);Object.assign(state,{day:scene.day,clock_minutes:480,location:'中央庭寝室',known:['安','安托涅瓦','晏华','希罗','珈儿','泰丝拉','赛哈姆']});state.regions.school.liberated=true;state.regions.east.liberated=true;state.cores.court='purified';state.hiro.intel=scene.intel;state.route_flags.first_second_region='east';state.tasks.DAY7_OPENING.status='completed';state.morning_flags.day6_monologue=scene.day<6;state.morning_flags.day6_saiham=scene.day<6;state.intel_flags.chimera_exists_known=scene.day<6;state.intel_flags.hiro_chimera_research_known=scene.day<6;
  await page.evaluate(async({state,scene})=>{const st=await import('/script.js');await st.clearChat();st.updateChatMetadata({},true);st.characters[st.this_chid].chat='native-'+state.day+'-'+state.hiro.intel;st.chat.splice(0,st.chat.length,{name:st.name2,is_user:false,is_system:false,mes:scene,swipe_id:0,variables:{0:{stat_data:state}}});await st.printMessages();const frame=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow?.__f7dCommitHook)?.contentWindow;if(!frame)throw Error('missing real MVU iframe');await st.eventSource.emit(st.event_types?.CHAT_CHANGED||'chat_id_changed',st.getCurrentChatId?.());const data=Mvu.getMvuData({type:'message',message_id:0});if(!data.schema)throw Error('MVU did not initialize schema');data.stat_data=state;data.display_data=structuredClone(state);data.delta_data={};await frame.replaceVariables(data,{type:'message',message_id:0});if(Mvu.getMvuData({type:'message',message_id:0}).stat_data.day!==state.day)throw Error('fixture state was not committed');}, {state,scene:scene.scene});
  for(let i=0;i<scene.inputs.length;i++){
   const before=await page.evaluate(()=>{const c=SillyTavern.getContext();return Mvu.getMvuData({type:'message',message_id:c.chat.length-1}).stat_data;});
   const start=requests.length;
   await page.locator('#send_textarea').fill(scene.inputs[i]);
   await checkpoint('generating '+scene.id+' '+(i+1));
   let generated=false,lastGenerationError;
   for(let attempt=1;attempt<=4;attempt++){
     try{
       await limit(evalNative(async()=>{const st=await import('/script.js');st.setOnlineStatus('Connected');await st.Generate('normal');}),180000,'native generation '+scene.id+' '+(i+1)+' attempt '+attempt);
       generated=true;lastGenerationError=null;break;
     }catch(e){
       lastGenerationError=e;
       await page.screenshot({path:out+'/'+scene.id+'-'+(i+1)+'-api-'+attempt+'.jpg',type:'jpeg',quality:80}).catch(()=>{});
       if(attempt===4)break;
       await page.evaluate(input=>{const c=SillyTavern.getContext();const last=c.chat.at(-1);if(last?.is_user&&String(last.mes||'')===input){c.chat.pop();document.querySelector('#chat .mes:last-of-type')?.remove();}},scene.inputs[i]).catch(()=>{});
       await page.locator('#send_textarea').fill(scene.inputs[i]);
       await page.waitForTimeout(15000*attempt);
     }
   }
   if(!generated)throw lastGenerationError;
   await page.waitForTimeout(2000);await waitIdle();
   await page.waitForFunction(()=>{const c=SillyTavern.getContext();return Boolean(Mvu.getMvuData({type:'message',message_id:c.chat.length-1}).stat_data)&&window.f7dTacticalTerminal?.getSnapshot?.().status==='ready';},{timeout:20000}).catch(()=>{});
   const data=await page.evaluate(()=>{const c=SillyTavern.getContext();const n=c.chat.length-1;return {text:c.chat[n]?.mes,is_user:c.chat[n]?.is_user,variables:Mvu.getMvuData({type:'message',message_id:n}),gates:window.__gates.at(-1),allGates:window.__gates,gateState:window.f7dDayGate.state(),book:SillyTavern.getContext().characters[SillyTavern.getContext().characterId]?.data?.extensions?.world,terminal:window.f7dTacticalTerminal?.getSnapshot?.()};});
   await fs.writeFile(out+'/native-round-diagnostic.json',JSON.stringify({case:scene.id,round:i+1,data,diagnostics:await page.evaluate(()=>window.__commitDiagnostics),runtimeLog},null,2));
   if(requests.length===start)throw Error('No native model request was sent');
   if(data.is_user||!data.text)throw Error('no native assistant reply');if(data.variables?.stat_data?.day!==scene.day)throw Error('native MVU did not commit the expected day');if(data.terminal?.status!=='ready')throw Error('terminal is not ready after native MVU commit');
   rounds.push({case:scene.id,round:i+1,user:scene.inputs[i],before,after:data.variables?.stat_data,text:data.text,gates:data.gates,terminal:data.terminal,allGates:data.allGates,gateState:data.gateState,rawVariables:data.variables,commitDiagnostics:await page.evaluate(()=>window.__commitDiagnostics),requests:requests.slice(start).map(r=>({model:r.model,source:r.source,message_count:r.message_count,chars:r.chars}))});
   const after=data.variables?.stat_data;
   if(scene.id==='day6'&&i===0&&after.morning_flags.day6_monologue!==true)throw Error('day6 morning voice narrated but monologue flag did not commit');
   const arrivedMeeting=/(?:你|你们)[^。\n]{0,100}(?:来到|进入|走进|抵达|赶到)[^。\n]{0,60}(?:会议室|议事大厅|议事厅)/.test(data.text);
   if(arrivedMeeting&&after.location==='中央庭寝室')throw Error('prose moved to meeting room but location stayed in bedroom '+scene.id+' round '+(i+1));
   if(scene.id==='day6'&&/(?:唯一的?处置预案|唯一的?处置条例|就地抹除|下场只有被彻底清除|安托涅瓦[^。\n]{0,120}(?:当场)?(?:击毙|处决|抹杀|消灭)|中央庭[^。\n]{0,140}(?:必然|必须|只能|除了)[^。\n]{0,80}(?:击毙|处决|抹杀|消灭)|(?:没有|毫无|别无)[^。\n]{0,60}(?:选择|办法)[^。\n]{0,100}(?:击毙|处决|抹杀|消灭))/.test(data.text))throw Error('invented fixed Central Court chimera execution policy in '+scene.id+' round '+(i+1));
   if(scene.id==='day6'&&/(?:所有神器使|神器使)[^。\n]{0,100}(?:宿命|终局|必然|不得不面对)[^。\n]{0,100}(?:活骸|异化|崩坏)/.test(data.text))throw Error('invented universal active-corpse destiny in '+scene.id+' round '+(i+1));
   if(scene.id.startsWith('split-')&&/(?:赛哈姆|她)[^。\n]{0,90}(?:自己的意志|自愿(?:接受|参与|进行)|主动要求实验)/.test(data.text))throw Error('invented Saiham voluntary experiment fact '+scene.id+' round '+(i+1));
   if(scene.id.startsWith('split-')&&/(?:研究所)?[BCDＢＣＤ][区區][^。\n]{0,80}(?:权限|通讯|协议|记录|切断)/.test(data.text))throw Error('invented precise lab sector record '+scene.id+' round '+(i+1));

   if(scene.id==='day6'){
     const lockedKeys=['regions','cores','tasks','ann','route_flags','hiro','battle_flags','relationships'];
     if(i<=3){
       if(after.clock_minutes!==480)throw Error('morning clock escaped 08:00 before fixed event fully settles round '+(i+1)+': '+after.clock_minutes);
       for(const key of lockedKeys)if(JSON.stringify(after[key])!==JSON.stringify(before[key]))throw Error('morning action state changed early: '+key+' round '+(i+1));
     }
     if(i<3&&after.morning_flags.day6_saiham!==false)throw Error('day6_saiham completed before explicit transfer decision round '+(i+1));
     if(i===2&&after.morning_flags.day6_saiham!==false)throw Error('unresolved “还没答应，先解释清楚” was misread as a decision');
     if(i===3){
       if(after.morning_flags.day6_saiham!==true)throw Error('day6_saiham did not complete after explicit transfer permission; flag='+String(after.morning_flags.day6_saiham)+'; tail='+String(data.text).slice(-1800));
       if(!/(?:赛哈姆[^。\n]{0,220}(?:离开|被带离|移出)[^。\n]{0,80}中央庭|(?:抬着|带着|护送着|押送着)[^。\n]{0,220}赛哈姆[^。\n]{0,220}(?:离开中央庭|走出中央庭)|载着赛哈姆[^。\n]{0,220}(?:离开|驶离)[^。\n]{0,80}中央庭)/.test(data.text))throw Error('explicit transfer permission did not narrate Saiham physically leaving Central Court; tail='+String(data.text).slice(-1800));
     }
     if(i<3&&/(?:抬着|带着|护送着|押送着)[\s\S]{0,240}赛哈姆[\s\S]{0,240}(?:离开中央庭|走出中央庭|脚步声[^。\n]{0,80}(?:消失|远去))/.test(data.text))throw Error('day6 prose crossed unresolved secrecy boundary');
   }
   if(scene.id.startsWith('split-')){
     if(i<2&&after.morning_flags.day5_split!==false)throw Error('day5_split completed before player decision '+scene.id+' round '+(i+1));
     if(i===1&&/(?:希罗|他)[\s\S]{0,180}(?:离开中央庭|走出(?:议事厅|大厅)|脚步声[^。\n]{0,80}(?:消失|远去))[\s\S]{0,260}安托涅瓦[\s\S]{0,160}(?:倒下|瘫倒|力竭)/.test(data.text))throw Error('day5 prose crossed unresolved Hiro decision boundary '+scene.id);
     if(i===2&&after.morning_flags.day5_split!==true)throw Error('day5_split did not complete after explicit refusal '+scene.id+'; flag='+String(after.morning_flags.day5_split)+'; tail='+String(data.text).slice(-1800));
   }
   await page.evaluate(()=>{const chat=document.querySelector('#chat'),last=chat?.querySelector('.mes:last-of-type');if(chat&&last)chat.scrollTop=last.offsetTop;});
   await page.screenshot({path:out+'/'+scene.id+'-'+(i+1)+'.jpg',type:'jpeg',quality:90,fullPage:true});
   await checkpoint('completed '+scene.id+' '+(i+1));
   await fs.writeFile(out+'/native-live.json',JSON.stringify({model:'gemini-3-flash-preview',rounds,apiResponses,errors},null,2));
   await fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));
  }
  const end=rounds.at(-1).after,keys=scene.day===6?['day6_monologue','day6_saiham']:['day5_monologue','day5_split'];
  if(!keys.every(k=>end.morning_flags[k]===true))throw Error('morning flags did not settle: '+scene.id);
  if(end.clock_minutes!==560)throw Error('first post-morning patrol did not spend 80 minutes: '+scene.id);
  await page.setViewportSize({width:430,height:2500});
  await page.waitForTimeout(600);
  await page.screenshot({path:out+'/'+scene.id+'-mobile.jpg',type:'jpeg',quality:90,fullPage:true});
  await page.setViewportSize({width:1080,height:2500});
 }

 // Separate real-ST boundary probe: Hiro has already left, while Saiham is still physically inside Central Court.
 // This keeps the main Day-6 story natural instead of forcing an implausible NPC action merely to satisfy a test.
 await checkpoint('seed hiro-only departure boundary');
 {
  const state=structuredClone(init);
  Object.assign(state,{day:6,clock_minutes:480,location:'中央庭医疗走廊',known:['安','安托涅瓦','晏华','希罗','珈儿','泰丝拉','赛哈姆']});
  state.regions.school.liberated=true;state.regions.east.liberated=true;state.cores.court='purified';state.route_flags.first_second_region='east';state.tasks.DAY7_OPENING.status='completed';
  state.morning_flags.day6_monologue=true;state.morning_flags.day6_saiham=false;state.intel_flags.chimera_exists_known=true;state.intel_flags.hiro_chimera_research_known=true;
  const scene='刚才的争执已经结束。安托涅瓦派来的中央庭医疗人员已经到场接管赛哈姆。希罗本人刚刚独自离开中央庭，赛哈姆仍被固定在中央庭医疗走廊的拘束担架上，由安和医疗人员看守，尚未被转移。你没有对保密作出承诺。';
  await page.evaluate(async({state,scene})=>{const st=await import('/script.js');await st.clearChat();st.updateChatMetadata({},true);st.characters[st.this_chid].chat='native-day6-hiro-only';st.chat.splice(0,st.chat.length,{name:st.name2,is_user:false,is_system:false,mes:scene,swipe_id:0,variables:{0:{stat_data:state}}});await st.printMessages();const frame=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow?.__f7dCommitHook)?.contentWindow;if(!frame)throw Error('missing real MVU iframe');await st.eventSource.emit(st.event_types?.CHAT_CHANGED||'chat_id_changed',st.getCurrentChatId?.());const data=Mvu.getMvuData({type:'message',message_id:0});data.stat_data=state;data.display_data=structuredClone(state);data.delta_data={};await frame.replaceVariables(data,{type:'message',message_id:0});},{state,scene});
  const user='继续眼前这一刻，只确认谁已经离开、谁仍在中央庭，不要替我作新的转移决定。';
  await page.locator('#send_textarea').fill(user);
  const start=requests.length;
  await checkpoint('generating hiro-only boundary');
  await limit(evalNative(async()=>{const st=await import('/script.js');st.setOnlineStatus('Connected');await st.Generate('normal');}),180000,'native generation hiro-only boundary');
  await waitIdle();
  const data=await page.evaluate(()=>{const c=SillyTavern.getContext();const n=c.chat.length-1;return {text:c.chat[n]?.mes,variables:Mvu.getMvuData({type:'message',message_id:n}),terminal:window.f7dTacticalTerminal?.getSnapshot?.()};});
  const after=data.variables?.stat_data;
  if(requests.length===start)throw Error('No native model request was sent for Hiro-only boundary');
  if(after?.morning_flags?.day6_saiham!==false)throw Error('Hiro-only departure incorrectly completed Saiham gate in separate real-ST probe');
  if(!/(?:希罗|他)[^。\n]{0,120}(?:已经|刚刚)?(?:离开|走出|离去)/.test(data.text))throw Error('Hiro-only boundary prose lost Hiro departure fact');
  if(!/赛哈姆[^。\n]{0,160}(?:仍|还|留|在)[^。\n]{0,120}(?:中央庭|医疗走廊|拘束担架)/.test(data.text))throw Error('Hiro-only boundary prose lost Saiham-on-site fact');
  rounds.push({case:'hiro-only',round:1,user,after,text:data.text,requests:requests.slice(start).map(r=>({model:r.model,source:r.source,message_count:r.message_count,chars:r.chars}))});
  await page.screenshot({path:out+'/hiro-only-boundary.jpg',type:'jpeg',quality:90,fullPage:true});
  await checkpoint('completed hiro-only boundary');
  await fs.writeFile(out+'/native-live.json',JSON.stringify({model:'gemini-3-flash-preview',rounds,apiResponses,errors},null,2));
 }
}catch(e){failure={message:e.message,phase:lastPhase,stack:e.stack};await checkpoint('blocked: '+e.message);await page.screenshot({path:out+'/blocked.jpg',type:'jpeg',quality:90}).catch(()=>{});}
await fs.writeFile(out+'/native-live.json',JSON.stringify({model:'gemini-3-flash-preview',native:true,rounds,apiResponses,errors,failure},null,2));
await fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));
await browser.close();
if(failure)throw Error(failure.message);
