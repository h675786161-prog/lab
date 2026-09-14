import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, ONEFILE_VERSION } from './qidu-card-v0423-author-secret-guard.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'lab-evidence';
const stDir=process.env.LAB_ST_DIR;
if(!stDir) throw new Error('LAB_ST_DIR required');
await fs.mkdir(evidenceDir,{recursive:true});
await fs.rm(path.join(stDir,'public/scripts/extensions/third-party/qidu-choice-bridge'),{recursive:true,force:true});
await fs.rm(path.join(stDir,'public/scripts/extensions/third-party/lingqi-lab-probe'),{recursive:true,force:true});

const {card,raw,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const book=card.data.character_book?.entries||[];
const by=p=>book.find(e=>String(e.name||'').startsWith(p));
const scripts=card.data.extensions?.regex_scripts||[];
const rx=id=>scripts.find(x=>x?.id===id);
const repl=id=>String(rx(id)?.replaceString??'');
const metaText=JSON.stringify({creator:card.data.creator,creator_notes:card.data.creator_notes});
const staticChecks={
  version:card.data.character_version===ONEFILE_VERSION,
  author:card.data.creator==='叶罹',
  authorNotesClean:card.data.creator_notes==='《永远的7日之都》七日轮回文本互动角色卡。',
  noDevProvenanceInPublicMeta:!/(github|h675786161|实验酒馆|玲七|仓库地址|repository)/i.test(metaText),
  worldbook55:book.length===55,
  regex4:scripts.length>=4,
  terminalRegex:Boolean(rx('f7d-terminal-v040')),
  choicesRegex:Boolean(rx('f7d-choices-wrap-v0414')),
  choiceRegex:Boolean(rx('f7d-choice-button-v0414')),
  stateRegex:Boolean(rx('f7d-state-hide-v040')),
  terminalBeautified:/linear-gradient/.test(repl('f7d-terminal-v040'))&&/border-radius/.test(repl('f7d-terminal-v040')),
  choiceGridBeautified:/display:grid/.test(repl('f7d-choices-wrap-v0414'))&&/linear-gradient/.test(repl('f7d-choices-wrap-v0414')),
  choiceTileBeautified:/<label\b/i.test(repl('f7d-choice-button-v0414'))&&/for="send_textarea"/.test(repl('f7d-choice-button-v0414'))&&/min-height:44px/.test(repl('f7d-choice-button-v0414'))&&/linear-gradient/.test(repl('f7d-choice-button-v0414')),
  stateHidden:repl('f7d-state-hide-v040')==='',
  depth0:card.data.extensions?.depth_prompt?.depth===0,
  identityGate:Boolean(by('04｜')?.content?.includes('角色首次识别门禁｜隐藏执行')),
  requiredCast:Boolean(by('04｜')?.content?.includes('场景必出角色连续性检查')),
  firstSightFocus:Boolean(by('04｜')?.content?.includes('首次目击去标签焦点｜隐藏执行')),
  npcKnowledgeGate:Boolean(by('04｜')?.content?.includes('NPC知识来源门禁｜隐藏执行')),
  lockedSecretSuppression:Boolean(by('04｜')?.content?.includes('未解锁秘密名词消隐｜隐藏执行')),
  day6ZeroNegationLock:Boolean(by('11｜')?.content?.includes('第6天零身份仍锁定时禁止否定式点名')),
  npcIntelLedger:Boolean(by('91｜')?.content?.includes('NPC知识账本npc_intel')),
  secretFlagNameLock:Boolean(by('91｜')?.content?.includes('秘密旗标控制可见专名')),
  noBridge:!card.data.extensions?.qidu_choice_bridge
};
const sm=String(card.data.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
if(!sm) throw new Error('first state missing');
const initial=JSON.parse(sm[1]);
const initialChecks={kajiUnknown:!initial.known?.includes('珈儿'),teslaUnknown:!initial.known?.includes('泰丝拉'),npcIntelObject:Boolean(initial.npc_intel&&typeof initial.npc_intel==='object'&&!Array.isArray(initial.npc_intel)),npcIntelInitiallyEmpty:Object.keys(initial.npc_intel||{}).length===0,zeroLocked:initial.intel_flags?.zero_identity_known===false};

const form=new FormData();
form.set('file_type','json');
form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-v0423.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});
const importText=await imported.text();
const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
let client=null;
try{
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!r||r.status()>=400) throw new Error(`HTTP ${r?.status()}`);
  await page.waitForTimeout(2200);
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});
  client=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');
    const eng=await import('/scripts/extensions/regex/engine.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version);
    if(idx<0)return{error:'not-found'};
    st.setCharacterId(idx);const ch=st.characters[idx];eng.allowScopedScripts(ch);
    const sample='<f7d_terminal>任务：作者与UI最终验收</f7d_terminal><f7d_state>{"secret":1}</f7d_state><f7d_choices><f7d_choice>继续观察</f7d_choice><f7d_choice>询问珈儿</f7d_choice></f7d_choices>';
    const html=st.messageFormatting(sample,'七都UI测试',false,false,999999,{},false);
    const textarea=document.getElementById('send_textarea');

    // Functional behavior must be tested outside a modal top layer. A modal dialog intentionally traps focus,
    // so checking label -> textarea focus from inside the modal would be a browser-test artifact rather than card behavior.
    const behavior=document.createElement('div');
    behavior.id='qidu-v0423-behavior-probe';
    behavior.style.cssText='position:absolute;left:-10000px;top:0;width:780px;';
    behavior.innerHTML=html;
    document.body.appendChild(behavior);
    const behaviorLabels=[...behavior.querySelectorAll('[data-f7d-choice="1"]')];
    const before=textarea?.value??null;
    if(behaviorLabels[0])behaviorLabels[0].click();
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const after=textarea?.value??null;
    const focusAfterChoice=document.activeElement===textarea;
    const composerValueUnchanged=before===after;
    const behaviorChoiceFor=behaviorLabels.map(x=>x.getAttribute('for'));
    behavior.remove();

    // Separate visible top-layer mount for layout/style QA and screenshots.
    const h=document.createElement('dialog');
    h.id='qidu-v0423-smoke';
    h.style.cssText='position:fixed;z-index:2147483647;left:12px;top:72px;right:auto;bottom:auto;margin:0;width:min(780px,calc(100vw - 24px));max-width:none;padding:10px;border:0;border-radius:16px;background:rgba(5,10,18,.96);';
    h.innerHTML=html;document.body.appendChild(h);h.showModal();
    const term=h.querySelector('[data-f7d-terminal="1"]'),grid=h.querySelector('[data-f7d-choice-grid="1"]'),labels=[...h.querySelectorAll('[data-f7d-choice="1"]')];
    const rect=e=>e?(()=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})():null;
    const ts=term?getComputedStyle(term):null,gs=grid?getComputedStyle(grid):null,ls=labels.map(x=>getComputedStyle(x));
    const hr=rect(h),gr=rect(grid),rs=labels.map(rect);
    return{allowed:eng.isScopedScriptsAllowed(ch),count:labels.length,labels:labels.map(x=>x.textContent?.trim()),terminal:Boolean(term),grid:Boolean(grid),hiddenStateVisible:h.textContent?.includes('secret')||false,choiceFor:labels.map(x=>x.getAttribute('for')),behaviorChoiceFor,focusAfterChoice,composerValueUnchanged,bridge:Boolean(window.__QIDU_CHOICE_BRIDGE__),probe:Boolean(window.__LINGQI_LAB_PROBE__),ui:{terminalGradient:Boolean(ts?.backgroundImage&&ts.backgroundImage!=='none'),gridGradient:Boolean(gs?.backgroundImage&&gs.backgroundImage!=='none'),gridDisplay:gs?.display||'',choiceGradients:ls.map(s=>Boolean(s?.backgroundImage&&s.backgroundImage!=='none')),choiceMinHeights:ls.map(s=>parseFloat(s?.minHeight||'0')),mount:hr,gridRect:gr,labelRects:rs,stacked:Boolean(rs.length===2&&rs[1].top>rs[0].top+4),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2)}};
  },{name:card.data.name,version:ONEFILE_VERSION});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0423-ui-mobile.png'),fullPage:false});
  await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(150);
  client.desktop=await page.evaluate(()=>{const h=document.getElementById('qidu-v0423-smoke'),g=h?.querySelector('[data-f7d-choice-grid="1"]'),ls=[...(h?.querySelectorAll('[data-f7d-choice="1"]')||[])];const R=e=>e?e.getBoundingClientRect():null;const hr=R(h),gr=R(g),rs=ls.map(R);return{multiColumn:Boolean(rs.length===2&&Math.abs(rs[0].top-rs[1].top)<4&&rs[1].left>rs[0].left+20),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2)}});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0423-ui-desktop.png'),fullPage:false});
}finally{await browser.close()}

