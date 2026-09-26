import fs from 'node:fs/promises';
import {loadQiduReleaseCandidate} from './qidu-card-v0424-cg-candidate.mjs';
import {addMvuCot,VERSION} from './qidu-card-v0425-mvu-cot.mjs';

const base=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const {card:previous}=await loadQiduReleaseCandidate(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const card=addMvuCot(previous);
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
    const avatar=st.characters[idx].avatar;
    const settings=ext.extension_settings.tavern_helper ||= {};
    const scripts=settings.script ||= {};
    const enabled=scripts.enabled ||= {global:true,presets:[],characters:[]};
    enabled.global=true;enabled.characters ||= [];if(!enabled.characters.includes(avatar))enabled.characters.push(avatar);
    const popuped=scripts.popuped ||= {presets:[],characters:[]};
    popuped.characters ||= [];if(!popuped.characters.includes(avatar))popuped.characters.push(avatar);
    await st.saveSettings();return{found:true,avatar};
  },{name:card.data.name,version:VERSION});if(!ready.found)throw Error(`card missing ${JSON.stringify(ready)}`);
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(1600);
  const selected=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');await st.getCharacters();const idx=st.characters.findIndex(x=>x?.data?.name===name&&x?.data?.character_version===version);
    st.setCharacterId(idx);
    if(st.chat.length===0)st.chat.push({name,mes:st.characters[idx].data.first_mes,is_user:false,is_system:false,send_date:new Date().toISOString()});
    void st.eventSource.emit(st.event_types.SETTINGS_UPDATED);void st.eventSource.emit(st.event_types.CHAT_CHANGED,'qidu-mvu-cot-check');
    return{idx,chatSize:st.chat?.length||0};
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
  console.log(JSON.stringify({version:VERSION,selected,toggle,diag,errors},null,2));
  if(!loaded||!initialized)throw Error(`MVU not initialized in real ST: ${JSON.stringify({loaded,initialized,diag,errors})}`);
}finally{await browser.close()}
