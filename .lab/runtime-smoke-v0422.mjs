import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, ONEFILE_VERSION } from './qidu-card-v0422-npc-knowledge.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'lab-evidence';
const stDir=process.env.LAB_ST_DIR;
if(!stDir)throw new Error('LAB_ST_DIR required');
await fs.mkdir(evidenceDir,{recursive:true});
await fs.rm(path.join(stDir,'public/scripts/extensions/third-party/qidu-choice-bridge'),{recursive:true,force:true});
await fs.rm(path.join(stDir,'public/scripts/extensions/third-party/lingqi-lab-probe'),{recursive:true,force:true});

const {card,raw,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const book=card.data.character_book?.entries||[];
const by=p=>book.find(e=>String(e.name||'').startsWith(p));
const scripts=card.data.extensions?.regex_scripts||[];
const scriptBy=id=>scripts.find(x=>x?.id===id);
const replacement=id=>String(scriptBy(id)?.replaceString||'');
const terminalReplacement=replacement('f7d-terminal-v040');
const choicesReplacement=replacement('f7d-choices-wrap-v0414');
const choiceReplacement=replacement('f7d-choice-button-v0414');
const stateReplacement=replacement('f7d-state-hide-v040');
const staticChecks={
  version:card.data.character_version===ONEFILE_VERSION,
  worldbook55:book.length===55,
  regex4:scripts.length>=4,
  terminalRegexPresent:Boolean(scriptBy('f7d-terminal-v040')),
  choicesRegexPresent:Boolean(scriptBy('f7d-choices-wrap-v0414')),
  choiceRegexPresent:Boolean(scriptBy('f7d-choice-button-v0414')),
  stateHideRegexPresent:Boolean(scriptBy('f7d-state-hide-v040')),
  terminalBeautified:/data-f7d-terminal/.test(terminalReplacement)&&/linear-gradient/.test(terminalReplacement)&&/border-radius/.test(terminalReplacement),
  choicesBeautified:/data-f7d-choice-grid/.test(choicesReplacement)&&/display:grid/.test(choicesReplacement)&&/linear-gradient/.test(choicesReplacement),
  choiceTilesBeautified:/data-f7d-choice/.test(choiceReplacement)&&/<label\b/i.test(choiceReplacement)&&/min-height:44px/.test(choiceReplacement)&&/linear-gradient/.test(choiceReplacement),
  choiceTargetsComposer:/for=\"send_textarea\"/.test(choiceReplacement),
  stateActuallyHidden:stateReplacement==='',
  depth0:card.data.extensions?.depth_prompt?.depth===0,
  identityGate:Boolean(by('04｜')?.content?.includes('角色首次识别门禁｜隐藏执行')),
  requiredCast:Boolean(by('04｜')?.content?.includes('场景必出角色连续性检查')),
  tokenOrder:Boolean(by('04｜')?.content?.includes('高校初见姓名令牌顺序锁｜隐藏执行')),
  mandatoryState:Boolean(by('04｜')?.content?.includes('状态块强制提交｜隐藏执行')),
  firstSightFocus:Boolean(by('04｜')?.content?.includes('首次目击去标签焦点｜隐藏执行')),
  npcKnowledgeGate:Boolean(by('04｜')?.content?.includes('NPC知识来源门禁｜隐藏执行')),
  offscreenSourceLock:Boolean(by('04｜')?.content?.includes('镜头外已经有人告诉她')),
  schoolPair:Boolean(by('30｜')?.content?.includes('高校双人初见硬锁')),
  schoolOrder:Boolean(by('30｜')?.content?.includes('高校2/6姓名顺序不可交换')),
  schoolNoRecall:Boolean(by('30｜')?.content?.includes('2/6目击阶段禁主动回想姓名')),
  kajiGate:Boolean(by('44｜')?.content?.includes('首次出场识别硬锁')),
  kajiKnowledgeBoundary:Boolean(by('44｜')?.content?.includes('活骸知识边界')),
  teslaRequired:Boolean(by('67｜')?.content?.includes('高校主线不可省略')),
  knownSemantics:Boolean(by('91｜')?.content?.includes('known字段身份语义')),
  playerIntelNotNpcIntel:Boolean(by('91｜')?.content?.includes('玩家知识不等于NPC知识')),
  npcIntelLedger:Boolean(by('91｜')?.content?.includes('NPC知识账本npc_intel')),
  stateInvariant:Boolean(by('91｜')?.content?.includes('每轮状态块不可省略')),
  noBridge:!card.data.extensions?.qidu_choice_bridge
};
const sm=String(card.data.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
if(!sm)throw new Error('first state missing');
const initial=JSON.parse(sm[1]);
const initialChecks={
  kajiUnknown:!initial.known?.includes('珈儿'),
  teslaUnknown:!initial.known?.includes('泰丝拉'),
  countdownVisible:initial.intel_flags?.countdown_visible_to_user===true,
  npcIntelObject:Boolean(initial.npc_intel&&typeof initial.npc_intel==='object'&&!Array.isArray(initial.npc_intel)),
  npcIntelInitiallyEmpty:Object.keys(initial.npc_intel||{}).length===0
};

const form=new FormData();
form.set('file_type','json');
form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-v0422.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});
const importText=await imported.text();
const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
let client=null;
try{
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!r||r.status()>=400)throw new Error(`HTTP ${r?.status()}`);
  await page.waitForTimeout(2200);
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});
  client=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');
    const eng=await import('/scripts/extensions/regex/engine.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version);
    if(idx<0)return{error:'not-found'};
    st.setCharacterId(idx);
    const ch=st.characters[idx];
    eng.allowScopedScripts(ch);
    const sample='<f7d_terminal>任务：选项与美化实机验收</f7d_terminal><f7d_state>{"secret":1}</f7d_state><f7d_choices><f7d_choice>继续观察</f7d_choice><f7d_choice>询问珈儿</f7d_choice></f7d_choices>';
    const html=st.messageFormatting(sample,'七都UI测试',false,false,999999,{},false);
    const old=document.getElementById('qidu-ui-smoke-mount');if(old)old.remove();
    const h=document.createElement('div');
    h.id='qidu-ui-smoke-mount';
    h.style.cssText='position:fixed;z-index:2147483000;left:12px;bottom:12px;width:min(780px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:10px;border-radius:16px;background:rgba(5,10,18,.92);box-shadow:0 14px 40px rgba(0,0,0,.45);';
    h.innerHTML=html;
    document.body.appendChild(h);
    const labels=[...h.querySelectorAll('[data-f7d-choice="1"]')];
    const term=h.querySelector('[data-f7d-terminal="1"]');
    const grid=h.querySelector('[data-f7d-choice-grid="1"]');
    const styleOf=el=>el?getComputedStyle(el):null;
    const rectOf=el=>el?(()=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})():null;
    const ts=styleOf(term),gs=styleOf(grid),ls=labels.map(styleOf);
    const textarea=document.getElementById('send_textarea');
    const before=textarea?.value??null;
    if(labels[0])labels[0].click();
    await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    const after=textarea?.value??null;
    const labelRects=labels.map(rectOf);
    const res={
      allowed:eng.isScopedScriptsAllowed(ch),
      labels:labels.map(x=>x.textContent?.trim()),
      count:labels.length,
      terminal:Boolean(term),
      grid:Boolean(grid),
      terminalHeading:/CENTRAL COURT\s*\/\/\s*TACTICAL TERMINAL/i.test(term?.textContent||''),
      secret:h.textContent?.includes('secret')||false,
      bridge:Boolean(window.__QIDU_CHOICE_BRIDGE__),
      probe:Boolean(window.__LINGQI_LAB_PROBE__),
      choiceFor:labels.map(x=>x.getAttribute('for')),
      composerExists:Boolean(textarea),
      focusAfterChoice:document.activeElement===textarea,
      composerValueUnchanged:before===after,
      ui:{
        terminalGradient:Boolean(ts?.backgroundImage&&ts.backgroundImage!=='none'),
        terminalRadius:parseFloat(ts?.borderRadius||'0'),
        terminalPadding:ts?.padding||'',
        gridDisplay:gs?.display||'',
        gridGradient:Boolean(gs?.backgroundImage&&gs.backgroundImage!=='none'),
        gridRadius:parseFloat(gs?.borderRadius||'0'),
        choiceGradients:ls.map(s=>Boolean(s?.backgroundImage&&s.backgroundImage!=='none')),
        choiceRadii:ls.map(s=>parseFloat(s?.borderRadius||'0')),
        choiceMinHeights:ls.map(s=>parseFloat(s?.minHeight||'0')),
        choiceCursors:ls.map(s=>s?.cursor||''),
        mount:rectOf(h),
        grid:rectOf(grid),
        labels:labelRects
      }
    };
    return res;
  },{name:card.data.name,version:ONEFILE_VERSION});
  client.mobile={
    stacked:Boolean(client?.ui?.labels?.length===2&&client.ui.labels[1].top>client.ui.labels[0].top+4),
    gridFits:Boolean(client?.ui?.grid&&client?.ui?.mount&&client.ui.grid.right<=client.ui.mount.right+2&&client.ui.grid.left>=client.ui.mount.left-2)
  };
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0422-ui-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1366,height:768});
  await page.waitForTimeout(150);
  client.desktop=await page.evaluate(()=>{
    const h=document.getElementById('qidu-ui-smoke-mount');
    const grid=h?.querySelector('[data-f7d-choice-grid="1"]');
    const labels=[...(h?.querySelectorAll('[data-f7d-choice="1"]')||[])];
    const rect=e=>e?(()=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})():null;
    const rs=labels.map(rect),hr=rect(h),gr=rect(grid);
    return{
      mount:hr,grid:gr,labels:rs,
      multiColumn:Boolean(rs.length===2&&Math.abs(rs[0].top-rs[1].top)<4&&rs[1].left>rs[0].left+20),
      gridFits:Boolean(gr&&hr&&gr.right<=hr.right+2&&gr.left>=hr.left-2)
    };
  });
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0422-ui-desktop.png'),fullPage:true});
  await page.evaluate(()=>document.getElementById('qidu-ui-smoke-mount')?.remove());
}finally{await browser.close()}