const report={version:ONEFILE_VERSION,hash:compactSha256,creator:card.data.creator,creator_notes:card.data.creator_notes,import:{ok:imported.ok,status:imported.status,text:importText.slice(0,200)},staticChecks,initialChecks,client,pageErrors};
await fs.writeFile(path.join(evidenceDir,'qidu-v0423-runtime-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.23.json'),raw);
console.log(JSON.stringify(report,null,2));
const fail=[...Object.entries(staticChecks).filter(([,v])=>!v).map(([k])=>`static:${k}`),...Object.entries(initialChecks).filter(([,v])=>!v).map(([k])=>`initial:${k}`)];
if(!imported.ok)fail.push(`import:${imported.status}`);
const uiOk=Boolean(client&&!client.error&&client.allowed&&client.count===2&&client.terminal&&client.grid&&!client.hiddenStateVisible&&!client.bridge&&!client.probe&&client.choiceFor?.every(x=>x==='send_textarea')&&client.behaviorChoiceFor?.every(x=>x==='send_textarea')&&client.focusAfterChoice&&client.composerValueUnchanged&&client.ui?.terminalGradient&&client.ui?.gridGradient&&client.ui?.gridDisplay==='grid'&&client.ui?.choiceGradients?.every(Boolean)&&client.ui?.choiceMinHeights?.every(x=>x>=44)&&client.ui?.stacked&&client.ui?.gridFits&&client.desktop?.multiColumn&&client.desktop?.gridFits);
if(!uiOk)fail.push(`ui:${JSON.stringify(client)}`);
if(pageErrors.length)fail.push(`page:${pageErrors.join('|')}`);
if(fail.length)throw new Error(`v0423 smoke failed ${fail.join(',')}`);
