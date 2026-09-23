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
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});

  const helperSelection=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator==='叶罹');
    if(idx<0)return{found:false};
    await st.selectCharacterById(idx,{switchMenu:false});
    return{found:true,avatar:st.characters[idx]?.avatar,embeddedScripts:Array.isArray(st.characters[idx]?.data?.extensions?.tavern_helper?.scripts)?st.characters[idx].data.extensions.tavern_helper.scripts.length:0};
  },{name:card.data.name,version:ONEFILE_VERSION});
  if(!helperSelection?.found||helperSelection?.embeddedScripts<1) throw new Error(`embedded choice script missing after import: ${JSON.stringify(helperSelection)}`);
  await page.waitForTimeout(900);
  const helperPrompt=await page.evaluate(()=>/角色卡[\s\S]*嵌入式脚本|嵌入式脚本[\s\S]*启用/.test(document.body.innerText||''));
  if(helperPrompt){
    const clicked=await page.evaluate(()=>{
      const candidates=[...document.querySelectorAll('button,.menu_button')];
      const btn=candidates.find(x=>String(x.textContent||'').trim()==='确认');
      if(!btn)return false;
      btn.click();
      return true;
    });
    if(!clicked) throw new Error('Tavern Helper embedded-script confirmation button not found');
  }
  for(let i=0;i<40;i++){
    const ready=await page.evaluate(()=>Boolean(window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.setComposer));
    if(ready)break;
    await page.waitForTimeout(150);
  }
  const bridgeReady=await page.evaluate(()=>Boolean(window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.setComposer));
  if(!bridgeReady) throw new Error('embedded Tavern Helper choice bridge did not start');

  client=await page.evaluate(async({name,version,hash})=>{
    const st=await import('/script.js');const eng=await import('/scripts/extensions/regex/engine.js');await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator==='叶罹'&&String(x?.data?.character_book?.entries?.find(e=>String(e?.name||'').startsWith('41｜'))?.content||'').includes('第一活骸事故只讲已锚定事实'));
    if(idx<0)return{found:false};st.setCharacterId(idx);const ch=st.characters[idx];eng.allowScopedScripts(ch);
    const html=st.messageFormatting('<f7d_terminal>RELEASE CANDIDATE</f7d_terminal><f7d_state>{"private":1}</f7d_state><f7d_choices><f7d_choice>Continue</f7d_choice><f7d_choice>Ask Kaji</f7d_choice></f7d_choices>','release',false,false,888888,{},false);
    const h=document.createElement('dialog');h.id='qidu-release-acceptance-dialog';h.style.cssText='position:fixed;left:12px;top:72px;margin:0;width:min(780px,calc(100vw - 24px));max-width:none;padding:10px;border:0;border-radius:16px;background:rgba(5,10,18,.96);';h.innerHTML=html;document.body.appendChild(h);h.showModal();
    const term=h.querySelector('[data-f7d-terminal="1"]'),grid=h.querySelector('[data-f7d-choice-grid="1"]'),labels=[...h.querySelectorAll('[data-f7d-choice="1"]')],free=h.querySelector('[data-f7d-choice-free="1"]');const ts=term?getComputedStyle(term):null,gs=grid?getComputedStyle(grid):null,ls=labels.map(x=>getComputedStyle(x));
    const rect=e=>e?e.getBoundingClientRect():null,hr=rect(h),gr=rect(grid),rs=labels.map(rect);

    const textarea=document.querySelector('#send_textarea');
    if(textarea)textarea.value='';
    labels[0]?.click();
    await new Promise(r=>setTimeout(r,30));
    const clickFilled=Boolean(textarea&&textarea.value==='Continue');
    if(textarea)textarea.value='我自己输入';
    free?.click();
    await new Promise(r=>setTimeout(r,30));
    const freeKeepsDraft=Boolean(textarea&&textarea.value==='我自己输入'&&document.activeElement===textarea);

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

    return{found:true,creator:ch?.data?.creator,bookCreator:ch?.data?.character_book?.extensions?.creator,bookVersion:ch?.data?.character_book?.extensions?.version,allowed:eng.isScopedScriptsAllowed(ch),terminal:Boolean(term),grid:Boolean(grid),hidden:!h.textContent?.includes('private'),choiceCount:labels.length,freeInput:Boolean(free),clickFilled,freeKeepsDraft,presetNormalized,normalizedClickFilled,terminalFallback,terminalNoNodeText,legacyCounterScrubbed,bridgeVersion:window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.version||null,terminalGradient:Boolean(ts?.backgroundImage&&ts.backgroundImage!=='none'),gridGradient:Boolean(gs?.backgroundImage&&gs.backgroundImage!=='none'),choiceGradients:ls.map(s=>Boolean(s?.backgroundImage&&s.backgroundImage!=='none')),choiceMinHeights:ls.map(s=>parseFloat(s?.minHeight||'0')),stacked:Boolean(rs.length===2&&rs[1].top>rs[0].top+4),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2),hash};
  },{name:card.data.name,version:ONEFILE_VERSION,hash:compactSha256});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0424-release-candidate-mobile.png'),fullPage:false});await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(250);
  client.desktop=await page.evaluate(()=>{const h=document.getElementById('qidu-release-acceptance-dialog'),g=h?.querySelector('[data-f7d-choice-grid="1"]'),ls=[...(h?.querySelectorAll('[data-f7d-choice="1"]')||[])];const R=e=>e?e.getBoundingClientRect():null,hr=R(h),gr=R(g),rs=ls.map(R);return{multiColumn:Boolean(rs.length===2&&Math.abs(rs[0].top-rs[1].top)<4&&rs[1].left>rs[0].left+20),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2)}});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0424-release-candidate-desktop.png'),fullPage:false});
}finally{await browser.close()}
const report={version:ONEFILE_VERSION,sha256:compactSha256,importStatus:imported.status,client};await fs.writeFile(path.join(evidenceDir,'qidu-v0424-release-candidate-report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.24.json'),raw);console.log(JSON.stringify(report,null,2));
const ok=client?.found&&client?.creator==='叶罹'&&client?.bookCreator==='叶罹'&&client?.bookVersion==='0.4.24'&&client?.allowed&&client?.terminal&&client?.grid&&client?.hidden&&client?.choiceCount===2&&client?.freeInput&&client?.clickFilled&&client?.freeKeepsDraft&&client?.presetNormalized&&client?.normalizedClickFilled&&client?.terminalFallback&&client?.terminalNoNodeText&&client?.legacyCounterScrubbed&&client?.bridgeVersion==='1.3.0'&&client?.terminalGradient&&client?.gridGradient&&client?.choiceGradients?.every(Boolean)&&client?.choiceMinHeights?.every(x=>x>=44)&&client?.stacked&&client?.gridFits&&client?.desktop?.multiColumn&&client?.desktop?.gridFits;
if(!ok)throw new Error(`release candidate real-ST/browser acceptance failed: ${JSON.stringify(client)}`);