const report={version:ONEFILE_VERSION,hash:compactSha256,import:{ok:imported.ok,status:imported.status,text:importText.slice(0,200)},staticChecks,initialChecks,client,pageErrors};
await fs.writeFile(path.join(evidenceDir,'qidu-v0422-runtime-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.22.json'),raw);
console.log(JSON.stringify(report,null,2));
const fail=[...Object.entries(staticChecks).filter(([,v])=>!v).map(([k])=>`static:${k}`),...Object.entries(initialChecks).filter(([,v])=>!v).map(([k])=>`initial:${k}`)];
if(!imported.ok)fail.push(`import:${imported.status}`);
const uiOk=Boolean(
  client&&!client.error&&client.allowed&&client.count===2&&client.terminal&&client.grid&&!client.secret&&!client.bridge&&!client.probe&&
  client.terminalHeading&&client.choiceFor?.every(x=>x==='send_textarea')&&client.composerExists&&client.focusAfterChoice&&client.composerValueUnchanged&&
  client.ui?.terminalGradient&&client.ui?.terminalRadius>=10&&client.ui?.gridDisplay==='grid'&&client.ui?.gridGradient&&client.ui?.gridRadius>=10&&
  client.ui?.choiceGradients?.length===2&&client.ui.choiceGradients.every(Boolean)&&client.ui?.choiceRadii?.every(x=>x>=8)&&client.ui?.choiceMinHeights?.every(x=>x>=44)&&
  client.mobile?.stacked&&client.mobile?.gridFits&&client.desktop?.multiColumn&&client.desktop?.gridFits
);
if(!uiOk)fail.push(`ui:${JSON.stringify(client)}`);
if(pageErrors.length)fail.push(`page:${pageErrors.join('|')}`);
if(fail.length)throw new Error(`v0422 smoke failed ${fail.join(',')}`);
