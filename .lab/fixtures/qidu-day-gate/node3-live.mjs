import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const out='.lab/fixtures/qidu-day-gate/node3-live';
await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
const branchCase=process.env.NODE3_CASE||'east-first';
if(!['east-first','central-first'].includes(branchCase))throw Error('unknown NODE3_CASE '+branchCase);

const card=JSON.parse(await fs.readFile('.lab/fixtures/qidu-day-gate/Qidu-v0.4.49-node3-day6-second-region.json','utf8'));
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/https:\/\/gcore\.jsdelivr\.net\/gh\/MagicalAstrogy\/MagVarUpdate@[^']+/, '/f7d-mvu.js');
for(const script of card.data.extensions.tavern_helper.scripts)if(script.content.includes("host[KEY]={version:1,allow,dispose}"))script.content=script.content.replace("host[KEY]={version:1,allow,dispose}","host[KEY]={version:1,allow,dispose,state}");
const init=JSON.parse(card.data.character_book.entries.find(e=>e.comment.includes('[InitVar]')).content);

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1080,height:2500}});
page.setDefaultTimeout(30000);
const rounds=[],requests=[],apiResponses=[],errors=[];
page.on('pageerror',e=>errors.push(e.message.slice(0,500)));
page.on('request',r=>{
  if(r.url().endsWith('/api/backends/chat-completions/generate')){
    try{
      const d=r.postDataJSON();
      requests.push({model:d.model,source:d.chat_completion_source,message_count:d.messages?.length,chars:JSON.stringify(d.messages).length});
    }catch{}
  }
});
page.on('response',async r=>{
  if(r.url().endsWith('/api/backends/chat-completions/generate')){
    let body='';
    try{body=(await r.text()).slice(0,2500)}catch{}
    apiResponses.push({status:r.status(),body});
  }
});
const pending=new Set();
page.on('request',r=>{if(r.url().endsWith('/api/backends/chat-completions/generate'))pending.add(r)});
for(const evt of ['requestfinished','requestfailed'])page.on(evt,r=>pending.delete(r));
const waitIdle=async()=>{
  const deadline=Date.now()+180000;
  while(pending.size){
    if(Date.now()>deadline)throw Error('native background requests timeout');
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(800);
};
const limit=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error(label+' timeout')),ms);t.unref()})]);
const evalNative=page.evaluate.bind(page);
page.evaluate=(...args)=>limit(evalNative(...args),60000,'native page operation');

