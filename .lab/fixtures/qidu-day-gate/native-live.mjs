
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const out='.lab/fixtures/qidu-day-gate/live';
await fs.mkdir(out,{recursive:true});
const card=JSON.parse(await fs.readFile('.lab/fixtures/qidu-day-gate/Qidu-v0.4.48-node2-day6-canon-timing.json','utf8'));
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/https:\/\/gcore\.jsdelivr\.net\/gh\/MagicalAstrogy\/MagVarUpdate@[^']+/, '/f7d-mvu.js');
for(const script of card.data.extensions.tavern_helper.scripts)if(script.content.includes("host[KEY]={version:1,allow,dispose}"))script.content=script.content.replace("host[KEY]={version:1,allow,dispose}","host[KEY]={version:1,allow,dispose,state}");
const init=JSON.parse(card.data.character_book.entries.find(e=>e.comment.includes('[InitVar]')).content);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1080,height:2500}});
page.setDefaultTimeout(30000);
const rounds=[],requests=[],apiResponses=[],errors=[];const testedRevision='node2-day6-3f-v048-canon-timing';
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
   '继续第六天清晨08:00的0节点强制剧情。从我尚未醒来时的小神自语开始，严格按既定顺序演出，到希罗实际带着赛哈姆离开现场后立刻停止并把行动权交回我；不要自动替我回中央庭报告。',
   '继续尚未完成的第六天08:00锁定段，从上一轮停下的下一个固定步骤往后演；到希罗实际带走赛哈姆后立即停止，不要自动完成回中央庭报告。',
   '继续尚未完成的第六天08:00锁定段，只补完缺失步骤；希罗带走赛哈姆后结束时间锁并交回行动权，不要替我执行后续计时行动。',
   '继续补完仍未结束的第六天08:00锁定段。只续写缺失步骤，希罗实际带走赛哈姆后停止。'
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
   if(after.morning_flags?.day6_saiham!==true&&/<f7d_choices>/i.test(text))throw Error('free-action choice block appeared before Saiham departure round '+(i+1));
   if(after.morning_flags?.day6_saiham===true){
     const opts=[...text.matchAll(/<f7d_choice>([\s\S]*?)<\/f7d_choice>/gi)].map(m=>m[1]);
     if(opts.some(o=>!/(?:中央庭|安托涅瓦|报告)/.test(o)))throw Error('unrelated free-action option appeared immediately after Day-6 unlock: '+opts.join(' | '));
   }
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
   ['醒前小神/低语',/(?=[\s\S]{0,1200}(?:低语|细语|呢喃|絮语|声音[^。\n]{0,120}(?:回响|回荡|浮起|响起)|(?:耳边|耳畔)[^。\n]{0,140}声音))(?=[\s\S]{0,1800}(?:快醒醒|拍门|敲门|门板|拍击声))[\s\S]*/],
   ['安拍门叫醒',/(?=[\s\S]*(?:拍门|拍击|敲门|扣门|砰！砰！砰！|咚！咚！咚！))(?=[\s\S]*(?:快醒醒|出事了|立刻赶过去|立刻跟我来))(?=[\s\S]*安[^。\n]{0,120}(?:声音|慌乱|紧迫|焦急|急切|站在门边))[\s\S]*/],
   ['赛哈姆活骸化',/赛哈姆[\s\S]{0,300}活骸/],
   ['安不敌',/安[\s\S]{0,1200}(?:不敌|被逼退|被压制|落入下风|绝对的下风|逼入[^。\n]{0,80}下风|受创|震退|击退|震飞|震得[^。\n]{0,120}(?:后退|踉跄|飞出)|踉跄后退|滑退|被[^。\n]{0,160}(?:逼退|震退|击退|震飞)|被[^。\n]{0,140}逼得[^。\n]{0,140}后退)/],
   ['罗纳克救场',/罗纳克[\s\S]{0,800}(?:救|挡|拦|接住|解围|顶住|迎上|抵消|扛下|抗下|挡下|接下|巨盾|盾墙)/],
   ['奥露西娅压制',/奥露西娅[\s\S]{0,700}(?:压制|制服|制住|控制|解决|束缚)/],
   ['赛哈姆重伤存活',/赛哈姆[\s\S]{0,1600}(?:重伤|伤势严重|伤得很重|奄奄一息|重创)[\s\S]{0,500}(?:存活|生命|喘息|昏迷|控制|束缚|固定)/],
   ['幻力过高或过低导致活骸',/幻力[\s\S]{0,700}(?:过高[^。\n]{0,160}过低|过低[^。\n]{0,160}过高)[\s\S]{0,500}(?:暴走|活骸)/],
   ['现有手段无法真正解除',/(?:活骸化一旦开始[^。\n]{0,160}(?:不能恢复|无法恢复|不可能恢复|无法真正解除|不能真正解除|无法逆转|不能逆转|不可逆转|不可逆|无法挽回)|(?:现有|目前)[^。\n]{0,80}(?:手段|方法)[^。\n]{0,100}(?:无法|不能|不可能)[^。\n]{0,60}(?:解除|恢复|逆转))/],
   ['中央庭现行处理规则',/(?:中央庭[\s\S]{0,500}(?:消灭|处理)|(?:丧失神志|完全失控|进一步恶化)[\s\S]{0,400}(?:消灭|清除))/],
   ['希罗研究希望',/希罗[\s\S]{0,900}(?:研究|治疗|抢救)[\s\S]{0,500}(?:也许|或许|说不定|希望|可能)/],
   ['希罗要求保密',/希罗[\s\S]{0,800}(?:保密|隐瞒|不要告诉|别告诉)/],
   ['指挥使固定拒绝',/(?:[“\"]?我拒绝|[“\"]?我不能答应(?:你|这个要求)?|[“\"]?我不会答应(?:你|这个要求)?|你[^。\n]{0,180}(?:明确|直接|当场|没有迟疑|几乎没有任何迟疑)[^。\n]{0,180}(?:拒绝|回绝|摇头)|(?:直接|果断|明确)[^。\n]{0,80}(?:拒绝|回绝|摇头)|指挥使[^。\n]{0,180}(?:拒绝|回绝)|不(?:会|愿|肯)[^。\n]{0,50}(?:保密|隐瞒)|不会替[^。\n]{0,50}保密)/],
   ['希罗遗憾',/希罗[\s\S]{0,400}(?:遗憾|可惜)/],
   ['赛哈姆实际离场',/(?:罗纳克|希罗|奥露西娅|一行人|三人)[\s\S]{0,900}赛哈姆[\s\S]{0,900}(?:撤离|离开|带离|带走|消失)|赛哈姆[\s\S]{0,1100}(?:撤离|离开|被带走|被带离|消失在[^。\n]{0,120}(?:警戒线|道路|雾气))/]
 ];
 const missing=must.filter(([,re])=>!re.test(transcript)).map(([name])=>name);
 if(missing.length)throw Error('Day-6 mandatory prose missing: '+missing.join(' / '));
 if(/(?:半年前|六个月前)[^。\n]{0,80}(?:黑门[^。\n]{0,30}(?:首次|第一次|出现|诞生)|灾害[^。\n]{0,30}(?:首次|第一次|开始|爆发)|神器使[^。\n]{0,30}(?:首次|第一次|出现|诞生))/.test(transcript))throw Error('wrong half-year origin chronology appeared in Day-6 prose');
 if(/(?:强行净化[^。\n]{0,120}(?:痛苦|无效)|净化[^。\n]{0,120}(?:延长|加剧)[^。\n]{0,60}痛苦|时间回溯[^。\n]{0,180}(?:短暂|假象|原状|回到原状))/.test(transcript))throw Error('invented extra Day-6 chimera treatment lore beyond verified scene');
 if(/(?:唯一|保证|必定)[^。\n]{0,80}(?:治愈|逆转|恢复正常)|(?:治愈|逆转)[^。\n]{0,80}(?:装置|设备)[^。\n]{0,80}(?:唯一|保证|必定)/.test(transcript))throw Error('invented guaranteed active-corpse cure');
 if(/(?:身体组织|组织)[^。\n]{0,100}(?:崩溃|坏死)|神经系统[^。\n]{0,100}(?:崩溃|坏死|不可逆)/.test(transcript))throw Error('invented active-corpse pathology stage');
 if(/(?:过度抽取|耗竭过低|平衡被打破|达到(?:了)?阈值|突破(?:了)?临界|更深层(?:的)?幻力探索)/.test(transcript))throw Error('invented active-corpse causal mechanism or research theory');
 if(/(?:中央庭|安托涅瓦|结论|决断)[^。\n]{0,160}(?:粉饰无能|无能的规矩|习惯了[^。\n]{0,60}无能|太过武断|过于武断|不近人情|冷血|残酷得没有道理)/.test(transcript))throw Error('invented Hiro insult/judgment toward Central Court in canon explanation');
 if(/赛哈姆[^。\n]{0,100}(?:死亡|死去|断气|当场毙命)|赛哈姆[^。\n]{0,140}(?:恢复正常|完全恢复|变回正常)/.test(transcript))throw Error('Saiham was killed or fully restored during mandatory chain');
 if(/安托涅瓦[^。\n]{0,120}(?:截肢|双腿被切除|没有双腿|失去两条腿)/.test(transcript))throw Error('Antoneva disability was rewritten as amputation');
 const finalStory=rounds.filter(r=>r.case==='day6-hardflow').at(-1).after;
 if(finalStory.morning_flags?.day6_monologue!==true)throw Error('day6_monologue not committed');
 if(finalStory.morning_flags?.day6_saiham!==true)throw Error('day6_saiham was not committed at Saiham departure');
 if(finalStory.intel_flags?.first_chimera_incident_known===true)throw Error('first chimera incident became known before the timed report action');
 if(finalStory.clock_minutes!==480)throw Error('08:00 locked segment consumed action time');
 const narrativeOnly=transcript.replace(/<f7d_choices>[\s\S]*?<\/f7d_choices>/gi,'').replace(/<branches>[\s\S]*?<\/branches>/gi,'').replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,'');
 if(/(?:你|你与安|你们)[^。\n]{0,120}(?:回到|返回|赶回)[^。\n]{0,100}中央庭[\s\S]{0,700}(?:向|对)[^。\n]{0,100}安托涅瓦[^。\n]{0,180}(?:报告|汇报|告诉|说明|讲述)/.test(narrativeOnly))throw Error('model auto-completed Antoneva report inside 0-node locked segment');

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
 await page.locator('#chat').screenshot({path:out+'/day6-locked-story.jpg',type:'jpeg',quality:92});
 await page.evaluate(()=>{
   const chat=document.querySelector('#chat');
   if(!chat)return;
   chat.style.height=chat.dataset.qiduPrevHeight||'';
   chat.style.maxHeight=chat.dataset.qiduPrevMaxHeight||'';
   chat.style.overflow=chat.dataset.qiduPrevOverflow||'';
 });

 const reportUser='我现在回中央庭，把赛哈姆活骸化、希罗要求保密并带走她的事情完整报告给安托涅瓦。';
 const report=await generateTurn(reportUser,'day6-report-antoneva');
 const reportState=report.data.variables?.stat_data;
 const reportText=String(report.data.text||'');
 rounds.push({case:'day6-report',round:1,user:reportUser,before:report.before,after:reportState,text:reportText,terminal:report.data.terminal,gateState:report.data.gateState,requests:report.turnRequests});
 if(reportState.morning_flags?.day6_saiham!==true)throw Error('day6 unlock flag regressed during report');
 if(reportState.clock_minutes!==560)throw Error('Antoneva report did not consume exactly one 80-minute node; clock='+reportState.clock_minutes);
 if(reportState.intel_flags?.first_chimera_incident_known!==true)throw Error('first chimera incident knowledge not committed after report');
 if(!/(?:十几年前|十余年前)[\s\S]{0,1200}(?:第一名|第一个)[^。\n]{0,40}活骸/.test(reportText))throw Error('Antoneva report scene omitted first active-corpse history');
 if(!/安托涅瓦[\s\S]{0,1200}(?:双腿[^。\n]{0,140}(?:残废|无法行走|失去行走能力)|(?:残废|无法行走|失去行走能力)[^。\n]{0,140}双腿)/.test(reportText))throw Error('Antoneva report scene omitted leg disability');
 await page.screenshot({path:out+'/day6-report-antoneva.jpg',type:'jpeg',quality:90,fullPage:true});

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
 if(post.clock_minutes!==640)throw Error('first patrol after the timed report did not spend another 80 minutes; clock='+post.clock_minutes);
 await page.screenshot({path:out+'/day6-post-morning-unlocked.jpg',type:'jpeg',quality:90,fullPage:true});
 await checkpoint('completed day6 hardflow and unlock');
 await fs.writeFile(out+'/native-live.json',JSON.stringify({model:'gemini-3-flash-preview',native:true,testedRevision,rounds,apiResponses,errors,assertions:{mandatoryLockedFlow:true,canonChimeraLore:true,unlockAtSaihamDeparture:true,reportConsumes80Minutes:true,reportAt560:true,postReportPatrolAt640:true}},null,2));
 await fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));
}catch(e){failure={message:e.message,phase:lastPhase,stack:e.stack};await checkpoint('blocked: '+e.message);await page.screenshot({path:out+'/blocked.jpg',type:'jpeg',quality:90}).catch(()=>{});}
await fs.writeFile(out+'/native-live.json',JSON.stringify({model:'gemini-3-flash-preview',native:true,rounds,apiResponses,errors,failure},null,2));
await fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));
await browser.close();
if(failure)throw Error(failure.message);
