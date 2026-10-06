
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const root='.lab/fixtures/qidu-day-gate/departure-audit';
const out=root+'/replay-results';
const fixture=JSON.parse(await fs.readFile(root+'/replay-fixture.json','utf8'));
const variant=process.env.GUARD_VARIANT||'fixed';
if(!['baseline','fixed'].includes(variant))throw Error('未知守卫版本');
await fs.mkdir(out,{recursive:true});
const card=JSON.parse(await fs.readFile('.lab/fixtures/qidu-day-gate/Qidu-v0.4.45-morning-lore-correct.json','utf8'));
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/https:\/\/gcore\.jsdelivr\.net\/gh\/MagicalAstrogy\/MagVarUpdate@[^']+/, '/f7d-mvu.js');
for(const script of card.data.extensions.tavern_helper.scripts)if(script.content.includes("host[KEY]={version:1,allow,dispose}"))script.content=script.content.replace("host[KEY]={version:1,allow,dispose}","host[KEY]={version:1,allow,dispose,state}");
const embeddedGuard=card.data.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-v0425-mvu-guard');
if(!embeddedGuard?.content.includes('被(?:带|抬|推|护送)离中央庭'))throw Error('内置守卫与固定源码不匹配');
if(variant==='fixed')embeddedGuard.content=embeddedGuard.content.replace('被(?:带|抬|推|护送)离中央庭','被(?:带|抬|推|护送)离(?:了)?中央庭');
const init=JSON.parse(card.data.character_book.entries.find(e=>e.comment.includes('[InitVar]')).content);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1080,height:2500}});
page.setDefaultTimeout(30000);
const rounds=[],requests=[],errors=[];const testedRevision='departure-replay-20261006';
page.on('pageerror',e=>errors.push(e.message.slice(0,500)));const runtimeLog=[];page.on('console',m=>{const t=m.text();if(/Set '|七都|变量|mag_|过期|MVU|script error/i.test(t))runtimeLog.push(t.slice(0,2000));});
page.on('request',r=>{if(r.url().endsWith('/api/backends/chat-completions/generate')){try{const d=r.postDataJSON();requests.push({model:d.model,source:d.chat_completion_source,message_count:d.messages?.length,chars:JSON.stringify(d.messages).length,messages:d.messages});void fs.writeFile(out+'/native-prompts.json',JSON.stringify(requests,null,2));}catch{}}});

let replayed=0;
await page.route('**/api/backends/chat-completions/generate',async route=>{
 replayed++;
 if(replayed>1){await route.abort();throw Error('出现未预期的额外生成请求');}
 const chunk=(delta,finish_reason=null)=>({id:'local-replay',object:'chat.completion.chunk',created:0,model:'local-recorded-reply',choices:[{index:0,delta,finish_reason}]});
 const body=[chunk({role:'assistant',content:fixture.text}),chunk({},'stop')].map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')+'data: [DONE]\n\n';
 await route.fulfill({status:200,contentType:'text/event-stream',body});
});
let failure;const pending=new Set();page.on('request',r=>{if(r.url().endsWith('/api/backends/chat-completions/generate'))pending.add(r);});for(const event of ['requestfinished','requestfailed'])page.on(event,r=>pending.delete(r));const waitIdle=async()=>{const deadline=Date.now()+180000;while(pending.size){if(Date.now()>deadline)throw Error('native background requests timeout');await page.waitForTimeout(500);}await page.waitForTimeout(1000);};
let lastPhase;const checkpoint=async phase=>{lastPhase=phase;console.log('回放阶段：'+variant+' '+phase);return fs.writeFile(out+'/checkpoint.json',JSON.stringify({phase,rounds:rounds.length,requests:requests.map(r=>({model:r.model,chars:r.chars})),errors},null,2));};
const limit=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error(label+' timeout')),ms);t.unref();})]);
const evalNative=page.evaluate.bind(page);page.evaluate=(...args)=>limit(evalNative(...args),60000,'native page operation');
try{
 await checkpoint('opening native ST');await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.TavernHelper);
 const onboarding=page.locator('dialog[open]').filter({has:page.locator('.onboarding')});
 await onboarding.waitFor({state:'visible',timeout:5000}).catch(()=>{});
 if(await onboarding.isVisible()){
  await onboarding.locator('.popup-input').fill('终端回放测试者');
  await onboarding.locator('.popup-button-ok').click();
  await onboarding.waitFor({state:'hidden'});
 }
 await checkpoint('importing card');const imported=await page.evaluate(async c=>{const csrf=await(await fetch('/csrf-token')).json();const fd=new FormData();fd.set('file_type','json');fd.set('avatar',new File([JSON.stringify(c)],'qidu-live.json',{type:'application/json'}));const r=await fetch('/api/characters/import',{method:'POST',headers:{'X-CSRF-Token':csrf.token},body:fd});if(!r.ok)throw Error('card import '+r.status);return r.json();},card);
 await page.evaluate(async version=>{const st=await import('/script.js');await st.getCharacters();const id=st.characters.findIndex(c=>c.data?.character_version===version);if(id<0)throw Error('missing imported card');st.setCharacterId(id);st.setCharacterName(st.characters[id].name);const regex=await import('/scripts/extensions/regex/engine.js');regex.allowScopedScripts(st.characters[id]);const pu=await import('/scripts/power-user.js');pu.power_user.world_import_dialog=false;const wi=await import('/scripts/world-info.js');$('#import_character_info').data('chid',id);await wi.importEmbeddedWorldInfo(true);},card.data.character_version);
 await checkpoint('native lorebook imported');
 if(await page.getByRole('button',{name:'收好纸条',exact:true}).isVisible())await page.getByRole('button',{name:'收好纸条',exact:true}).click();
 await page.locator('#API-status-top').click();await page.locator('#main_api').selectOption('openai');await page.locator('#chat_completion_source').selectOption('custom');
 await page.evaluate(async()=>{const st=await import('/script.js'),o=await import('/scripts/openai.js');Object.assign(o.oai_settings,{chat_completion_source:'custom',custom_url:'http://127.0.0.1:8000/replay-unused',custom_model:'gemini-3-flash-preview',stream_openai:true,openai_max_context:65000,openai_max_tokens:2600,custom_exclude_body:'[presence_penalty, frequency_penalty, top_p, top_k, temperature]',reverse_proxy:'',proxy_password:''});st.setOnlineStatus('Connected');});
 await page.locator('#API-status-top').click();
 await page.evaluate(scripts=>{TavernHelper.replaceScriptTrees([],{type:'character'});TavernHelper.replaceScriptTrees(scripts,{type:'global'});},card.data.extensions.tavern_helper.scripts);
 await checkpoint('waiting real scripts');await page.waitForFunction(()=>window.Mvu&&window.f7dDayGate&&window.f7dTacticalTerminal,{timeout:90000});
 await page.evaluate(()=>{const c=SillyTavern.getContext();c.extensionSettings.world_backstage.worldAutoEnabled=false;c.extensionSettings.world_backstage.publicOpinionAutoEnabled=false;window.__commitDiagnostics=[];const b=window.__f7dCommitBridge,valid=b.valid;b.valid=t=>{const ok=valid(t);if(!ok){const now=b.capture();__commitDiagnostics.push({epochMatch:t?.epoch===now.epoch,chatMatch:t?.chatId===now.chatId,signatureMatch:t?.signature===now.signature,oldSignature:t?.signature,newSignature:now.signature});}return ok;};window.__gates=[];c.eventSource.on(c.eventTypes.WORLDINFO_ENTRIES_LOADED,p=>{__gates.push(Object.fromEntries(['globalLore','characterLore','chatLore','personaLore'].map(k=>[k,(p[k]||[]).filter(e=>String(e.comment).includes('F7D_GATE')).map(e=>({id:e.uid,comment:e.comment}))])));});});

 await checkpoint('seed '+variant);
 await page.evaluate(async state=>{
  const st=await import('/script.js');await st.clearChat();st.updateChatMetadata({},true);
  st.characters[st.this_chid].chat='departure-replay-'+Date.now();
  st.chat.splice(0,st.chat.length,{name:st.name2,is_user:false,is_system:false,mes:'第六天清晨尚未醒来。',swipe_id:0,variables:{0:{stat_data:state}}});await st.printMessages();
  const frame=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow?.__f7dCommitHook)?.contentWindow;
  if(!frame)throw Error('缺少真实提交钩子脚本窗口');
  await st.eventSource.emit(st.event_types?.CHAT_CHANGED||'chat_id_changed',st.getCurrentChatId?.());
  const data=Mvu.getMvuData({type:'message',message_id:0});if(!data.schema)throw Error('MVU 未初始化');
  Object.assign(data,{stat_data:state,display_data:structuredClone(state),delta_data:{}});
  await frame.replaceVariables(data,{type:'message',message_id:0});
 },fixture.before);
 await page.evaluate(()=>{
  window.__publicationTrace=[];window.__snapshotTrace=[];
  const b=__f7dCommitBridge,original=b.publish;
  b.publish=function(ticket,id,reader){
   const saved=reader({type:'message',message_id:id})?.stat_data;
   const result=original.call(this,ticket,id,reader);
   __publicationTrace.push({id,committedFlags:structuredClone(saved?.morning_flags),result,status:f7dTacticalTerminal.getSnapshot().status,revision:f7dTacticalTerminal.getSnapshot().snapshot?.revision});
   return result;
  };
  window.__unsubscribe=f7dTacticalTerminal.subscribe(state=>{
   const c=SillyTavern.getContext(),id=c.chat.length-1;
   __snapshotTrace.push({status:state.status,reason:state.reason,revision:state.snapshot?.revision,scope:state.snapshot?.scope,committedFlags:structuredClone(Mvu.getMvuData({type:'message',message_id:id})?.stat_data?.morning_flags)});
  });
 });
 await page.locator('#send_textarea').fill(fixture.user);
 await checkpoint('replay '+variant);
 await limit(evalNative(async()=>{const st=await import('/script.js');st.setOnlineStatus('Connected');await st.Generate('normal');}),180000,'原生生成回放');
 await waitIdle();
 await page.waitForFunction(()=>{const c=SillyTavern.getContext();return Mvu.getMvuData({type:'message',message_id:c.chat.length-1})?.stat_data?.morning_flags?.day6_monologue===true&&f7dTacticalTerminal.getSnapshot().status==='ready';},{timeout:30000});
 const data=await page.evaluate(()=>{
  const c=SillyTavern.getContext(),id=c.chat.length-1;
  return {text:c.chat[id]?.mes,after:Mvu.getMvuData({type:'message',message_id:id})?.stat_data,terminal:f7dTacticalTerminal.getSnapshot(),publications:__publicationTrace,snapshots:__snapshotTrace,guard:__F7D_MVU_GUARD__,diagnostics:__commitDiagnostics};
 });
 if(replayed!==1)throw Error('没有回放一次原生生成请求');
 if(!data.text.includes('被带离了中央庭'))throw Error('真实失败正文没有进入原生回复');
 if(data.after.morning_flags.day6_saiham!==(variant==='fixed'))throw Error('离场旗标与守卫版本不符');
 if(data.after.clock_minutes!==480)throw Error('晨间回放意外扣时');
 const ready=data.snapshots.filter(x=>x.status==='ready');
 if(ready.length<2||!data.snapshots.some(x=>x.status!=='ready'))throw Error('缺少生成清空或提交后通知');
 if(ready.at(-1).committedFlags.day6_saiham!==(variant==='fixed'))throw Error('终端发布早于离场旗标提交');
 if(!data.publications.some(x=>x.result&&x.committedFlags?.day6_saiham===(variant==='fixed')))throw Error('没有真实提交钩子的有效发布');
 if(data.diagnostics.length)throw Error('存在过期提交拒绝');
 rounds.push({variant,passed:true,scope:'真实酒馆受控回放，使用既有真实模型正文；无新模型生成',replayed,...data});
 await page.screenshot({path:out+'/'+variant+'.jpg',type:'jpeg',quality:90,fullPage:true});
 await page.evaluate(()=>__unsubscribe());
}catch(e){failure={message:e.message,phase:lastPhase,stack:e.stack};await checkpoint('blocked: '+e.message);await page.screenshot({path:out+'/'+variant+'-blocked.jpg',type:'jpeg',quality:90}).catch(()=>{});}
await fs.writeFile(out+'/'+variant+'.json',JSON.stringify({variant,sourceCommit:'5bf28e33407938e42a5cdbbaad4c250e7dea0d99',sourceRun:'37211901343',replayed,rounds,errors,failure,runtimeLog},null,2));
await browser.close();
if(failure)throw Error(failure.message);