let failure=null;
try{
  await page.goto('http://127.0.0.1:8000');
  await page.waitForFunction(()=>window.TavernHelper);
  if(await page.locator('dialog:visible .popup-button-ok').count())await page.locator('dialog:visible .popup-button-ok').last().click();

  await page.evaluate(async c=>{
    const csrf=await(await fetch('/csrf-token')).json();
    const fd=new FormData();
    fd.set('file_type','json');
    fd.set('avatar',new File([JSON.stringify(c)],'qidu-node3.json',{type:'application/json'}));
    const r=await fetch('/api/characters/import',{method:'POST',headers:{'X-CSRF-Token':csrf.token},body:fd});
    if(!r.ok)throw Error('card import '+r.status);
  },card);

  await page.evaluate(async version=>{
    const st=await import('/script.js');
    await st.getCharacters();
    const id=st.characters.findIndex(c=>c.data?.character_version===version);
    if(id<0)throw Error('missing imported card');
    st.setCharacterId(id);
    st.setCharacterName(st.characters[id].name);
    const regex=await import('/scripts/extensions/regex/engine.js');
    regex.allowScopedScripts(st.characters[id]);
    const pu=await import('/scripts/power-user.js');
    pu.power_user.world_import_dialog=false;
    const wi=await import('/scripts/world-info.js');
    $('#import_character_info').data('chid',id);
    await wi.importEmbeddedWorldInfo(true);
  },card.data.character_version);

  if(await page.getByRole('button',{name:'收好纸条',exact:true}).isVisible())await page.getByRole('button',{name:'收好纸条',exact:true}).click();
  await page.locator('#API-status-top').click();
  await page.locator('#main_api').selectOption('openai');
  await page.locator('#chat_completion_source').selectOption('custom');
  await page.evaluate(async()=>{
    const st=await import('/script.js'),o=await import('/scripts/openai.js');
    Object.assign(o.oai_settings,{
      chat_completion_source:'custom',
      custom_url:'https://gcli.ggchan.dev/v1',
      custom_model:'gemini-3-flash-preview',
      stream_openai:false,
      openai_max_context:65000,
      openai_max_tokens:4096,
      custom_exclude_body:'[presence_penalty, frequency_penalty, top_p, top_k, temperature]',
      reverse_proxy:'',
      proxy_password:''
    });
    st.setOnlineStatus('Connected');
  });
  await page.locator('#API-status-top').click();
  await page.evaluate(scripts=>{
    TavernHelper.replaceScriptTrees([],{type:'character'});
    TavernHelper.replaceScriptTrees(scripts,{type:'global'});
  },card.data.extensions.tavern_helper.scripts);
  await page.waitForFunction(()=>window.Mvu&&window.f7dDayGate&&window.f7dTacticalTerminal,{timeout:90000});
  await page.evaluate(()=>{
    const c=SillyTavern.getContext();
    c.extensionSettings.world_backstage.worldAutoEnabled=false;
    c.extensionSettings.world_backstage.publicOpinionAutoEnabled=false;
  });

  const target=branchCase==='east-first'?'central':'east';
  const targetName=target==='central'?'中央城区':'东方古街';
  const first=branchCase==='east-first'?'east':'central';
  const state=structuredClone(init);
  Object.assign(state,{day:6,clock_minutes:560,location:'中央庭办公室'});
  state.tasks.DAY7_OPENING.status='completed';
  state.tasks.SCHOOL_RESCUE.status='completed';
  state.tasks.SECOND_REGION.status='completed';
  state.regions.school.liberated=true;
  state.cores.court='purified';
  state.morning_flags.day6_monologue=true;
  state.morning_flags.day6_saiham=true;
  state.intel_flags.chimera_exists_known=true;
  state.intel_flags.first_chimera_incident_known=true;
  state.route_flags.first_second_region=first;
  state.regions[first].liberated=true;
  state.regions[target].liberated=false;
  state.cores[target]='unknown';

  if(branchCase==='east-first'){
    state.route_flags.oldstreet_delayed=false;
    state.route_flags.wenzi_injured=false;
    state.route_flags.wenzi_joined=true;
    state.known=['安','安托涅瓦','晏华','珈儿','泰丝拉','雯梓','钟函谷','赛斯'];
  }else{
    state.route_flags.oldstreet_delayed=true;
    state.route_flags.wenzi_injured=false;
    state.route_flags.wenzi_joined=false;
    state.known=['安','安托涅瓦','晏华','珈儿','泰丝拉','赛斯','妮维','丽','莱奥斯'];
  }

  const scene='第六天清晨的赛哈姆事件已经结束，你也已经向安托涅瓦完整报告。现在报告刚结束，行动权重新回到你手中。';
  await page.evaluate(async({state,scene,branchCase})=>{
    const st=await import('/script.js');
    await st.clearChat();
    st.updateChatMetadata({},true);
    st.characters[st.this_chid].chat='native-node3-'+branchCase;
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
  },{state,scene,branchCase});

  const generateTurn=async(user,label)=>{
    const before=await page.evaluate(()=>{
      const c=SillyTavern.getContext();
      return structuredClone(Mvu.getMvuData({type:'message',message_id:c.chat.length-1}).stat_data);
    });
    const requestStart=requests.length;
    await page.locator('#send_textarea').fill(user);
    let done=false,last;
    for(let attempt=1;attempt<=3;attempt++){
      try{
        await limit(evalNative(async()=>{
          const st=await import('/script.js');
          st.setOnlineStatus('Connected');
          await st.Generate('normal');
        }),180000,label+' generation '+attempt);
        done=true;break;
      }catch(e){
        last=e;
        await page.screenshot({path:out+'/'+branchCase+'-'+label+'-attempt'+attempt+'.jpg',type:'jpeg',quality:78}).catch(()=>{});
        if(attempt<3){
          await page.evaluate(input=>{
            const c=SillyTavern.getContext(),last=c.chat.at(-1);
            if(last?.is_user&&String(last.mes||'')===input){
              c.chat.pop();
              document.querySelector('#chat .mes:last-of-type')?.remove();
            }
          },user).catch(()=>{});
          await page.locator('#send_textarea').fill(user);
          await page.waitForTimeout(12000*attempt);
        }
      }
    }
    if(!done)throw last;
    await waitIdle();
    const data=await page.evaluate(()=>{
      const c=SillyTavern.getContext(),n=c.chat.length-1;
      return {
        text:c.chat[n]?.mes,
        is_user:c.chat[n]?.is_user,
        variables:Mvu.getMvuData({type:'message',message_id:n}),
        terminal:window.f7dTacticalTerminal?.getSnapshot?.()
      };
    });
    if(requests.length===requestStart)throw Error('no real model request for '+label);
    if(requests.slice(requestStart).some(r=>r.model!=='gemini-3-flash-preview'))throw Error('wrong model for '+label);
    if(data.is_user||!data.text)throw Error('missing assistant reply '+label);
    if(data.variables?.stat_data?.day!==6)throw Error('left Day 6 during '+label);
    if(data.terminal?.status!=='ready')throw Error('terminal not ready '+label);
    return {before,after:data.variables.stat_data,text:String(data.text||''),terminal:data.terminal,requests:requests.slice(requestStart)};
  };

  const travelInput=branchCase==='east-first'
    ?'安托涅瓦的报告结束了。我现在从中央庭出发前往中央城区。这一次只完成跨区移动、抵达和现场接触，不开始第一轮巡查。'
    :'安托涅瓦的报告结束了。我现在从中央庭出发前往东方古街。这一次只完成跨区移动、抵达和现场接触，不开始第一轮巡查。';
  const travel=await generateTurn(travelInput,'travel');
  if(travel.after.clock_minutes!==640)throw Error(branchCase+' travel clock '+travel.after.clock_minutes+' expected 640');
  if(travel.after.route_flags?.first_second_region!==first)throw Error(branchCase+' first_second_region mutated during travel');
  if(travel.after.regions?.[target]?.liberated!==false)throw Error(branchCase+' target region liberated during travel');
  if(travel.after.cores?.[target]==='purified')throw Error(branchCase+' target black core purified during travel');
  if(!String(travel.after.location||'').startsWith(targetName))throw Error(branchCase+' travel did not arrive in target region: '+travel.after.location);
  if(branchCase==='east-first'){
    if(!/赛斯/.test(travel.text))throw Error('Central City arrival did not actually feature Seth');
    if(travel.after.morning_flags?.day6_seth!==true)throw Error('Seth flag not committed on Central City arrival');
    if(travel.after.route_flags?.oldstreet_delayed!==false)throw Error('east-first wrongly delayed Old Street during travel');
    if(travel.after.route_flags?.wenzi_injured!==false)throw Error('east-first wrongly injured Wenzi during travel');
    if(travel.after.route_flags?.wenzi_joined!==true)throw Error('east-first lost Wenzi joined state during travel');
  }else{
    if(!/雯梓/.test(travel.text))throw Error('Old Street arrival did not establish Wenzi');
    if(travel.after.route_flags?.oldstreet_delayed!==true)throw Error('central-first lost Old Street delay during travel');
    if(travel.after.route_flags?.wenzi_injured!==false)throw Error('Wenzi injured during travel before third patrol');
    if(travel.after.route_flags?.wenzi_joined!==false)throw Error('delayed Wenzi incorrectly joined during travel');
  }
  rounds.push({case:branchCase,kind:'travel',round:0,user:travelInput,before:travel.before,after:travel.after,text:travel.text,terminal:travel.terminal,requests:travel.requests.map(r=>({model:r.model,source:r.source,chars:r.chars}))});
  await page.screenshot({path:out+'/'+branchCase+'-travel.jpg',type:'jpeg',quality:88,fullPage:true});

  const talk=branchCase==='east-first'
    ?'我先不开始巡查，只问赛斯一句：你刚才看到的异常最先从哪个方向出现？'
    :'我先不开始巡查，只问眼前的雯梓一句：五行阵现在最明显的异常表现在哪里？';
  const q=await generateTurn(talk,'short-talk');
  if(q.after.clock_minutes!==640)throw Error(branchCase+' short dialogue consumed time');
  if(q.after.regions?.[target]?.liberated!==false)throw Error(branchCase+' short dialogue advanced liberation');
  rounds.push({case:branchCase,kind:'short-talk',round:0,user:talk,before:q.before,after:q.after,text:q.text,terminal:q.terminal,requests:q.requests.map(r=>({model:r.model,source:r.source,chars:r.chars}))});
  await page.screenshot({path:out+'/'+branchCase+'-short-talk.jpg',type:'jpeg',quality:85,fullPage:true});

  const inputs=[
    branchCase==='east-first'
      ?'现在开始中央城区第一轮巡查，继续处理眼前居民、治安和怪物问题，只推进这一轮。'
      :'现在开始东方古街第一轮巡查，继续确认居民防线和五行阵当前状态，只推进这一轮。',
    '继续第二轮巡查，沿着已经得到的现场线索推进，不跳过中间过程。',
    '继续第三轮巡查，处理这一阶段真正发生的危机和人物状态。',
    '继续第四轮巡查，按当前线索深入，不替我一次性完成整区。',
    '继续第五轮巡查，逼近地区核心危机，但仍只执行这一轮行动。',
    '继续第六轮巡查，完成这个地区当前主线的核心冲突；如果已经真正满足条件，再结算地区解放，黑核不要顺手净化。'
  ];

  const texts=[];
  for(let i=0;i<inputs.length;i++){
    const turn=await generateTurn(inputs[i],'patrol-'+(i+1));
    const expected=640+(i+1)*80;
    if(turn.after.clock_minutes!==expected)throw Error(branchCase+' patrol '+(i+1)+' clock '+turn.after.clock_minutes+' expected '+expected);
    if(turn.after.route_flags?.first_second_region!==first)throw Error(branchCase+' first_second_region mutated on patrol '+(i+1));
    if(turn.after.regions?.[first]?.liberated!==true)throw Error(branchCase+' first region regressed');
    if(i<5&&turn.after.regions?.[target]?.liberated!==false)throw Error(branchCase+' target region liberated before sixth patrol');
    if(i===5&&turn.after.regions?.[target]?.liberated!==true)throw Error(branchCase+' target region not liberated on sixth patrol');
    if(turn.after.cores?.[target]==='purified')throw Error(branchCase+' target black core purified during six-patrol liberation chain');
    if(i<5&&/(?:整(?:个)?地区|整(?:个)?城区|整(?:个)?古街|中央城区|东方古街)[^。\n]{0,80}(?:已经|正式|彻底)?(?:解放|危机解除)/.test(turn.text))throw Error(branchCase+' prose claimed full liberation before sixth patrol '+(i+1));
    texts.push(turn.text);

    if(branchCase==='east-first'){
      if(turn.after.morning_flags?.day6_seth!==true)throw Error('Seth flag regressed after Central City patrol '+(i+1));
      if(turn.after.route_flags?.oldstreet_delayed!==false)throw Error('east-first wrongly delayed Old Street');
      if(turn.after.route_flags?.wenzi_injured!==false)throw Error('east-first wrongly injured Wenzi');
      if(turn.after.route_flags?.wenzi_joined!==true)throw Error('east-first lost Wenzi joined state');
    }else{
      if(turn.after.route_flags?.oldstreet_delayed!==true)throw Error('central-first lost Old Street delay');
      if(i<2&&turn.after.route_flags?.wenzi_injured!==false)throw Error('Wenzi injured too early before third Old Street patrol');
      if(i>=2&&turn.after.route_flags?.wenzi_injured!==true)throw Error('Wenzi injury not committed from third Old Street patrol');
      if(turn.after.route_flags?.wenzi_joined!==false)throw Error('delayed Wenzi incorrectly joined');
    }

    rounds.push({case:branchCase,kind:'patrol',round:i+1,user:inputs[i],before:turn.before,after:turn.after,text:turn.text,terminal:turn.terminal,requests:turn.requests.map(r=>({model:r.model,source:r.source,chars:r.chars}))});
    await page.screenshot({path:out+'/'+branchCase+'-patrol-'+(i+1)+'.jpg',type:'jpeg',quality:88,fullPage:true});
  }

  const full=texts.join('\n\n');
  if(branchCase==='east-first'){
    const sethMentions=[travel.text,...texts.slice(0,4)].filter(t=>/赛斯/.test(t)).length;
    if(sethMentions<2)throw Error('Seth did not remain involved after Central City arrival');
    if(!/莱奥斯/.test(texts.slice(0,3).join('\n')))throw Error('Central City branch missed Leios by patrol 3');
    if(!/丽/.test(texts.slice(1,4).join('\n')))throw Error('Central City branch missed Li by patrol 4');
    if(!/妮维/.test(texts.slice(0,4).join('\n')))throw Error('Central City branch missed Nive by patrol 4');
    if(!/利维坦/.test(texts[5]))throw Error('Central City sixth patrol did not resolve Leviathan');
  }else{
    if(!/雯梓/.test(travel.text))throw Error('Old Street arrival did not establish Wenzi');
    if(!/钟函谷/.test(texts.slice(0,2).join('\n')))throw Error('Old Street branch missed Zhong Hanggu by patrol 2');
    if(!/达尔维拉/.test(texts[2])||!/雯梓[\s\S]{0,500}(?:受伤|负伤|伤势|受创|流血|吐血)/.test(texts[2]))throw Error('Old Street third patrol did not show Darvilla causing Wenzi injury');
  }

  const final=rounds.filter(r=>r.kind==='patrol').at(-1).after;
  if(final.clock_minutes!==1120)throw Error(branchCase+' travel plus six patrols did not end at 18:40');
  const snap=rounds.filter(r=>r.kind==='patrol').at(-1).terminal?.snapshot;
  if(snap?.header?.timeLabel!=='18:40')throw Error(branchCase+' terminal time did not update to 18:40');
  if(!String(snap?.header?.location||'').startsWith(targetName))throw Error(branchCase+' terminal location not in target region: '+snap?.header?.location);

  await page.evaluate(()=>{
    const chat=document.querySelector('#chat');
    if(!chat)return;
    chat.style.height=chat.scrollHeight+'px';
    chat.style.maxHeight='none';
    chat.style.overflow='visible';
  });
  await page.waitForTimeout(400);
  await page.locator('#chat').screenshot({path:out+'/'+branchCase+'-full.jpg',type:'jpeg',quality:90});

  await fs.writeFile(out+'/'+branchCase+'.json',JSON.stringify({
    model:'gemini-3-flash-preview',
    native:true,
    case:branchCase,
    target,
    assertions:{
      sixPatrols:true,
      shortDialogueNoTime:true,
      exact80MinutesEach:true,
      noEarlyLiberation:true,
      sixthLiberation:true,
      blackCoreNotPurified:true,
      separateTravelNode:true,
      terminalAt1840:true,
      sethArrivalAndRecurring:branchCase==='east-first',
      niveByFourth:branchCase==='east-first',
      leviathanSixth:branchCase==='east-first',
      delayedWenziInjuryThird:branchCase==='central-first',
      wenziNotJoined:branchCase==='central-first'
    },
    rounds,apiResponses,errors
  },null,2));
}catch(e){
  failure={message:e.message,stack:e.stack};
  await page.screenshot({path:out+'/'+branchCase+'-blocked.jpg',type:'jpeg',quality:88,fullPage:true}).catch(()=>{});
  await fs.writeFile(out+'/'+branchCase+'.json',JSON.stringify({model:'gemini-3-flash-preview',native:true,case:branchCase,rounds,apiResponses,errors,failure},null,2));
}
await fs.writeFile(out+'/'+branchCase+'-requests.json',JSON.stringify(requests,null,2));
await browser.close();
if(failure)throw Error(failure.message);
