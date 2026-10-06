import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {parseCompletionMetadata} from '../f7d-terminal-v1-natural/response-metadata.mjs';
const root='.lab/fixtures/f7d-terminal-v1.0.3';
const replayMode=process.env.F7D_REPLAY==='1';
const replayFixture=process.env.F7D_REPLAY_FIXTURE==='vehicle'?'vehicle':'scope';
const fixture=JSON.parse(await fs.readFile(root+'/replay-fixture.json','utf8'));
if(replayMode)fixture.morning.replayText=JSON.parse(await fs.readFile(root+'/'+replayFixture+'-failure.json','utf8')).text;
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json','utf8'));
const out=root+'/results/'+(replayMode?'replay-'+replayFixture:'natural');await fs.mkdir(out,{recursive:true});
const raw=await fs.readFile(root+'/Qidu-v0.4.41-terminal-v1.0.3.json');
const cardSha=crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(cardSha,manifest.files['Qidu-v0.4.41-terminal-v1.0.3.json'].sha256,'正式候选卡散列不符');
const card=JSON.parse(raw);assert.equal(card.data.character_version,'0.4.41-terminal-v1.0.3');
// 仅将固定版本的远程模块地址换为同一产物的本地地址。
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/https:\/\/gcore\.jsdelivr\.net\/gh\/MagicalAstrogy\/MagVarUpdate@[^']+/, '/f7d-mvu.js');
const init=JSON.parse(card.data.character_book.entries.find(e=>e.comment.includes('[InitVar]')).content);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1080,height:1600}});page.setDefaultTimeout(30000);
const requests=[],responses=[],rounds=[],errors=[],failures=[],runtimeLog=[];let sequence=0,lastPhase,failure,failureState,activeCase,activeBefore,activeTraceStart;
page.on('pageerror',e=>errors.push(e.message.slice(0,500)));
page.on('console',m=>{const t=m.text();if(/Set '|变量|mag_|过期|script error/i.test(t))runtimeLog.push(t.slice(0,2000));});
const requestIds=new Map(),pending=new Set(),responseTasks=[];
page.on('request',r=>{
 if(!r.url().endsWith('/api/backends/chat-completions/generate'))return;
 const id=++sequence;requestIds.set(r,id);pending.add(r);
 try{const d=r.postDataJSON();const contents=(d.messages||[]).map(m=>typeof m.content==='string'?m.content:JSON.stringify(m.content)).join('\n');
  requests.push({id,model:d.model,source:d.chat_completion_source,max_tokens:d.max_tokens,message_count:d.messages?.length,chars:contents.length,updateRulePresent:contents.includes('<UpdateVariable>'),currentStateMarkerPresent:contents.includes('status_current_variable'),unexpandedVariableMacro:contents.includes('{{get_message_variable::')});
 }catch{requests.push({id,error:'请求体无法解析'});}
});
page.on('response',r=>{
 const req=r.request(),id=requestIds.get(req);if(!id)return;
 const task=(async()=>{try{const body=await r.body();responses.push({id,status:r.status(),bodySha256:crypto.createHash('sha256').update(body).digest('hex'),...parseCompletionMetadata(body.toString('utf8'))});}catch{responses.push({id,status:r.status(),bodyUnavailable:true});}})();responseTasks.push(task);
});
for(const e of ['requestfinished','requestfailed'])page.on(e,r=>pending.delete(r));
const waitIdle=async()=>{const end=Date.now()+180000;while(pending.size){if(Date.now()>end)throw Error('模型请求未结束');await page.waitForTimeout(500);}await Promise.all(responseTasks);await page.waitForTimeout(1500);};
let replayCount=0;
if(replayMode)await page.route('**/api/backends/chat-completions/generate',async route=>{
 const key=['morning','patrol'][replayCount++];assert.ok(key,'未预期的第三次回放请求');
 const chunk=(delta,finish_reason=null)=>({id:'recorded-replay',object:'chat.completion.chunk',model:'recorded-reply',choices:[{index:0,delta,finish_reason}]});
 const body=[chunk({role:'assistant',content:fixture[key].replayText}),chunk({},'stop')].map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')+'data: [DONE]\n\n';
 await route.fulfill({status:200,contentType:'text/event-stream',body});
});
const checkpoint=async phase=>{lastPhase=phase;console.log('自然验证阶段：'+phase);await fs.writeFile(out+'/checkpoint.json',JSON.stringify({phase,rounds:rounds.length,requests,responses,errors},null,2));};
const limit=(p,ms,label)=>Promise.race([p,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error(label+'超时')),ms);t.unref();})]);
const evalNative=page.evaluate.bind(page);page.evaluate=(...args)=>limit(evalNative(...args),60000,'浏览器操作');
try{
 await checkpoint('opening native ST');await page.goto('http://127.0.0.1:8000');await page.waitForFunction(()=>window.TavernHelper);
 const onboarding=page.locator('dialog[open]').filter({has:page.locator('.onboarding')});
 await onboarding.waitFor({state:'visible',timeout:5000}).catch(()=>{});
 if(await onboarding.isVisible()){
  await onboarding.locator('.popup-input').fill('终端自然生成测试者');
  await onboarding.locator('.popup-button-ok').click();
  await onboarding.waitFor({state:'hidden'});
 }
 await checkpoint('importing card');const imported=await page.evaluate(async c=>{const csrf=await(await fetch('/csrf-token')).json();const fd=new FormData();fd.set('file_type','json');fd.set('avatar',new File([JSON.stringify(c)],'qidu-live.json',{type:'application/json'}));const r=await fetch('/api/characters/import',{method:'POST',headers:{'X-CSRF-Token':csrf.token},body:fd});if(!r.ok)throw Error('card import '+r.status);return r.json();},card);
 await page.evaluate(async version=>{const st=await import('/script.js');await st.getCharacters();const id=st.characters.findIndex(c=>c.data?.character_version===version);if(id<0)throw Error('missing imported card');st.setCharacterId(id);st.setCharacterName(st.characters[id].name);const regex=await import('/scripts/extensions/regex/engine.js');regex.allowScopedScripts(st.characters[id]);const pu=await import('/scripts/power-user.js');pu.power_user.world_import_dialog=false;const wi=await import('/scripts/world-info.js');$('#import_character_info').data('chid',id);await wi.importEmbeddedWorldInfo(true);},card.data.character_version);
 await checkpoint('native lorebook imported');
 if(await page.getByRole('button',{name:'收好纸条',exact:true}).isVisible())await page.getByRole('button',{name:'收好纸条',exact:true}).click();
 await page.locator('#API-status-top').click();await page.locator('#main_api').selectOption('openai');await page.locator('#chat_completion_source').selectOption('custom');
 await page.evaluate(async replay=>{const st=await import('/script.js'),o=await import('/scripts/openai.js');Object.assign(o.oai_settings,{chat_completion_source:'custom',custom_url:replay?'http://127.0.0.1:8000/replay-unused':'https://gcli.ggchan.dev/v1',custom_model:'gemini-3-flash-preview',stream_openai:true,openai_max_context:65000,openai_max_tokens:6000,custom_exclude_body:'[presence_penalty, frequency_penalty, top_p, top_k, temperature]',reverse_proxy:'',proxy_password:''});st.setOnlineStatus('Connected');},replayMode);
 await page.locator('#API-status-top').click();
 await page.evaluate(scripts=>{TavernHelper.replaceScriptTrees([],{type:'character'});TavernHelper.replaceScriptTrees(scripts,{type:'global'});},card.data.extensions.tavern_helper.scripts);
 await checkpoint('waiting real scripts');await page.waitForFunction(()=>window.Mvu&&window.f7dTacticalTerminal&&window.__F7D_MVU_GUARD__?.ready,null,{timeout:90000});

 await page.evaluate(()=>{const c=SillyTavern.getContext();c.extensionSettings.world_backstage.worldAutoEnabled=false;c.extensionSettings.world_backstage.publicOpinionAutoEnabled=false;});
 async function seed(id,completed){
  const state=structuredClone(init);Object.assign(state,{day:6,clock_minutes:480,location:'中央庭寝室',known:['安','安托涅瓦','晏华','希罗','珈儿','泰丝拉','赛哈姆']});
  state.regions.school.liberated=true;state.regions.east.liberated=true;state.cores.court='purified';state.route_flags.first_second_region='east';state.tasks.DAY7_OPENING.status='completed';
  state.morning_flags.day6_monologue=completed;state.morning_flags.day6_saiham=completed;state.intel_flags.chimera_exists_known=completed;state.intel_flags.hiro_chimera_research_known=completed;
  const scene=completed?'第六天晨间的小神低语、赛哈姆活骸化与希罗带离救治已经实际演完。你已拒绝替希罗保密。现在晨间事件结束，你和安在中央庭准备下一次行动，还没有巡查。':'第七天已完成高校救援和东方古街解放。你昨夜回中央庭休息，现在是第六天清晨，尚未醒来，晨间事件尚未发生。';
  await page.evaluate(async({state,scene,id})=>{const st=await import('/script.js');await st.clearChat();st.updateChatMetadata({},true);st.characters[st.this_chid].chat='formal-natural-'+id+'-'+Date.now();st.chat.splice(0,st.chat.length,{name:st.name2,is_user:false,is_system:false,mes:scene,swipe_id:0,variables:{0:{stat_data:state}}});await st.printMessages();
   const frame=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow?.__f7dCommitHook)?.contentWindow;if(!frame)throw Error('缺少真实提交钩子');
   await st.eventSource.emit(st.event_types?.CHAT_CHANGED||'chat_id_changed',st.getCurrentChatId?.());
   const d=Mvu.getMvuData({type:'message',message_id:0});if(!d.schema)throw Error('变量框架尚未初始化');Object.assign(d,{stat_data:state,display_data:structuredClone(state),delta_data:{}});await frame.replaceVariables(d,{type:'message',message_id:0});
  },{state,scene,id});
 }
 await page.evaluate(()=>{
  const c=SillyTavern.getContext();window.__timeline=[];window.__commands=[];window.__publications=[];window.__stale=[];
  const bridge=__f7dCommitBridge,oldPublish=bridge.publish,oldValid=bridge.valid;
  bridge.valid=t=>{const ok=oldValid(t);if(!ok)__stale.push({at:performance.now(),rejected:true});return ok;};
  bridge.publish=function(t,id,reader){const saved=reader({type:'message',message_id:id})?.stat_data;const result=oldPublish.call(this,t,id,reader);__publications.push({at:performance.now(),id,result,clock:saved?.clock_minutes,flags:structuredClone(saved?.morning_flags),status:f7dTacticalTerminal.getSnapshot().status});return result;};
  f7dTacticalTerminal.subscribe(s=>{const id=c.chat.length-1,saved=Mvu.getMvuData({type:'message',message_id:id})?.stat_data;__timeline.push({at:performance.now(),status:s.status,reason:s.reason,revision:s.snapshot?.revision,scope:s.snapshot?.scope,clock:saved?.clock_minutes,flags:structuredClone(saved?.morning_flags)});});
  const before=(v,cmd)=>__commands.push({phase:'before',at:performance.now(),commands:structuredClone(cmd)});
  c.eventSource.on(Mvu.events.COMMAND_PARSED,before);c.eventSource.makeFirst(Mvu.events.COMMAND_PARSED,before);
  c.eventSource.on(Mvu.events.COMMAND_PARSED,(v,cmd)=>__commands.push({phase:'after',at:performance.now(),commands:structuredClone(cmd)}));
 });
 let morningPassed=false;
 const cases=[
  {id:'morning',input:'继续第六天晨间剧情。我醒来后观察赛哈姆的异状，听希罗解释。我明确拒绝替他保密，但允许他先带走赛哈姆救治。请按眼前的真实顺序演到希罗和随行人员带着赛哈姆走出中央庭大门、离开整个中央庭区域，再收束晨间事件；仅从主廊移往其他房间不算实际离场。后续行动由我下一条消息决定。'},
  {id:'patrol',input:'我和安去中央庭各防区与外围走廊完成一轮巡查，处理现场警戒和后勤，然后回来向安托涅瓦汇报。完成这一次行动后停下，不继续执行下一项。'}
 ];
 for(const test of cases){
  const independent=test.id==='patrol'&&!morningPassed;
  if(test.id==='morning'||independent)await seed(test.id,test.id==='patrol');
  const before=await page.evaluate(()=>{const c=SillyTavern.getContext();return Mvu.getMvuData({type:'message',message_id:c.chat.length-1})?.stat_data;});
  const traceStart=await page.evaluate(()=>({timeline:__timeline.length,commands:__commands.length,publications:__publications.length,stale:__stale.length}));
  activeCase=test.id;activeBefore=before;activeTraceStart=traceStart;
  const requestStart=requests.length;
  await page.locator('#send_textarea').fill(test.input);await checkpoint('生成 '+test.id);
  await limit(evalNative(async()=>{const st=await import('/script.js');st.setOnlineStatus('Connected');await st.Generate('normal');}),180000,'原生自然生成');await waitIdle();
  await page.waitForFunction(()=>f7dTacticalTerminal.getSnapshot().status==='ready',null,{timeout:30000}).catch(()=>{});
  const data=await page.evaluate(start=>{const c=SillyTavern.getContext(),id=c.chat.length-1;return {text:c.chat[id]?.mes,is_user:c.chat[id]?.is_user,after:Mvu.getMvuData({type:'message',message_id:id})?.stat_data,terminal:f7dTacticalTerminal.getSnapshot(),timeline:__timeline.slice(start.timeline),commands:__commands.slice(start.commands),publications:__publications.slice(start.publications),stale:__stale.slice(start.stale),guard:structuredClone(__F7D_MVU_GUARD__)};},traceStart);
  const requestIds=requests.slice(requestStart).map(x=>x.id),modelResponses=responses.filter(x=>requestIds.includes(x.id));
  const check=(label,value)=>({label,passed:Boolean(value)});
  const checks=[check(replayMode?'实际触发原生回放':'实际发出原生模型请求',requestIds.length===1),check('收到助手正文',!data.is_user&&data.text?.length>0),check('提交后终端就绪',data.terminal.status==='ready'),check('生成期间立即清空',data.timeline.some(x=>x.status==='empty')),check('正常提交无过期拒绝',data.stale.length===0),check('真实消息提交后才通知',data.timeline.filter(x=>x.status==='ready').length>0&&data.timeline.filter(x=>x.status==='ready').every(x=>x.clock===data.after?.clock_minutes)),check('终端未暴露内部字段',!/(npc_intel|loop_truth_known|hiro_chimera_research_known|route_flags)/.test(JSON.stringify(data.terminal)))];
  if(test.id==='morning')checks.push(check('晨间独白结算',data.after?.morning_flags?.day6_monologue===true),check('赛哈姆离场结算',data.after?.morning_flags?.day6_saiham===true),check('晨间不扣时',data.after?.clock_minutes===480));
  else checks.push(check('巡查实际扣80分钟',data.after?.clock_minutes===before.clock_minutes+80));
  checks.push(check('模型完成元数据正常结束',modelResponses.length===1&&modelResponses[0].status===200&&modelResponses[0].finishReasonKnown&&modelResponses[0].finishReasons.every(x=>x.reason==='stop')&&modelResponses[0].doneSeen&&!modelResponses[0].truncated));
  if(test.id==='patrol')checks.push(check('与晨间自然连续未重新播种',!independent));
  const row={id:test.id,independentSeed:independent,user:test.input,before,...data,requests:requests.slice(requestStart),responses:modelResponses,hasUpdateVariable:/<UpdateVariable>/i.test(data.text||''),checks,passed:checks.every(x=>x.passed)};
  rounds.push(row);if(test.id==='morning')morningPassed=row.passed;
  for(const x of checks)if(!x.passed)failures.push({case:test.id,label:x.label});
  await fs.writeFile(out+'/'+test.id+'.json',JSON.stringify(row,null,2));await page.screenshot({path:out+'/'+test.id+'.jpg',type:'jpeg',quality:90,fullPage:true});await checkpoint('完成 '+test.id);
 }
}catch(e){failure={message:e.message,phase:lastPhase,stack:e.stack};
 if(activeTraceStart)failureState=await page.evaluate(start=>{const c=SillyTavern.getContext(),id=c.chat.length-1;return {messageId:id,isUser:c.chat[id]?.is_user,after:Mvu.getMvuData({type:'message',message_id:id})?.stat_data,terminal:f7dTacticalTerminal.getSnapshot(),timeline:__timeline.slice(start.timeline),commands:__commands.slice(start.commands),publications:__publications.slice(start.publications),stale:__stale.slice(start.stale)};},activeTraceStart).then(data=>({case:activeCase,before:activeBefore,...data})).catch(err=>({captureFailed:true,message:err.message}));
 await Promise.all(responseTasks); await checkpoint('阻塞 '+e.message);await page.screenshot({path:out+'/blocked.jpg',type:'jpeg',quality:90}).catch(()=>{});}
await fs.writeFile(out+'/terminal-live.json',JSON.stringify({candidate:'0.4.41-terminal-v1.0.3',candidateSha256:cardSha,baselineDeliveryCommit:'4cd2f36b740ba46a2b5d11bfb18fe4a211b146cf',deliveryRevision:'1.0.3',model:'gemini-3-flash-preview',maxTokens:6000,naturalGeneration:!replayMode,controlledReplay:replayMode,phoneInstalled:false,cardModified:false,rounds,requests,responses,errors,failures,failure,failureState,runtimeLog},null,2));
await browser.close();if(failure||failures.length)throw Error(failure?.message||failures.map(x=>x.case+':'+x.label).join('；'));
