import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {parseCompletionMetadata} from './response-metadata.mjs';
const root='.lab/fixtures/f7d-terminal-commit-fix';
const variant=process.env.COMMIT_VARIANT||'fixed';
assert.ok(['baseline','fixed'].includes(variant));
const fixture=JSON.parse(await fs.readFile(root+'/replay-fixture.json','utf8'));
const out=root+'/results/'+variant;await fs.mkdir(out,{recursive:true});
const raw=await fs.readFile('.lab/fixtures/f7d-terminal-v1-formal/Qidu-v0.4.41-terminal-v1.json');
const cardSha=crypto.createHash('sha256').update(raw).digest('hex');
assert.equal(cardSha,'f5960e062eadfb3d57528dce928730aff3c479a2dd02d4c3b8cc7ad192ac05da','正式候选卡散列不符');
const card=JSON.parse(raw);
if(variant==='fixed'){
 const script=card.data.extensions.tavern_helper.scripts.find(s=>s.id==='qidu-terminal-provider-v1');
 const old="String(m.mes || '').replace(/<StatusPlaceHolderImpl\\/>/g, '')";
 assert.equal(script.content.split(old).length,2);
 script.content=script.content.replace(old,old+'.trimEnd()');
}
assert.equal(card.data.character_version,'0.4.41-terminal-v1');
// 仅将固定版本的远程模块地址换为同一产物的本地地址。
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/https:\/\/gcore\.jsdelivr\.net\/gh\/MagicalAstrogy\/MagVarUpdate@[^']+/, '/f7d-mvu.js');
const init=JSON.parse(card.data.character_book.entries.find(e=>e.comment.includes('[InitVar]')).content);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1080,height:1600}});page.setDefaultTimeout(30000);
const requests=[],responses=[],rounds=[],errors=[],failures=[],runtimeLog=[];let sequence=0,lastPhase,failure;
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
await page.route('**/api/backends/chat-completions/generate',async route=>{
 const key=['morning','patrol'][replayCount++];assert.ok(key,'未预期的第三次请求');
 const text=fixture[key].replayText;
 const chunk=(delta,finish_reason=null)=>({id:'recorded-replay',object:'chat.completion.chunk',model:'recorded-reply',choices:[{index:0,delta,finish_reason}]});
 const body=[chunk({role:'assistant',content:text}),chunk({},'stop')].map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')+'data: [DONE]\n\n';
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
 await page.evaluate(async()=>{const st=await import('/script.js'),o=await import('/scripts/openai.js');Object.assign(o.oai_settings,{chat_completion_source:'custom',custom_url:'http://127.0.0.1:8000/replay-unused',custom_model:'gemini-3-flash-preview',stream_openai:true,openai_max_context:65000,openai_max_tokens:6000,custom_exclude_body:'[presence_penalty, frequency_penalty, top_p, top_k, temperature]',reverse_proxy:'',proxy_password:''});st.setOnlineStatus('Connected');});
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
  bridge.valid=t=>{const ok=oldValid(t);if(!ok){const now=bridge.capture(),old=t?.signature?JSON.parse(t.signature):null,current=JSON.parse(now.signature);__stale.push({at:performance.now(),rejected:true,epochMatch:t?.epoch===now.epoch,chatMatch:t?.chatId===now.chatId,characterMatch:old?.[1]===current[1],groupMatch:old?.[2]===current[2],messageCountMatch:old?.[3]?.length===current[3].length,messages:current[3].map((m,i)=>({index:i,identityMatch:old?.[3]?.[i]?.[0]===m[0],swipeMatch:old?.[3]?.[i]?.[1]===m[1],textMatch:old?.[3]?.[i]?.[2]===m[2],trimmedTextMatch:old?.[3]?.[i]?.[2]?.trimEnd()===m[2].trimEnd(),oldLength:old?.[3]?.[i]?.[2]?.length,newLength:m[2].length,oldTrailing:old?.[3]?.[i]?.[2]?.match(/\s*$/)?.[0],newTrailing:m[2].match(/\s*$/)?.[0]}))});}return ok;};
  bridge.publish=function(t,id,reader){const saved=reader({type:'message',message_id:id})?.stat_data;const result=oldPublish.call(this,t,id,reader);__publications.push({at:performance.now(),id,result,clock:saved?.clock_minutes,flags:structuredClone(saved?.morning_flags),status:f7dTacticalTerminal.getSnapshot().status});return result;};
  f7dTacticalTerminal.subscribe(s=>{const id=c.chat.length-1,saved=Mvu.getMvuData({type:'message',message_id:id})?.stat_data;__timeline.push({at:performance.now(),status:s.status,reason:s.reason,revision:s.snapshot?.revision,scope:s.snapshot?.scope,clock:saved?.clock_minutes,flags:structuredClone(saved?.morning_flags)});});
  const before=(v,cmd)=>__commands.push({phase:'before',at:performance.now(),commands:structuredClone(cmd)});
  c.eventSource.on(Mvu.events.COMMAND_PARSED,before);c.eventSource.makeFirst(Mvu.events.COMMAND_PARSED,before);
  c.eventSource.on(Mvu.events.COMMAND_PARSED,(v,cmd)=>__commands.push({phase:'after',at:performance.now(),commands:structuredClone(cmd)}));
 });
 let morningPassed=false;
 const cases=[
  {id:'morning',input:'继续第六天晨间剧情。我醒来后观察赛哈姆的异状，听希罗解释。我明确拒绝替他保密，但允许他先带走赛哈姆救治。请按眼前的真实顺序演到赛哈姆实际离开中央庭、晨间事件收束，后续行动由我下一条消息决定。'},
  {id:'patrol',input:'我和安去中央庭各防区与外围走廊完成一轮巡查，处理现场警戒和后勤，然后回来向安托涅瓦汇报。完成这一次行动后停下，不继续执行下一项。'}
 ];
 for(const test of cases){
  const independent=test.id==='patrol';
  if(test.id==='morning'||independent)await seed(test.id,test.id==='patrol');
  const before=await page.evaluate(()=>{const c=SillyTavern.getContext();return Mvu.getMvuData({type:'message',message_id:c.chat.length-1})?.stat_data;});
  const traceStart=await page.evaluate(()=>({timeline:__timeline.length,commands:__commands.length,publications:__publications.length,stale:__stale.length}));
  const requestStart=requests.length;
  await page.locator('#send_textarea').fill(test.input);await checkpoint('生成 '+test.id);
  await limit(evalNative(async()=>{const st=await import('/script.js');st.setOnlineStatus('Connected');await st.Generate('normal');}),180000,'原生自然生成');await waitIdle();
  await page.waitForTimeout(1000);
  const data=await page.evaluate(start=>{const c=SillyTavern.getContext(),id=c.chat.length-1;return {text:c.chat[id]?.mes,is_user:c.chat[id]?.is_user,after:Mvu.getMvuData({type:'message',message_id:id})?.stat_data,terminal:f7dTacticalTerminal.getSnapshot(),timeline:__timeline.slice(start.timeline),commands:__commands.slice(start.commands),publications:__publications.slice(start.publications),stale:__stale.slice(start.stale),guard:structuredClone(__F7D_MVU_GUARD__)};},traceStart);
  const requestIds=requests.slice(requestStart).map(x=>x.id),modelResponses=responses.filter(x=>requestIds.includes(x.id));
  const check=(label,value)=>({label,passed:Boolean(value)});
  const checks=[check('原生酒馆生成入口实际执行',requestIds.length===1),check('回放正文一致',data.text.replace(/<StatusPlaceHolderImpl\/>/g,'').trimEnd()===fixture[test.id].replayText.trimEnd()),check('生成立即清空',data.timeline.some(x=>x.status==='empty')),check('未泄露内部字段',!/(npc_intel|loop_truth_known|hiro_chimera_research_known|route_flags)/.test(JSON.stringify(data.terminal)))];
  if(variant==='baseline')checks.push(check('复现提交取消',data.stale.length>0&&data.after===undefined&&data.terminal.status==='empty'),check('票据仅尾部空白不同',data.stale.every(x=>x.epochMatch&&x.chatMatch&&x.characterMatch&&x.groupMatch&&x.messageCountMatch&&x.messages.every(m=>m.identityMatch&&m.swipeMatch&&m.trimmedTextMatch)&&x.messages.some(m=>!m.textMatch))));
  else {
   checks.push(check('真实提交后终端就绪',data.terminal.status==='ready'&&!!data.after),check('正常事务没有过期拒绝',data.stale.length===0),check('ready时已提交',data.timeline.filter(x=>x.status==='ready').every(x=>Number.isInteger(x.clock))));
   if(test.id==='morning')checks.push(check('晨间守卫保持原样独白漏判仍记录',data.after?.morning_flags?.day6_monologue===false),check('赛哈姆命令真实提交',data.after?.morning_flags?.day6_saiham===true),check('晨间不扣时',data.after?.clock_minutes===480));
   else checks.push(check('巡查真实写入80分钟',data.after?.clock_minutes===560&&data.terminal.snapshot?.header.timeLabel==='09:20'));
  }
  const row={id:test.id,independentSeed:independent,user:test.input,before,...data,requests:requests.slice(requestStart),responses:modelResponses,hasUpdateVariable:/<UpdateVariable>/i.test(data.text||''),checks,passed:checks.every(x=>x.passed)};
  rounds.push(row);if(test.id==='morning')morningPassed=row.passed;
  for(const x of checks)if(!x.passed)failures.push({case:test.id,label:x.label});
  await fs.writeFile(out+'/'+test.id+'.json',JSON.stringify(row,null,2));await page.screenshot({path:out+'/'+test.id+'.jpg',type:'jpeg',quality:90,fullPage:true});await checkpoint('完成 '+test.id);
 }
}catch(e){failure={message:e.message,phase:lastPhase,stack:e.stack};await checkpoint('阻塞 '+e.message);await page.screenshot({path:out+'/blocked.jpg',type:'jpeg',quality:90}).catch(()=>{});}
await fs.writeFile(out+'/commit-replay.json',JSON.stringify({candidate:'0.4.41-terminal-v1',candidateSha256:cardSha,officialDeliveryCommit:'4cd2f36b740ba46a2b5d11bfb18fe4a211b146cf',model:'gemini-3-flash-preview',maxTokens:6000,naturalGeneration:false,controlledReplay:true,variant,phoneInstalled:false,cardModified:variant==='fixed',rounds,requests,responses,errors,failures,failure,runtimeLog},null,2));
await browser.close();if(failure||failures.length)throw Error(failure?.message||failures.map(x=>x.case+':'+x.label).join('；'));
