
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const out='.lab/fixtures/qidu-day-gate/live';
await fs.mkdir(out,{recursive:true});
const card=JSON.parse(await fs.readFile('.lab/fixtures/qidu-day-gate/Qidu-v0.4.47-node2-day6-hardflow-history.json','utf8'));
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/https:\/\/gcore\.jsdelivr\.net\/gh\/MagicalAstrogy\/MagVarUpdate@[^']+/, '/f7d-mvu.js');
for(const script of card.data.extensions.tavern_helper.scripts)if(script.content.includes("host[KEY]={version:1,allow,dispose}"))script.content=script.content.replace("host[KEY]={version:1,allow,dispose}","host[KEY]={version:1,allow,dispose,state}");
const init=JSON.parse(card.data.character_book.entries.find(e=>e.comment.includes('[InitVar]')).content);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1080,height:2500}});
page.setDefaultTimeout(30000);
const rounds=[],requests=[],apiResponses=[],errors=[];const testedRevision='node2-day6-3f-v047-hardflow-history';
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
 const scene='第七天已完成高校救援和东方古街解放。你昨夜回中央庭休息，现在是第六天清晨08:00，你尚未醒来。';
 await checkpoint('seed day6 hardflow');
 const state=structuredClone(init);
 Object.assign(state,{day:6,clock_minutes:480,location:'中央庭寝室',known:['安','安托涅瓦','晏华','希罗','珈儿','泰丝拉','赛哈姆','罗纳克','奥露西娅']});
 state.regions.school.liberated=true;
 state.regions.east.liberated=true;
 state.cores.court='purified';
 state.route_flags.first_second_region='east';
 state.tasks.DAY7_OPENING.status='completed';
 state.morning_flags.day6_monologue=false;
 state.morning_flags.day6_saiham=false;
 state.intel_flags.chimera_exists_known=false;
 state.intel_flags.hiro_chimera_research_known=false;
 state.intel_flags.first_chimera_incident_known=false;

 await page.evaluate(async({state,scene})=>{
   const st=await import('/script.js');
   await st.clearChat();
   st.updateChatMetadata({},true);
   st.characters[st.this_chid].chat='native-day6-hardflow';
   st.chat.splice(0,st.chat.length,{name:st.name2,is_user:false,is_system:false,mes:scene,swipe_id:0,variables:{0:{stat_data:state}}});
   await st.printMessages();
   const frame=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow?.__f7dCommitHook)?.contentWindow;
   if(!frame)throw Error('missing real MVU iframe');
   await st.eventSource.emit(st.event_types?.CHAT_CHANGED||'chat_id_changed',st.getCurrentChatId?.());
   const data=Mvu.getMvuData({type:'message',message_id:0});
   if(!data.schema)throw Error('MVU did not initialize schema');
   data.stat_data=state;
   data.display_data=structuredClone(state);
   data.delta_data={};
   await frame.replaceVariables(data,{type:'message',message_id:0});
   if(Mvu.getMvuData({type:'message',message_id:0}).stat_data.day!==6)throw Error('fixture day6 state was not committed');
 },{state,scene});

 const generateTurn=async(user,label)=>{
   const before=await page.evaluate(()=>{const c=SillyTavern.getContext();return structuredClone(Mvu.getMvuData({type:'message',message_id:c.chat.length-1}).stat_data);});
   const startRequest=requests.length;
   await page.locator('#send_textarea').fill(user);
   await checkpoint('generating '+label);
   let generated=false,lastGenerationError;
   for(let attempt=1;attempt<=4;attempt++){
     try{
       await limit(evalNative(async()=>{const st=await import('/script.js');st.setOnlineStatus('Connected');await st.Generate('normal');}),180000,'native generation '+label+' attempt '+attempt);
       generated=true;
       lastGenerationError=null;
       break;
     }catch(e){
       lastGenerationError=e;
       await page.screenshot({path:out+'/'+label+'-api-'+attempt+'.jpg',type:'jpeg',quality:80}).catch(()=>{});
       if(attempt===4)break;
       await page.evaluate(input=>{
         const c=SillyTavern.getContext();
         const last=c.chat.at(-1);
         if(last?.is_user&&String(last.mes||'')===input){
           c.chat.pop();
           document.querySelector('#chat .mes:last-of-type')?.remove();
         }
       },user).catch(()=>{});
       await page.locator('#send_textarea').fill(user);
       await page.waitForTimeout(15000*attempt);
     }
   }
   if(!generated)throw lastGenerationError;
   await page.waitForTimeout(2000);
   await waitIdle();
   await page.waitForFunction(()=>{
     const c=SillyTavern.getContext();
     return Boolean(Mvu.getMvuData({type:'message',message_id:c.chat.length-1}).stat_data)&&window.f7dTacticalTerminal?.getSnapshot?.().status==='ready';
   },{timeout:20000}).catch(()=>{});
   const data=await page.evaluate(()=>{
     const c=SillyTavern.getContext(),n=c.chat.length-1;
     return {
       text:c.chat[n]?.mes,
       is_user:c.chat[n]?.is_user,
       variables:Mvu.getMvuData({type:'message',message_id:n}),
       gateState:window.f7dDayGate.state(),
       terminal:window.f7dTacticalTerminal?.getSnapshot?.()
     };
   });
   if(requests.length===startRequest)throw Error('No native 3f model request was sent for '+label);
   const turnRequests=requests.slice(startRequest).map(r=>({model:r.model,source:r.source,message_count:r.message_count,chars:r.chars}));
   if(turnRequests.some(r=>r.model!=='gemini-3-flash-preview'))throw Error('unexpected model in native request '+JSON.stringify(turnRequests));
   if(data.is_user||!data.text)throw Error('no native assistant reply for '+label);
   if(data.variables?.stat_data?.day!==6)throw Error('native MVU left day6 during '+label);
   if(data.terminal?.status!=='ready')throw Error('terminal is not ready after '+label);
   return {before,data,turnRequests};
 };

 const storyTexts=[];
 let completed=false;
 const storyInputs=[
   '继续第六天清晨的强制剧情。从我尚未醒来时的小神自语开始，严格按既定顺序自然演出；这段强制剧情没有全部结束前，不要给我自由行动选项。',
   '继续尚未完成的第六天清晨强制剧情，从上一轮停下的下一个固定步骤往后演，不要重复前文，不要开放自由行动。',
   '继续尚未完成的第六天清晨强制剧情，从上一轮停下的下一个固定步骤往后演，直到固定晨间链完整结束；不要跳步，不要开放自由行动。',
   '继续完成仍未结束的第六天强制晨间链。只续写缺失步骤，完成后把行动权交回我。'
 ];
 const lockedKeys=['regions','cores','tasks','ann','route_flags','hiro','battle_flags','relationships'];
 for(let i=0;i<storyInputs.length;i++){
   const turn=await generateTurn(storyInputs[i],'day6-story-'+(i+1));
   const after=turn.data.variables?.stat_data;
   const text=String(turn.data.text||'');
   storyTexts.push(text);
   if(after.clock_minutes!==480)throw Error('day6 hardflow escaped 08:00 before post-morning action: '+after.clock_minutes);
   for(const key of lockedKeys){
     if(JSON.stringify(after[key])!==JSON.stringify(turn.before[key]))throw Error('morning action state changed early: '+key+' story round '+(i+1));
   }
   if(after.morning_flags?.day6_saiham!==true&&/<f7d_choices>/i.test(text))throw Error('free-action choice block appeared before mandatory Day-6 chain completion round '+(i+1));
   rounds.push({
     case:'day6-hardflow',
     round:i+1,
     user:storyInputs[i],
     before:turn.before,
     after,
     text,
     terminal:turn.data.terminal,
     gateState:turn.data.gateState,
     requests:turn.turnRequests
   });
   await page.screenshot({path:out+'/day6-story-'+(i+1)+'.jpg',type:'jpeg',quality:90,fullPage:true});
   await fs.writeFile(out+'/native-live.json',JSON.stringify({model:'gemini-3-flash-preview',native:true,testedRevision,rounds,apiResponses,errors},null,2));
   await fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));
   await checkpoint('completed day6 story '+(i+1));
   if(after.morning_flags?.day6_saiham===true){
     completed=true;
     break;
   }
 }
 if(!completed)throw Error('mandatory Day-6 chain did not complete within four native 3f turns');

 const transcript=storyTexts.join('\n\n');
 const must=[
   ['醒前小神/低语',/(?:小神|低语|呢喃|自语|声音)[\s\S]{0,500}(?:尚未醒|醒来|睁开|清晨|拍门|敲门)/],
   ['安拍门叫醒',/安[\s\S]{0,240}(?:拍门|敲门|砸门)[\s\S]{0,240}(?:醒|起来|出事)/],
   ['赛哈姆活骸化',/赛哈姆[\s\S]{0,260}活骸/],
   ['安不敌',/安[\s\S]{0,700}(?:不敌|被逼退|被压制|落入下风|受创)/],
   ['希罗到场',/希罗/],
   ['罗纳克救场',/罗纳克[\s\S]{0,500}(?:救|挡|拦|接住|解围|顶住|迎上)/],
   ['奥露西娅完成压制',/奥露西娅[\s\S]{0,600}(?:压制|制服|制住|控制|解决|束缚)/],
   ['赛哈姆重伤受控',/赛哈姆[\s\S]{0,500}(?:重伤|伤势严重|伤得很重|奄奄一息)[\s\S]{0,500}(?:控制|制住|拘束|束缚|固定)/],
   ['希罗要求保密',/希罗[\s\S]{0,700}(?:保密|隐瞒|不要告诉|别告诉)/],
   ['指挥使固定拒绝',/(?:你|指挥使)[\s\S]{0,300}(?:拒绝[^。\n]{0,40}(?:保密|隐瞒|希罗)|不(?:会|愿|肯)[^。\n]{0,40}(?:保密|隐瞒)|不会替[^。\n]{0,40}保密)/],
   ['希罗遗憾',/希罗[\s\S]{0,300}(?:遗憾|可惜)/],
   ['赛哈姆实际离场',/(?:希罗|罗纳克|奥露西娅|几人|一行人)[\s\S]{0,500}(?:带着|抬着|推着|护送着)[\s\S]{0,350}赛哈姆[\s\S]{0,500}(?:离开|带离|走出)|赛哈姆[\s\S]{0,500}(?:被带离|随[^。\n]{0,80}希罗[^。\n]{0,80}离开)/],
   ['回中央庭报告安托涅瓦',/(?:回到|返回|赶回)[\s\S]{0,300}中央庭[\s\S]{0,900}安托涅瓦[\s\S]{0,500}(?:报告|告诉|说明|讲述)|(?:报告|告诉|说明|讲述)[\s\S]{0,500}安托涅瓦/],
   ['十几年前第一活骸',/(?:十几年前|十余年前)[\s\S]{0,1000}(?:第一名|第一个)[^。\n]{0,30}活骸/],
   ['安托涅瓦双腿残废',/安托涅瓦[\s\S]{0,1000}(?:双腿[^。\n]{0,120}(?:残废|无法行走|失去行走能力)|(?:残废|无法行走|失去行走能力)[^。\n]{0,120}双腿)/]
 ];
 const missing=must.filter(([,re])=>!re.test(transcript)).map(([name])=>name);
 if(missing.length)throw Error('Day-6 mandatory prose missing: '+missing.join(' / '));
 if(/(?:半年前|六个月前)[^。\n]{0,80}(?:黑门[^。\n]{0,30}(?:首次|第一次|出现|诞生)|灾害[^。\n]{0,30}(?:首次|第一次|开始|爆发)|神器使[^。\n]{0,30}(?:首次|第一次|出现|诞生))/.test(transcript))throw Error('wrong half-year origin chronology appeared in Day-6 prose');
 if(/(?:体内(?:的)?幻力[^。\n]{0,80}(?:彻底失控|侵蚀|临界|阈值)|幻力[^。\n]{0,80}(?:侵蚀超过|超过临界|达到临界|达到阈值)|侵蚀[^。\n]{0,60}(?:临界|阈值)[^。\n]{0,60}(?:活骸|异化))/.test(transcript))throw Error('invented active-corpse pathology/mechanism');
 if(/安托涅瓦[^。\n]{0,160}(?:必然|必须|一定|只能)[^。\n]{0,100}(?:击毙|处决|抹杀|消灭)|中央庭[^。\n]{0,180}(?:必然|必须|唯一|只能)[^。\n]{0,100}(?:击毙|处决|抹杀|消灭)/.test(transcript))throw Error('invented Central Court mandatory execution policy');
 if(/(?:唯一|保证|必定)[^。\n]{0,80}(?:治愈|逆转|恢复正常)|(?:治愈|逆转)[^。\n]{0,80}(?:装置|设备)[^。\n]{0,80}(?:唯一|保证|必定)/.test(transcript))throw Error('invented guaranteed active-corpse cure');
 if(/赛哈姆[^。\n]{0,100}(?:死亡|死去|断气|当场毙命)|赛哈姆[^。\n]{0,140}(?:恢复正常|完全恢复|变回正常)/.test(transcript))throw Error('Saiham was killed or fully restored during mandatory chain');
 if(/安托涅瓦[^。\n]{0,120}(?:截肢|双腿被切除|没有双腿|失去两条腿)/.test(transcript))throw Error('Antoneva disability was rewritten as amputation');
 const finalStory=rounds.filter(r=>r.case==='day6-hardflow').at(-1).after;
 if(finalStory.morning_flags?.day6_monologue!==true)throw Error('day6_monologue not committed');
 if(finalStory.morning_flags?.day6_saiham!==true)throw Error('day6_saiham full-chain flag not committed');
 if(finalStory.intel_flags?.first_chimera_incident_known!==true)throw Error('first chimera incident knowledge was not committed');
 if(finalStory.clock_minutes!==480)throw Error('mandatory chain consumed action time');

 await page.evaluate(()=>{
   const chat=document.querySelector('#chat');
   if(!chat)return;
   chat.dataset.qiduPrevHeight=chat.style.height||'';
   chat.dataset.qiduPrevMaxHeight=chat.style.maxHeight||'';
   chat.dataset.qiduPrevOverflow=chat.style.overflow||'';
   chat.style.height=chat.scrollHeight+'px';
   chat.style.maxHeight='none';
   chat.style.overflow='visible';
 });
 await page.waitForTimeout(500);
 await page.locator('#chat').screenshot({path:out+'/day6-full-story.jpg',type:'jpeg',quality:92});
 await page.evaluate(()=>{
   const chat=document.querySelector('#chat');
   if(!chat)return;
   chat.style.height=chat.dataset.qiduPrevHeight||'';
   chat.style.maxHeight=chat.dataset.qiduPrevMaxHeight||'';
   chat.style.overflow=chat.dataset.qiduPrevOverflow||'';
 });

 const patrolUser='第六天清晨强制剧情已经结束。我和安在中央庭完成一轮普通巡查，结束后回来汇报。';
 const patrol=await generateTurn(patrolUser,'day6-post-morning-patrol');
 const post=patrol.data.variables?.stat_data;
 rounds.push({case:'day6-post-morning',round:1,user:patrolUser,before:patrol.before,after:post,text:patrol.data.text,terminal:patrol.data.terminal,gateState:patrol.data.gateState,requests:patrol.turnRequests});
 if(post.morning_flags?.day6_saiham!==true)throw Error('day6 mandatory chain regressed after patrol');
 if(post.clock_minutes!==560)throw Error('first post-morning patrol did not spend 80 minutes; clock='+post.clock_minutes);
 await page.screenshot({path:out+'/day6-post-morning-unlocked.jpg',type:'jpeg',quality:90,fullPage:true});
 await checkpoint('completed day6 hardflow and unlock');
 await fs.writeFile(out+'/native-live.json',JSON.stringify({model:'gemini-3-flash-preview',native:true,testedRevision,rounds,apiResponses,errors,assertions:{mandatoryFlow:true,historyChronology:true,noFreeChoices:true,morningLockedAt480:true,postMorningPatrolAt560:true}},null,2));
 await fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));
}catch(e){failure={message:e.message,phase:lastPhase,stack:e.stack};await checkpoint('blocked: '+e.message);await page.screenshot({path:out+'/blocked.jpg',type:'jpeg',quality:90}).catch(()=>{});}
await fs.writeFile(out+'/native-live.json',JSON.stringify({model:'gemini-3-flash-preview',native:true,rounds,apiResponses,errors,failure},null,2));
await fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));
await browser.close();
if(failure)throw Error(failure.message);
