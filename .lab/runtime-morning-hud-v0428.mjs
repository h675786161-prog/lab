import fs from 'node:fs/promises';
import {loadQiduReleaseCandidate} from './qidu-card-v0424-cg-candidate.mjs';
import {addMvuCot} from './qidu-card-v0425-mvu-cot.mjs';
import {repairQiduCard} from './qidu-card-v0426-repair.mjs';
import {addPresetChoiceCompatibility} from './qidu-card-preset-compat-v0427.mjs';
import {addMorningClockHud,VERSION} from './qidu-card-morning-hud-v0428.mjs';

const base=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const {card:previous}=await loadQiduReleaseCandidate(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const card=addMorningClockHud(addPresetChoiceCompatibility(repairQiduCard(addMvuCot(previous))));
const script=card.data.extensions.tavern_helper.scripts.find(x=>x.id==='qidu-v0425-mvu');
if(process.env.LAB_MVU_LOCAL==='1')script.content="import '/scripts/extensions/third-party/qidu-mvu/bundle.js'";
const raw=JSON.stringify(card);
const form=new FormData();form.set('file_type','json');form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-mvu-cot-v0425.json');
const res=await fetch(`${base}/api/characters/import`,{method:'POST',body:form});
if(!res.ok)throw Error(`ST card import ${res.status} ${(await res.text()).slice(0,500)}`);
const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(/MVU|qidu|script|脚本|error/i.test(msg.text()))errors.push(`[console:${msg.type()}] ${msg.text().slice(0,350)}`)});
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(1800);
  await page.evaluate(()=>{
    const save=[...document.querySelectorAll('button,.menu_button')].find(x=>/^(Save|保存)$/.test(String(x.textContent||'').trim()));
    if(/Your Persona|Persona Name|你的角色设定|人设名称/.test(document.body.innerText||''))save?.click();
    for(const d of document.querySelectorAll('dialog[open]'))try{d.close()}catch{}
  });
  const ready=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');const ext=await import('/scripts/extensions.js');await st.getCharacters();
    const idx=st.characters.findIndex(x=>x?.data?.name===name&&x?.data?.character_version===version);
    if(idx<0)return{found:false};
    const wi=await import('/scripts/world-info.js');
    window.$('#import_character_info').data('chid',idx);
    await wi.importEmbeddedWorldInfo(true);
    const avatar=st.characters[idx].avatar;
    const settings=ext.extension_settings.tavern_helper ||= {};
    const scripts=settings.script ||= {};
    const enabled=scripts.enabled ||= {global:true,presets:[],characters:[]};
    enabled.global=true;enabled.characters ||= [];if(!enabled.characters.includes(avatar))enabled.characters.push(avatar);
    const popuped=scripts.popuped ||= {presets:[],characters:[]};
    popuped.characters ||= [];if(!popuped.characters.includes(avatar))popuped.characters.push(avatar);
    await st.saveSettings();return{found:true,avatar,embeddedScripts:st.characters[idx].data.extensions?.tavern_helper?.scripts?.map(x=>({id:x.id,name:x.name,enabled:x.enabled}))};
  },{name:card.data.name,version:VERSION});if(!ready.found)throw Error(`card missing ${JSON.stringify(ready)}`);
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(1600);
  const selected=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');await st.getCharacters();const idx=st.characters.findIndex(x=>x?.data?.name===name&&x?.data?.character_version===version);
    st.setCharacterId(idx);
    if(st.chat.length===0)st.chat.push({name,mes:st.characters[idx].data.first_mes,is_user:false,is_system:false,send_date:new Date().toISOString()});
    document.querySelector('#chat > .welcomePanel')?.remove();
    void st.eventSource.emit(st.event_types.SETTINGS_UPDATED);void st.eventSource.emit(st.event_types.CHAT_CHANGED,'qidu-mvu-cot-check');
    return{idx,chatSize:st.chat?.length||0,embeddedScripts:st.characters[idx].data.extensions?.tavern_helper?.scripts?.map(x=>({id:x.id,name:x.name,enabled:x.enabled}))};
  },{name:card.data.name,version:VERSION});
  let toggle;
  for(let i=0;i<60;i++){
    toggle=await page.evaluate(()=>{
      const t=[...document.querySelectorAll('#tavern_helper input[id$="-script-enable-toggle"]')];
      const chosen=t.find(x=>/角色|character/i.test(x.id))||t[1];
      if(chosen&&!chosen.checked)chosen.click();
      return{found:Boolean(chosen),checked:Boolean(chosen?.checked),toggles:t.map(x=>({id:x.id,checked:x.checked})),frames:document.querySelectorAll('iframe').length};
    });
    if(toggle.checked)break;await page.waitForTimeout(250);
  }
  await page.waitForTimeout(5000);
  const diag=await page.evaluate(async()=>{
    const frames=[...document.querySelectorAll('iframe')];
    const helperFrame=frames.map(f=>f.contentWindow).filter(Boolean);
    const found=helperFrame.map((w,i)=>({i,mvu:Boolean(w.Mvu),helper:Boolean(w.TavernHelper),chatVar:typeof w.TavernHelper?.getVariables==='function'?w.TavernHelper.getVariables({type:'message',message_id:0})?.stat_data?.day:null}));
    const st=await import('/script.js');
    let scriptTrees=null;try{scriptTrees=window.TavernHelper?.getScriptTrees?.({type:'character'})?.map(x=>({name:x.name,id:x.id,enabled:x.enabled,type:x.type}))}catch(e){scriptTrees=String(e)}
    return{frames:found,parentMvu:Boolean(window.Mvu),parentDay:window.Mvu?.getMvuData({type:'message',message_id:0})?.stat_data?.day??null,helper:Boolean(window.TavernHelper),bridge:Boolean(window.__F7D_CARD_CHOICE_BRIDGE_V0424__),scriptTrees,toggles:[...document.querySelectorAll('#tavern_helper input[id$="-script-enable-toggle"]')].map(x=>({id:x.id,checked:x.checked})),chat:st.chat?.map(x=>({mes:String(x.mes).slice(0,80),is_user:x.is_user})).slice(0,3),version:st.characters?.[st.this_chid]?.data?.character_version};
  });
  const loaded=diag.parentMvu||diag.frames.some(f=>f.mvu);
  const initialized=diag.parentDay===7||diag.frames.some(f=>f.chatVar===7);
  console.log(JSON.stringify({version:VERSION,ready,selected,toggle,diag,errors},null,2));
  if(!loaded||!initialized)throw Error(`MVU not initialized in real ST: ${JSON.stringify({loaded,initialized,diag,errors})}`);
  const hud=await page.evaluate(()=>({text:document.querySelector('#f7d-status-hud-v0428')?.textContent||'',count:document.querySelectorAll('#f7d-status-hud-v0428').length}));
  console.log('Persistent status HUD',JSON.stringify(hud));
  if(hud.count!==1||!hud.text.includes('第7天')||!hud.text.includes('08:00'))throw Error('Status HUD missing in real ST '+JSON.stringify(hud));
  const parsed=await page.evaluate(async()=>{
    const old=window.Mvu.getMvuData({type:'message',message_id:0});
    const loc=await window.Mvu.parseMessage('<UpdateVariable>_.set("location","未知/苏醒中","中央庭");//首次确认地点</UpdateVariable>',old);
    const blocked=await window.Mvu.parseMessage('<UpdateVariable>_.set("cores.school","unknown","purified");//无玩家指令</UpdateVariable>',old);
    const premature=await window.Mvu.parseMessage('<UpdateVariable>_.set("clock_minutes",480,560);//opening premature</UpdateVariable>',old);
    return{day:old.stat_data.day,location:loc.stat_data.location,core:blocked.stat_data.cores.school,prematureClock:premature.stat_data.clock_minutes,guard:window.__F7D_MVU_GUARD__};
  });
  console.log('MVU command acceptance',JSON.stringify(parsed));
  if(parsed.day!==7||parsed.location!=='中央庭'||parsed.core!=='unknown'||parsed.prematureClock!==480||!parsed.guard?.ready||parsed.guard.calls<2)throw Error(`MVU command acceptance failed ${JSON.stringify(parsed)}`);
  const ui=await page.evaluate(async()=>{
    const st=await import('/script.js');const regex=await import('/scripts/extensions/regex/engine.js');
    const character=st.characters[st.this_chid];regex.allowScopedScripts(character);
    const html=st.messageFormatting('<UpdateVariable>_.set("clock_minutes",480,560);//4/6 purified</UpdateVariable>街上有人向你招手。<f7d_choices><f7d_choice>走近询问</f7d_choice><f7d_choice>先看看四周</f7d_choice></f7d_choices>',character.name,false,false,123456,{},false);
    regex.disallowScopedScripts(character);
    const holder=document.createElement('div');holder.innerHTML=html;
    return{hidden:!holder.textContent.includes('clock_minutes')&&!holder.textContent.includes('4/6')&&!holder.textContent.includes('purified'),
      choices:holder.querySelectorAll('[data-f7d-choice="1"]').length,
      polished:!!holder.querySelector('[data-f7d-choice-grid="1"]'),
      markup:html,themeCss:document.getElementById('f7d-ui-theme-v0424')?.textContent||''};
  });
  console.log('UI rendering',JSON.stringify({hidden:ui.hidden,choices:ui.choices,polished:ui.polished,themeCss:ui.themeCss.length}));
  if(!ui.hidden||ui.choices!==2||!ui.polished||!ui.themeCss)throw Error('Hidden state or choice UI failed');
  await fs.mkdir(process.env.LAB_EVIDENCE_DIR||'release-evidence',{recursive:true});
  const preview=await browser.newPage({viewport:{width:390,height:844}});
  await preview.setContent(`<html><head><meta charset="utf-8"><style>${ui.themeCss}</style><style>body{margin:0;padding:48px 12px;background:#e9eee3;color:#26322b;font:16px/1.7 system-ui,Microsoft YaHei,sans-serif}.scene{box-sizing:border-box;width:min(100%,720px);margin:auto;padding:22px;border:1px solid #c9d4c4;border-radius:12px;background:#fbfbf6;box-shadow:0 12px 32px #0002}</style></head><body><main class="scene">${ui.markup}</main></body></html>`);
  const mobile=await preview.evaluate(()=>{const grid=document.querySelector('[data-f7d-choice-grid="1"]');return{visible:!!grid&&grid.getBoundingClientRect().height>0&&getComputedStyle(grid).display!=='none',columns:grid&&getComputedStyle(grid).gridTemplateColumns}});
  if(!mobile.visible)throw Error(`Mobile choice layout missing ${JSON.stringify(mobile)}`);
  await preview.screenshot({path:`${process.env.LAB_EVIDENCE_DIR||'release-evidence'}/qidu-v0426-mobile.png`,fullPage:true});
  await preview.setViewportSize({width:1280,height:800});
  await preview.screenshot({path:`${process.env.LAB_EVIDENCE_DIR||'release-evidence'}/qidu-v0426-desktop.png`,fullPage:true});
  await preview.close();
  await page.screenshot({path:`${process.env.LAB_EVIDENCE_DIR||'release-evidence'}/qidu-v0428-status-hud.png`});
  const storySamples=[
    {name:'day7-mom',raw:'安把病房的窗帘拉开，晨光落在床沿。她侧过身，把杯水放在你伸手能拿到的地方。\n\n“先慢慢来。想问什么，我会告诉你。”\n\n窗外的城市已经醒了，街上的车声很轻。\n\n<branches><details><summary>剧情分支</summary>\nA.询问安这里是什么地方，先确认自己身处哪座城市\nB.起身走到窗前，看看街上的情况与房间外的走廊\nC.暂时留在床边，听安把中央庭的来历讲完\n</details></branches>'},
    {name:'day7-daymoon',raw:'希罗在门口停下脚步，目光先落在安身上，才转向你。他从衣袋里取出一颗草莓糖，摊在掌心，像是在给刚醒来的新人留一件再普通不过的见面礼。\n\n“这位就是新的指挥使？”\n\n<branches>\noptions:\n接过草莓糖，问希罗指挥使平时要做些什么\n先问他的名字与他为什么会在中央庭\n暂时不接糖，听听安会怎样介绍这位前辈\n</branches>'},
    {name:'day6-own',raw:'清晨尚未到来，一阵极轻的低语先从梦里掠过。你睁开眼时，窗外仍是蓝灰色。\n\n走廊里有人急促地敲门。安站在门外，没有催你，只说中央庭收到了新的消息。\n\n<f7d_choices><f7d_choice>请安把消息从头讲清楚</f7d_choice><f7d_choice>跟她一起去见安托涅瓦</f7d_choice></f7d_choices>'}
  ];
  for(const sample of storySamples){
    const check=await page.evaluate(async({raw,name})=>{
      const st=await import('/script.js');const regex=await import('/scripts/extensions/regex/engine.js');
      const character=st.characters[st.this_chid];regex.allowScopedScripts(character);
      const html=st.messageFormatting(raw,character.name,false,false,Date.now(),{},false);
      regex.disallowScopedScripts(character);
      const id=st.chat.length;st.chat.push({name:character.name,mes:raw,is_user:false,is_system:false,send_date:new Date().toISOString()});
      const item=document.createElement('div');item.className='mes';item.setAttribute('mesid',String(id));item.setAttribute('data-f7d-evidence',name);item.style.cssText='position:relative;display:block;max-width:640px;margin:12px auto;padding:22px;background:#f9f9f4;color:#24312a;border-radius:12px;line-height:1.8;font-size:16px;';
      item.innerHTML='<div class="mes_text"></div>';item.querySelector('.mes_text').innerHTML=html;
      document.querySelector('#chat')?.appendChild(item);
      window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.normalizeRawBranches?.();
      return{id,hasRawBranches:item.textContent.includes('<branches>'),htmlLength:html.length};
    },sample);
    await page.waitForTimeout(300);
    const item=page.locator(`[data-f7d-evidence="${sample.name}"]`);
    const buttons=await item.locator('[data-f7d-choice="1"]').count();
    if(buttons<2)throw Error(`Story choice buttons missing ${sample.name}: ${JSON.stringify(check)}`);
    const visibleText=await item.innerText();
    if(/\boptions:|<branches>|<details>/.test(visibleText))throw Error(`Preset syntax leaked into story ${sample.name}`);
    await page.evaluate(()=>{
      for(const dialog of document.querySelectorAll('dialog[open]'))try{dialog.close()}catch{}
      for(const toast of document.querySelectorAll('.toast-container,.toast-message,.toastify,.toastr'))toast.remove();
    });
    await item.screenshot({path:`${process.env.LAB_EVIDENCE_DIR||'release-evidence'}/qidu-v0427-story-${sample.name}.png`,style:'dialog,[class*="toast"],[id*="toast"]{visibility:hidden!important;opacity:0!important;pointer-events:none!important}'});
    if(sample.name==='day7-daymoon'){
      await page.evaluate(()=>{for(const dialog of document.querySelectorAll('dialog[open]'))try{dialog.close()}catch{}});
      await item.locator('[data-f7d-choice="1"]').first().click();
      const composer=await page.locator('#send_textarea').inputValue();
      if(!composer.includes('草莓糖'))throw Error(`Preset option did not fill composer: ${composer}`);
    }
    console.log('ST story replay',JSON.stringify({name:sample.name,buttons,check}));
  }
}finally{await browser.close()}
