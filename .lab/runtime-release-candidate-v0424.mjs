import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduReleaseCandidate, ONEFILE_VERSION, assertReleasePrivacy } from './qidu-card-v0424-cg-candidate.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'release-evidence';
await fs.mkdir(evidenceDir,{recursive:true});
const {card,raw,compactSha256}=await loadQiduReleaseCandidate(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
assertReleasePrivacy(card);
const rawText=raw.toString('utf8');
if(/(?:玲|h675786161|github\.com|raw\.githubusercontent\.com|api\.github\.com|实验酒馆|world-backstage|(?:\bLAB\b|[-_]lab\b|\blab[-_])|feature\/qidu-card|gmail\.com)/i.test(rawText)) throw new Error('release candidate contains private development provenance');
const by=p=>(card.data.character_book?.entries||[]).find(e=>String(e.name||'').startsWith(p));
if(!String(by('41｜')?.content||'').includes('第一活骸事故只讲已锚定事实')) throw new Error('release candidate first-chimera fidelity guard missing');

const form=new FormData();form.set('file_type','json');form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-v0424-release.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});const importText=await imported.text();
if(!imported.ok) throw new Error(`release candidate import failed ${imported.status}: ${importText.slice(0,200)}`);
const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
let client;
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});if(!r||r.status()>=400)throw new Error(`HTTP ${r?.status()}`);await page.waitForTimeout(1800);
  const completedOnboarding=await page.evaluate(()=>{
    const text=String(document.body.innerText||'');
    if(!/Your Persona|Persona Name|你的角色设定|人设名称/i.test(text))return false;
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    const buttons=[...document.querySelectorAll('button,.menu_button,[role="button"]')].filter(visible);
    const save=buttons.find(x=>/^(?:Save|保存)$/i.test(String(x.textContent||'').trim()));
    if(!save)return false;
    save.click();
    return true;
  });
  if(completedOnboarding) await page.waitForTimeout(700);
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});

  const preapproved=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');
    const ext=await import('/scripts/extensions.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator==='叶罹');
    if(idx<0)return{found:false};
    const avatar=st.characters[idx]?.avatar;
    const embeddedScripts=Array.isArray(st.characters[idx]?.data?.extensions?.tavern_helper?.scripts)?st.characters[idx].data.extensions.tavern_helper.scripts.length:0;
    const root=ext.extension_settings.tavern_helper ||= {};
    const script=root.script ||= {};
    const enabled=script.enabled ||= {global:true,presets:[],characters:[]};
    if(!Array.isArray(enabled.presets)) enabled.presets=[];
    if(!Array.isArray(enabled.characters)) enabled.characters=[];
    enabled.global=true;
    if(avatar&&!enabled.characters.includes(avatar)) enabled.characters.push(avatar);
    const popuped=script.popuped ||= {presets:[],characters:[]};
    if(!Array.isArray(popuped.presets)) popuped.presets=[];
    if(!Array.isArray(popuped.characters)) popuped.characters=[];
    if(avatar&&!popuped.characters.includes(avatar)) popuped.characters.push(avatar);
    await st.saveSettings();
    return{found:true,avatar,embeddedScripts};
  },{name:card.data.name,version:ONEFILE_VERSION});
  if(!preapproved?.found||preapproved?.embeddedScripts<1) throw new Error(`embedded choice script missing after import: ${JSON.stringify(preapproved)}`);

  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(1600);
  await page.evaluate(()=>{
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    if(/Your Persona|Persona Name|你的角色设定|人设名称/i.test(String(document.body.innerText||''))){
      const save=[...document.querySelectorAll('button,.menu_button,[role="button"]')].find(x=>visible(x)&&/^(?:Save|保存)$/i.test(String(x.textContent||'').trim()));
      save?.click();
    }
    for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}
  });
  await page.waitForTimeout(300);

  const helperSelection=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator==='叶罹');
    if(idx<0)return{found:false};
    st.setCharacterId(idx);
    void st.eventSource.emit(st.event_types.SETTINGS_UPDATED);
    void st.eventSource.emit(st.event_types.CHAT_CHANGED,st.characters[idx]?.chat||'qidu-helper-acceptance');
    return{found:true,avatar:st.characters[idx]?.avatar,embeddedScripts:Array.isArray(st.characters[idx]?.data?.extensions?.tavern_helper?.scripts)?st.characters[idx].data.extensions.tavern_helper.scripts.length:0};
  },{name:card.data.name,version:ONEFILE_VERSION});
  if(!helperSelection?.found||helperSelection?.embeddedScripts<1) throw new Error(`embedded choice script missing after reload: ${JSON.stringify(helperSelection)}`);

  await page.waitForTimeout(350);
  const helperToggle=await page.evaluate(()=>{
    const toggles=[...document.querySelectorAll('#tavern_helper input[id$="-script-enable-toggle"]')];
    const summary=toggles.map((x,i)=>({i,id:x.id,checked:Boolean(x.checked)}));
    const target=toggles.find(x=>/角色|character/i.test(String(x.id||'')))||toggles[1]||null;
    if(!target)return{found:false,summary};
    if(!target.checked) target.click();
    return{found:true,id:target.id,checked:Boolean(target.checked),summary};
  });
  console.log('[helper-toggle]',JSON.stringify(helperToggle));
  if(!helperToggle?.found||!helperToggle?.checked) throw new Error(`Tavern Helper character-script toggle unavailable: ${JSON.stringify(helperToggle)}`);

  for(let i=0;i<100;i++){
    const ready=await page.evaluate(()=>Boolean(window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.setComposer));
    if(ready)break;
    await page.waitForTimeout(150);
  }
  const helperDiag=await page.evaluate(async()=>{
    const ext=await import('/scripts/extensions.js');
    const th=window.TavernHelper||globalThis.TavernHelper;
    let charTrees=null,currentCharacterId=null,enabledButtons=null;
    try{charTrees=th?.getScriptTrees?.({type:'character'})?.map(x=>({id:x?.id,name:x?.name,enabled:x?.enabled,type:x?.type}))??null;}catch(e){charTrees={error:String(e)}}
    try{currentCharacterId=th?.getCurrentCharacterId?.()??null;}catch(e){currentCharacterId={error:String(e)}}
    try{enabledButtons=th?.getAllEnabledScriptButtons?.()??null;}catch(e){enabledButtons={error:String(e)}}
    return{
      helperPresent:Boolean(th),
      helperKeys:th?Object.keys(th).slice(0,80):[],
      currentCharacterId,
      charTrees,
      enabledButtons,
      enabledCharacters:ext.extension_settings?.tavern_helper?.script?.enabled?.characters??null,
      popupedCharacters:ext.extension_settings?.tavern_helper?.script?.popuped?.characters??null,
      toggles:[...document.querySelectorAll('#tavern_helper input[id$="-script-enable-toggle"]')].map((x,i)=>({i,id:x.id,checked:Boolean(x.checked)})),
      iframes:[...document.querySelectorAll('iframe')].map(x=>({id:x.id||null,name:x.name||null,src:x.getAttribute('src')||null,title:x.title||null})).slice(0,30),
      bridge:Boolean(window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.setComposer),
      bridgeVersion:window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.version||null,
    };
  });
  console.log('[helper-diag]',JSON.stringify(helperDiag));
  const bridgeReady=Boolean(helperDiag?.bridge);
  if(!bridgeReady) throw new Error('embedded Tavern Helper choice bridge did not start');

  client=await page.evaluate(async({name,version,hash})=>{
    const st=await import('/script.js');const eng=await import('/scripts/extensions/regex/engine.js');await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator==='叶罹'&&String(x?.data?.character_book?.entries?.find(e=>String(e?.name||'').startsWith('41｜'))?.content||'').includes('第一活骸事故只讲已锚定事实'));
    if(idx<0)return{found:false};st.setCharacterId(idx);const ch=st.characters[idx];eng.allowScopedScripts(ch);
    const html=st.messageFormatting('<f7d_terminal>RELEASE CANDIDATE</f7d_terminal><f7d_state>{"private":1}</f7d_state><f7d_choices><f7d_choice>Continue</f7d_choice><f7d_choice>Ask Kaji</f7d_choice></f7d_choices>','release',false,false,888888,{},false);
    const h=document.createElement('div');h.id='qidu-release-acceptance-dialog';h.style.cssText='position:fixed;z-index:2147483646;left:12px;top:72px;margin:0;width:min(780px,calc(100vw - 24px));max-width:none;padding:10px;border:0;border-radius:16px;background:rgba(5,10,18,.96);';h.innerHTML=html;document.body.appendChild(h);
    const term=h.querySelector('[data-f7d-terminal="1"]'),grid=h.querySelector('[data-f7d-choice-grid="1"]'),labels=[...h.querySelectorAll('[data-f7d-choice="1"]')],free=h.querySelector('[data-f7d-choice-free="1"]');const ts=term?getComputedStyle(term):null,gs=grid?getComputedStyle(grid):null,ls=labels.map(x=>getComputedStyle(x));
    const rect=e=>e?e.getBoundingClientRect():null,hr=rect(h),gr=rect(grid),rs=labels.map(rect);

    const textarea=document.querySelector('#send_textarea');
    if(textarea)textarea.value='';
    labels[0]?.click();
    await new Promise(r=>setTimeout(r,30));
    const clickFilled=Boolean(textarea&&textarea.value==='Continue');
    const composerDiag=textarea?{disabled:Boolean(textarea.disabled),connected:Boolean(textarea.isConnected),display:getComputedStyle(textarea).display,visibility:getComputedStyle(textarea).visibility,width:textarea.getBoundingClientRect().width,height:textarea.getBoundingClientRect().height}:null;

    const fake=document.createElement('div');
    fake.className='mes';
    fake.setAttribute('mesid','999999');
    fake.innerHTML='<div class="mes_text"><div id="qidu-fake-preset-shell"><div>求索者抉择</div><div>MAKE YOUR DECISION</div><div>options:</div><div>去大礼堂确认情况</div><div>留在原地观察</div><div>plans:</div></div></div>';
    document.querySelector('#chat')?.appendChild(fake);
    window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.normalizePresetShells?.();
    await new Promise(r=>setTimeout(r,60));
    const normalizedGrid=fake.querySelector('[data-f7d-choice-grid="1"][data-f7d-preset-normalized="1"]');
    const normalizedChoices=[...fake.querySelectorAll('[data-f7d-choice="1"]')];
    const presetNormalized=Boolean(normalizedGrid&&normalizedChoices.length>=2&&fake.querySelector('[data-f7d-choice-free="1"]'));
    if(textarea)textarea.value='';
    normalizedChoices[0]?.click();
    await new Promise(r=>setTimeout(r,30));
    const normalizedClickFilled=Boolean(textarea&&textarea.value==='去大礼堂确认情况');
    fake.remove();

    const ctx=window.SillyTavern?.getContext?.();
    const terminalFake=document.createElement('div');
    terminalFake.className='mes';
    const terminalId=Array.isArray(ctx?.chat)?ctx.chat.length:-1;
    if(terminalId>=0){
      ctx.chat.push({name:'release',is_user:false,is_system:false,mes:'<f7d_state>{"schema":"f7d_textloop_0.4","day":7,"day_ready_to_sleep":false,"location":"高校学园","regions":{"school":{"liberated":false,"build_steps":[]}},"tasks":{"SCHOOL_RESCUE":{"status":"active","objective":"解放高校学园"}},"cores":{"court":"unknown","school":"unknown"}}</f7d_state>普通正文，没有终端标签。'});
      terminalFake.setAttribute('mesid',String(terminalId));
      terminalFake.innerHTML='<div class="mes_text">普通正文，没有终端标签。</div>';
      document.querySelector('#chat')?.appendChild(terminalFake);
      window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.ensureTerminalFallbacks?.();
      await new Promise(r=>setTimeout(r,30));
    }
    const terminalFallbackEl=terminalFake.querySelector('[data-f7d-terminal-fallback="1"]');
    const terminalFallback=Boolean(terminalFallbackEl);
    const terminalNoNodeText=Boolean(terminalFallbackEl&&!/行动节点|\/12|巡查次数/.test(String(terminalFallbackEl.textContent||'')));
    terminalFake.remove();

    const legacyTerminalFake=document.createElement('div');
    legacyTerminalFake.className='mes';
    legacyTerminalFake.innerHTML='<div class="mes_text"><div data-f7d-terminal="1">【战术终端】第7天｜行动节点 1/12｜高校学园\n当前位置：高校学园大礼堂后门</div></div>';
    document.querySelector('#chat')?.appendChild(legacyTerminalFake);
    window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.scrubLegacyTerminalCounters?.();
    await new Promise(r=>setTimeout(r,20));
    const legacyCounterScrubbed=Boolean(!/行动节点|1\s*\/\s*12/.test(String(legacyTerminalFake.textContent||'')));
    legacyTerminalFake.remove();
    if(terminalId>=0&&Array.isArray(ctx?.chat)&&ctx.chat.length===terminalId+1)ctx.chat.pop();

    return{found:true,creator:ch?.data?.creator,composerDiag,bookCreator:ch?.data?.character_book?.extensions?.creator,bookVersion:ch?.data?.character_book?.extensions?.version,allowed:eng.isScopedScriptsAllowed(ch),terminal:Boolean(term),grid:Boolean(grid),hidden:!h.textContent?.includes('private'),choiceCount:labels.length,freeInput:Boolean(free),clickFilled,presetNormalized,normalizedClickFilled,terminalFallback,terminalNoNodeText,legacyCounterScrubbed,bridgeVersion:window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.version||null,terminalFlat:Boolean(ts?.backgroundImage==='none'),gridFlat:Boolean(gs?.backgroundImage==='none'),choiceFlat:ls.map(s=>s?.backgroundImage==='none'),choiceMinHeights:ls.map(s=>parseFloat(s?.minHeight||'0')),stacked:Boolean(rs.length===2&&rs[1].top>rs[0].top+4),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2),hash};
  },{name:card.data.name,version:ONEFILE_VERSION,hash:compactSha256});

  await page.evaluate(()=>{
    for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}
    const textarea=document.querySelector('#send_textarea');
    if(textarea){
      textarea.value='我自己输入';
      textarea.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  await page.waitForTimeout(60);
  const freeButton=page.locator('#qidu-release-acceptance-dialog [data-f7d-choice-free="1"]');
  await freeButton.click({timeout:10000});
  await page.waitForTimeout(80);
  const freeResult=await page.evaluate(()=>{
    const textarea=document.querySelector('#send_textarea');
    return{
      keepsDraft:Boolean(textarea&&textarea.value==='我自己输入'),
      focusesComposer:Boolean(textarea&&document.activeElement===textarea),
      activeId:document.activeElement?.id||document.activeElement?.tagName||null,
    };
  });
  client.freeKeepsDraft=freeResult.keepsDraft;
  client.freeFocusesComposer=freeResult.focusesComposer;
  client.freeActiveId=freeResult.activeId;

  await page.screenshot({path:path.join(evidenceDir,'qidu-v0424-release-candidate-mobile.png'),fullPage:false});await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(250);
  client.desktop=await page.evaluate(()=>{const h=document.getElementById('qidu-release-acceptance-dialog'),g=h?.querySelector('[data-f7d-choice-grid="1"]'),ls=[...(h?.querySelectorAll('[data-f7d-choice="1"]')||[])];const R=e=>e?e.getBoundingClientRect():null,hr=R(h),gr=R(g),rs=ls.map(R);return{multiColumn:Boolean(rs.length===2&&Math.abs(rs[0].top-rs[1].top)<4&&rs[1].left>rs[0].left+20),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2)}});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0424-release-candidate-desktop.png'),fullPage:false});
}finally{await browser.close()}
const report={version:ONEFILE_VERSION,sha256:compactSha256,importStatus:imported.status,client};await fs.writeFile(path.join(evidenceDir,'qidu-v0424-release-candidate-report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.24.json'),raw);console.log(JSON.stringify(report,null,2));
const ok=client?.found&&client?.creator==='叶罹'&&client?.bookCreator==='叶罹'&&client?.bookVersion==='0.4.24'&&client?.allowed&&client?.terminal&&client?.grid&&client?.hidden&&client?.choiceCount===2&&client?.freeInput&&client?.clickFilled&&client?.freeKeepsDraft&&client?.freeFocusesComposer&&client?.presetNormalized&&client?.normalizedClickFilled&&client?.terminalFallback&&client?.terminalNoNodeText&&client?.legacyCounterScrubbed&&client?.bridgeVersion==='1.6.0'&&client?.terminalFlat&&client?.gridFlat&&client?.choiceFlat?.every(Boolean)&&client?.choiceMinHeights?.every(x=>x>=44)&&client?.stacked&&client?.gridFits&&client?.desktop?.multiColumn&&client?.desktop?.gridFits;
if(!ok)throw new Error(`release candidate real-ST/browser acceptance failed: ${JSON.stringify(client)}`);
