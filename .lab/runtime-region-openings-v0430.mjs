import fs from 'node:fs/promises';
import {loadQiduReleaseCandidate} from './qidu-card-v0424-cg-candidate.mjs';
import {addMvuCot} from './qidu-card-v0425-mvu-cot.mjs';
import {repairQiduCard} from './qidu-card-v0426-repair.mjs';
import {addPresetChoiceCompatibility} from './qidu-card-preset-compat-v0427.mjs';
import {addMorningClockHud} from './qidu-card-morning-hud-v0428.mjs';
import {limitCountdownNarration} from './qidu-card-countdown-v0429.mjs';
import {guardRegionAndShortTalk,VERSION} from './qidu-card-region-time-guard-v0430.mjs';

const {card:base}=await loadQiduReleaseCandidate(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const card=guardRegionAndShortTalk(limitCountdownNarration(addMorningClockHud(addPresetChoiceCompatibility(repairQiduCard(addMvuCot(base))))));
if(process.env.LAB_MVU_LOCAL==='1')card.data.extensions.tavern_helper.scripts.find(x=>x.id==='qidu-v0425-mvu').content="import '/scripts/extensions/third-party/qidu-mvu/bundle.js'";
const key=process.env.MODEL_API_KEY||'';
const replay=process.env.LAB_REPLAY_JSON?JSON.parse(await fs.readFile(process.env.LAB_REPLAY_JSON,'utf8')):null;
if(!key&&!replay)throw Error('Model API key missing');
const apiBase=process.env.MODEL_API_BASE||'https://gcli.ggchan.dev/v1';
const endpoint=apiBase+'/chat/completions';
const listed=replay?null:await fetch(apiBase+'/models',{headers:{Authorization:`Bearer ${key}`}});
if(listed&&!listed.ok)throw Error(`Model list HTTP ${listed.status}`);
const modelList=listed?await listed.json():{};const ids=(modelList.data||modelList.models||[]).map(x=>typeof x==='string'?x:x.id||x.name).filter(Boolean);
const requested=process.env.RELEASE_MODEL||'gemini-3-flash-preview';
const model=replay?.model|| (ids.includes(requested)?requested:ids.find(x=>/gemini.*flash/i.test(x))||ids.find(x=>/glm.*flash/i.test(x))||ids.find(x=>/deepseek.*flash/i.test(x)));
if(!model)throw Error('No suitable available model in authenticated model list');
const entries=card.data.character_book.entries;
const related=entries.filter(e=>e.constant||[4,10,11,31,32,41,42,46,47,49,50,51,52,91].includes(e.id)).map(e=>e.content).join('\n\n');
const system=[card.data.personality,card.data.scenario,related,card.data.post_history_instructions,card.data.extensions.depth_prompt?.prompt,'你正在实际扮演这张角色卡。继续上文叙事，严格执行原卡的时间、晨间和选项规则。不要解释测试；让剧情自然展开。'].filter(Boolean).join('\n\n');
const init=card.data.first_mes.match(/<initvar>([\s\S]*?)<\/initvar>/);
const ready=JSON.parse(init[1]);
ready.day=6;ready.clock_minutes=480;ready.location='中央庭';
ready.tasks.DAY7_OPENING.status='completed';ready.tasks.SCHOOL_RESCUE.status='completed';ready.tasks.SECOND_REGION.status='active';
ready.cores.court='purified';ready.cores.school='available';ready.regions.school.liberated=true;
ready.morning_flags.day6_monologue=true;ready.morning_flags.day6_saiham=true;
ready.known=['安','安托涅瓦','希罗','珈儿','泰丝拉'];
const seed='<initvar>'+JSON.stringify(ready)+'</initvar>\n第六天早晨的小神低语、赛哈姆活骸化与希罗介入已经实际演完。高校学园解放，珈儿与泰丝拉安全撤离。现在你已回到中央庭，安托涅瓦请你在东方古街与中央城区中选择一处先援助；你尚未进入两区。';
const cases=[
  {id:'east-first',seed,steps:['我决定先去东方古街，带安同行。出发后先看看街区的情况。','我和安走向负责这里的人，先听她说明五行阵和居民眼下的困难。','我同意先处理眼前能确认的危机，跟着雯梓去现场看看，不替她提前解决整个区域。']},
  {id:'central-first',seed,steps:['我决定先去中央城区，带安同行。出发后先看看街区的情况。','我先找负责现场疏散的人，问清居民和怪物分别在什么位置。','我和赛斯一起进入现场，先处理眼前需要救援的人，不要跳到区域结算。']}
];
const outDir=process.env.LAB_EVIDENCE_DIR||'release-evidence';await fs.mkdir(outDir,{recursive:true});
const messages=[];
async function generate(history,state){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),100000);
  try{
    const bound=system.replaceAll('{{get_message_variable::stat_data}}',JSON.stringify(state));
    const r=await fetch(endpoint,{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:.35,max_tokens:2800,messages:[{role:'system',content:bound},...history]})});
    const raw=await r.text();if(!r.ok)throw Error(`Model HTTP ${r.status} ${raw.slice(0,240)}`);
    const data=JSON.parse(raw);const content=data.choices?.[0]?.message?.content;
    const text=Array.isArray(content)?content.map(x=>x.text||x.content||'').join(''):String(content||'');
    if(text.length<100)throw Error(`Empty/short model response ${text.slice(0,120)}`);
    return text;
  }finally{clearTimeout(timer)}
}
const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const form=new FormData();form.set('file_type','json');form.set('avatar',new Blob([JSON.stringify(card)],{type:'application/json'}),'qidu-v0430-regions.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});if(!imported.ok)throw Error(`ST card import ${imported.status}`);
const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:60000});
  await page.evaluate(()=>{
    const save=[...document.querySelectorAll('button,.menu_button')].find(x=>/^(Save|保存)$/.test(String(x.textContent||'').trim()));
    if(/Your Persona|Persona Name|你的角色设定|人设名称/.test(document.body.innerText||''))save?.click();
    for(const d of document.querySelectorAll('dialog[open]'))try{d.close()}catch{}
  });
  await page.evaluate(async(version)=>{
    const st=await import('/script.js');const wi=await import('/scripts/world-info.js');const ext=await import('/scripts/extensions.js');
    await st.getCharacters();
    const id=st.characters.findIndex(x=>x?.data?.character_version===version);if(id<0)throw Error('Card import not found');
    st.setCharacterId(id);
    window.$('#import_character_info').data('chid',id);
    try{await wi.importEmbeddedWorldInfo(true)}catch(e){console.warn('Worldbook import in screenshot session:',String(e))}
    const avatar=st.characters[id].avatar,settings=ext.extension_settings.tavern_helper ||= {},scripts=settings.script ||= {};
    const enabled=scripts.enabled ||= {global:true,presets:[],characters:[]};enabled.global=true;enabled.characters ||= [];
    if(!enabled.characters.includes(avatar))enabled.characters.push(avatar);
    const popuped=scripts.popuped ||= {presets:[],characters:[]};popuped.characters ||= [];
    if(!popuped.characters.includes(avatar))popuped.characters.push(avatar);
    if(st.chat.length===0)st.chat.push({name:st.characters[id].name,mes:st.characters[id].data.first_mes,is_user:false,is_system:false,send_date:new Date().toISOString()});
    document.querySelector('#chat > .welcomePanel')?.remove();
    await st.saveSettings();void st.eventSource.emit(st.event_types.SETTINGS_UPDATED);void st.eventSource.emit(st.event_types.CHAT_CHANGED,'qidu-region-story-v0430');
  },VERSION);
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(1600);
  await page.evaluate(async version=>{
    const st=await import('/script.js');await st.getCharacters();
    const id=st.characters.findIndex(x=>x?.data?.character_version===version);if(id<0)throw Error('Card missing after reload');
    st.setCharacterId(id);
    if(st.chat.length===0)st.chat.push({name:st.characters[id].name,mes:st.characters[id].data.first_mes,is_user:false,is_system:false,send_date:new Date().toISOString()});
    document.querySelector('#chat > .welcomePanel')?.remove();
    void st.eventSource.emit(st.event_types.SETTINGS_UPDATED);void st.eventSource.emit(st.event_types.CHAT_CHANGED,'qidu-region-model-v0430');
  },VERSION);
  for(let i=0;i<50;i++){
    const enabled=await page.evaluate(()=>{
      const t=[...document.querySelectorAll('#tavern_helper input[id$="-script-enable-toggle"]')];
      const x=t.find(y=>/角色|character/i.test(y.id))||t[1];if(x&&!x.checked)x.click();return Boolean(x?.checked)
    });
    if(enabled)break;await page.waitForTimeout(250);
  }
  await page.waitForTimeout(3200);
  let mvuReady=false;
  for(let attempt=0;attempt<40;attempt++){
    mvuReady=await page.evaluate(()=>Boolean(window.Mvu?.parseMessage&&window.__F7D_MVU_GUARD__?.ready));
    if(mvuReady)break;await page.waitForTimeout(250);
  }
  if(!mvuReady){
    const diagnosis=await page.evaluate(async()=>{
      const st=await import('/script.js');
      return{parentMvu:Boolean(window.Mvu),guard:window.__F7D_MVU_GUARD__,frames:[...document.querySelectorAll('iframe')].map(f=>({mvu:Boolean(f.contentWindow?.Mvu),guard:f.contentWindow?.__F7D_MVU_GUARD__})),toggles:[...document.querySelectorAll('#tavern_helper input[id$="-script-enable-toggle"]')].map(x=>({id:x.id,checked:x.checked})),version:st.characters?.[st.this_chid]?.data?.character_version};
    });
    throw Error('Actual ST MVU guard not ready '+JSON.stringify(diagnosis));
  }
  const evidence=[];
  for(const scenario of cases){
    const history=[{role:'assistant',content:scenario.seed}];
    let state=structuredClone(ready);
    for(let index=0;index<scenario.steps.length;index++){
      history.push({role:'user',content:scenario.steps[index]});
      const generated=replay?.evidence?.find(x=>x.scene===scenario.id&&x.turn===index+1)?.raw||await generate(history,state);history.push({role:'assistant',content:generated});
      const committed=await page.evaluate(async({raw,input,prior})=>{
        const st=await import('/script.js');st.chat.push({name:'指挥使',mes:input,is_user:true,is_system:false,send_date:new Date().toISOString()});
        const previous=window.Mvu.getMvuData({type:'message',message_id:0});previous.stat_data=prior;
        const next=await window.Mvu.parseMessage(raw,previous);
        return{day:next.stat_data.day,clock:next.stat_data.clock_minutes,location:next.stat_data.location,first:next.stat_data.route_flags.first_second_region,delayed:next.stat_data.route_flags.oldstreet_delayed,school:next.stat_data.regions.school.liberated,east:next.stat_data.regions.east.liberated,central:next.stat_data.regions.central.liberated,seth:next.stat_data.morning_flags.day6_seth,stat_data:next.stat_data};
      },{raw:generated,input:scenario.steps[index],prior:state});
      const before=state;state=committed.stat_data;
      if(index===0&&(committed.first!==null||committed.delayed!==false))throw Error(`Premature region route committed ${scenario.id}: ${JSON.stringify({first:committed.first,delayed:committed.delayed})}`);
      if(index===1&&committed.clock!==before.clock_minutes)throw Error(`Conversation cost time ${scenario.id}: ${before.clock_minutes} -> ${committed.clock}`);
      const record={scene:scenario.id,turn:index+1,prompt:scenario.steps[index],raw:generated,accepted:{day:committed.day,clock:committed.clock,location:committed.location,first:committed.first,delayed:committed.delayed,east:committed.east,central:committed.central,seth:committed.seth}};evidence.push(record);
      const prose=generated.split(/<f7d_terminal\b|<f7d_choices\b|<UpdateVariable\b/i)[0];
      const result=await page.evaluate(async({story,name})=>{
        const st=await import('/script.js');const regex=await import('/scripts/extensions/regex/engine.js');
        await st.getCharacters();
        const char=st.characters?.[st.this_chid];
        if(!char)throw Error('Card not imported in ST');
        regex.allowScopedScripts(char);
        const html=st.messageFormatting(story,char.name,false,false,Date.now(),{},false);
        regex.disallowScopedScripts(char);
        const el=document.createElement('div');el.className='mes';el.setAttribute('mesid','990');el.setAttribute('data-f7d-model-scene',name);el.style.cssText='box-sizing:border-box;width:390px;max-width:100%;height:auto;max-height:none;overflow:visible;margin:0 auto;padding:20px;background:#fbfaf2;color:#26352c;border:1px solid #d3dccd;border-radius:11px;font:15px/1.8 system-ui,Microsoft YaHei,sans-serif;position:relative;z-index:2147483647';
        el.innerHTML='<div class="mes_text"></div>';el.querySelector('.mes_text').innerHTML=html;
        document.body.appendChild(el);
        return{choices:el.querySelectorAll('[data-f7d-choice="1"]').length,textLength:el.innerText.length};
      },{story:prose,name:scenario.id+'-'+(index+1)});
      await page.waitForTimeout(450);
      await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))try{d.close()}catch{}for(const n of document.querySelectorAll('.toast-container,.toast-message,.toastify,.toastr'))n.remove()});
      const selector=`[data-f7d-model-scene="${scenario.id}-${index+1}"]`;
      await page.locator(selector).screenshot({path:`${outDir}/${scenario.id}-${index+1}.png`,style:'dialog,[class*="toast"]{visibility:hidden!important}'});
      console.log(JSON.stringify({scene:scenario.id,turn:index+1,generatedChars:generated.length,accepted:record.accepted,...result}));
    }
  }
  await fs.writeFile(`${outDir}/model-story.json`,JSON.stringify({model,version:card.data.character_version,evidence},null,2));
}finally{await browser.close()}
