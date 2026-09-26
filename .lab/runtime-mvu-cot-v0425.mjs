import fs from 'node:fs/promises';
import {loadQiduReleaseCandidate} from './qidu-card-v0424-cg-candidate.mjs';
import {addMvuCot} from './qidu-card-v0425-mvu-cot.mjs';
import {repairQiduCard,VERSION} from './qidu-card-v0426-repair.mjs';

const base=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const {card:previous}=await loadQiduReleaseCandidate(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const card=repairQiduCard(addMvuCot(previous));
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
  const parsed=await page.evaluate(async()=>{
    const old=window.Mvu.getMvuData({type:'message',message_id:0});
    const loc=await window.Mvu.parseMessage('<UpdateVariable>_.set("location","未知/苏醒中","中央庭");//首次确认地点</UpdateVariable>',old);
    const blocked=await window.Mvu.parseMessage('<UpdateVariable>_.set("cores.school","unknown","purified");//无玩家指令</UpdateVariable>',old);
    return{day:old.stat_data.day,location:loc.stat_data.location,core:blocked.stat_data.cores.school,guard:window.__F7D_MVU_GUARD__};
  });
  console.log('MVU command acceptance',JSON.stringify(parsed));
  if(parsed.day!==7||parsed.location!=='中央庭'||parsed.core!=='unknown'||!parsed.guard?.ready||parsed.guard.calls<2)throw Error(`MVU command acceptance failed ${JSON.stringify(parsed)}`);
  const ui=await page.evaluate(async()=>{
    const st=await import('/script.js');const regex=await import('/scripts/extensions/regex/engine.js');
    const character=st.characters[st.this_chid];regex.allowScopedScripts(character);
    const html=st.messageFormatting('<UpdateVariable>_.set("clock_minutes",480,560);//4/6 purified</UpdateVariable>街上有人向你招手。<f7d_choices><f7d_choice>走近询问</f7d_choice><f7d_choice>先看看四周</f7d_choice></f7d_choices>',character.name,false,false,123456,{},false);
    regex.disallowScopedScripts(character);
    const holder=document.createElement('div');holder.innerHTML=html;
    const result={hidden:!holder.textContent.includes('clock_minutes')&&!holder.textContent.includes('4/6')&&!holder.textContent.includes('purified'),
      choices:holder.querySelectorAll('[data-f7d-choice="1"]').length,
      polished:!!holder.querySelector('[data-f7d-choice-grid="1"]')};
    const preview=document.createElement('div');preview.id='qidu-ui-visual-check';
    preview.style.cssText='position:fixed;inset:0;z-index:2147483647;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:48px 12px;box-sizing:border-box;background:#e9eee3;color:#26322b;font:16px/1.7 system-ui,Microsoft YaHei,sans-serif';
    holder.style.cssText='width:min(100%,720px);padding:22px;border:1px solid #c9d4c4;border-radius:12px;background:#fbfbf6;box-shadow:0 12px 32px #0002';
    preview.append(holder);document.body.append(preview);
    return result;
  });
  console.log('UI rendering',JSON.stringify(ui));
  if(!ui.hidden||ui.choices!==2||!ui.polished)throw Error(`Hidden state or choice UI failed ${JSON.stringify(ui)}`);
  await fs.mkdir(process.env.LAB_EVIDENCE_DIR||'release-evidence',{recursive:true});
  await page.screenshot({path:`${process.env.LAB_EVIDENCE_DIR||'release-evidence'}/qidu-v0426-mobile.png`,fullPage:true});
  await page.setViewportSize({width:1280,height:800});
  await page.screenshot({path:`${process.env.LAB_EVIDENCE_DIR||'release-evidence'}/qidu-v0426-desktop.png`,fullPage:true});
}finally{await browser.close()}
