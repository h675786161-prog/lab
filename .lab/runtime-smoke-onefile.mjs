import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, ONEFILE_VERSION } from './qidu-card-v0415-onefile.mjs';

const baseUrl = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const evidenceDir = process.env.LAB_EVIDENCE_DIR || 'lab-evidence';
const stDir = process.env.LAB_ST_DIR;
await fs.mkdir(evidenceDir, { recursive:true });
if (!stDir) throw new Error('LAB_ST_DIR required');

// Real acceptance: no helper bridge/probe may rescue the card.
await fs.rm(path.join(stDir,'public/scripts/extensions/third-party/qidu-choice-bridge'), {recursive:true,force:true});
await fs.rm(path.join(stDir,'public/scripts/extensions/third-party/lingqi-lab-probe'), {recursive:true,force:true});

const { card, raw, compactSha256 } = await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE || process.cwd(), {skipHashCheck:true});
const scripts = card.data.extensions?.regex_scripts || [];
const byId = id => scripts.find(x => x?.id === id);
const terminal = byId('f7d-terminal-v040');
const stateHide = byId('f7d-state-hide-v040');
const wrap = byId('f7d-choices-wrap-v0414');
const choice = byId('f7d-choice-button-v0414');
const staticChecks = {
  version: card.data.character_version === ONEFILE_VERSION,
  worldbook55: (card.data.character_book?.entries || []).length === 55,
  fourEmbeddedRegex: [terminal,stateHide,wrap,choice].every(Boolean),
  noBridgeDependency: !card.data.extensions?.qidu_choice_bridge,
  frontendEmbedded: card.data.extensions?.qidu_frontend?.external_extension_required === false,
  noInlineJs: !String(choice?.replaceString||'').match(/on(?:click|pointer|mouse|touch|error|load)\s*=/i),
  tolerantWhitespace: String(choice?.findRegex||'').includes('\\s*f7d_choice'),
};

const form = new FormData();
form.set('file_type','json');
form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-card-v0.4.15-onefile.json');
const imported = await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});
const importText = await imported.text();

const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser = await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const pageErrors=[]; const consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
page.on('console',m=>{if(m.type()==='error') consoleErrors.push(m.text());});

async function exerciseScopedRegex(viewport, spaced=false){
  await page.setViewportSize(viewport);
  return page.evaluate(async ({name,version,firstMes,spaced})=>{
    const st = await import('/script.js');
    const eng = await import('/scripts/extensions/regex/engine.js');
    await st.getCharacters();
    const idx = st.characters.findIndex(x => (x?.data?.name||x?.name)===name && x?.data?.character_version===version);
    if(idx < 0) return {error:'imported character not found in client',clientCharacters:st.characters.map(x=>({name:x?.data?.name||x?.name,version:x?.data?.character_version,avatar:x?.avatar}))};
    st.setCharacterId(idx);
    const character = st.characters[idx];

    // Fresh ST profile should NOT trust character-scoped regex automatically.
    eng.disallowScopedScripts(character);
    const scopedCount = eng.getScriptsByType(eng.SCRIPT_TYPES.SCOPED).length;
    const allowedBefore = eng.isScopedScriptsAllowed(character);
    const tags = spaced
      ? '< f7d_terminal >任务：测试终端< / f7d_terminal >< f7d_state >SECRET< / f7d_state >< f7d_choices >< f7d_choice >去高校< / f7d_choice >< f7d_choice >留在中央庭< / f7d_choice >< / f7d_choices >'
      : '<f7d_terminal>任务：测试终端</f7d_terminal><f7d_state>SECRET</f7d_state><f7d_choices><f7d_choice>去高校</f7d_choice><f7d_choice>留在中央庭</f7d_choice></f7d_choices>';

    // This is the real production path. getRegexedString uses allowedOnly:true internally.
    const blockedRegex = eng.getRegexedString(tags, eng.regex_placement.AI_OUTPUT, {isMarkdown:true, depth:0});
    const blockedFormatted = st.messageFormatting(tags,'七都UI测试',false,false,999999,{},false);

    // Simulate the user accepting SillyTavern's built-in "embedded regex" permission prompt.
    eng.allowScopedScripts(character);
    const allowedAfter = eng.isScopedScriptsAllowed(character);
    const enabledRegex = eng.getRegexedString(tags, eng.regex_placement.AI_OUTPUT, {isMarkdown:true, depth:0});
    const enabledFormatted = st.messageFormatting(tags,'七都UI测试',false,false,999999,{},false);
    const firstFormatted = st.messageFormatting(firstMes,name,false,false,0,{},false);

    const host=document.createElement('div');
    host.id='qidu-real-regex-host';
    host.style.width='100%';
    host.innerHTML=enabledFormatted;
    document.body.appendChild(host);
    const labels=[...host.querySelectorAll('[data-f7d-choice="1"]')];
    const grid=host.querySelector('[data-f7d-choice-grid="1"]');
    const term=host.querySelector('[data-f7d-terminal="1"]');

    const firstHost=document.createElement('div');
    firstHost.innerHTML=firstFormatted;
    const firstTerminal=firstHost.querySelector('[data-f7d-terminal="1"]');

    const result={
      spaced,
      avatar:character?.avatar||null,
      scopedCount,
      allowedBefore,
      allowedAfter,
      blockedRawStillPresent:/f7d_(?:terminal|state|choices?|choice)/i.test(blockedRegex),
      blockedFormattedRawStillPresent:/f7d_(?:terminal|state|choices?|choice)/i.test(blockedFormatted),
      enabledRegexHasHtml:enabledRegex.includes('data-f7d-terminal="1"') && enabledRegex.includes('data-f7d-choice="1"'),
      enabledRegexStateRemoved:!enabledRegex.includes('SECRET'),
      labels:labels.map(x=>x.textContent?.trim()),
      labelCount:labels.length,
      terminalVisible:Boolean(term)&&term.textContent?.includes('任务：测试终端'),
      secretVisible:host.textContent?.includes('SECRET')||false,
      rawTagsRemain:/f7d_(?:terminal|state|choices?|choice)/i.test(host.textContent||''),
      gridColumns:grid?getComputedStyle(grid).gridTemplateColumns:null,
      gridWidth:grid?getComputedStyle(grid).width:null,
      minHeight:labels[0]?getComputedStyle(labels[0]).minHeight:null,
      firstMessageTerminalRendered:Boolean(firstTerminal),
      firstMessageStateHidden:!firstHost.textContent?.includes('schema\":\"f7d_textloop_0.4') && !firstHost.textContent?.includes('"schema":"f7d_textloop_0.4"'),
      bridgePresent:Boolean(window.__QIDU_CHOICE_BRIDGE__),
      probePresent:Boolean(window.__LINGQI_LAB_PROBE__),
    };
    host.remove();
    eng.disallowScopedScripts(character);
    return result;
  },{name:card.data.name,version:ONEFILE_VERSION,firstMes:card.data.first_mes,spaced});
}

let api=null,desktop=null,mobile=null;
try{
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!r||r.status()>=400) throw new Error(`ST HTTP ${r?.status()}`);
  await page.waitForTimeout(3000);

  // Close unrelated clean-profile onboarding dialogs. We are testing regex permission in-engine below.
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close();}catch{}}});

  api=await page.evaluate(async ({name,version})=>{
    let r=await fetch('/api/characters/all',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    let text=await r.text(); let data; try{data=JSON.parse(text)}catch{data=null}
    if(!r.ok||!data){r=await fetch('/api/characters/all');text=await r.text();try{data=JSON.parse(text)}catch{data=null}}
    const arr=Array.isArray(data)?data:Array.isArray(data?.characters)?data.characters:(data&&typeof data==='object'?Object.values(data):[]);
    const found=arr.find(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version);
    return {ok:r.ok,found:Boolean(found),version:found?.data?.character_version||null,entries:found?.data?.character_book?.entries?.length||0,regexCount:found?.data?.extensions?.regex_scripts?.length||0};
  },{name:card.data.name,version:ONEFILE_VERSION});

  desktop=await exerciseScopedRegex({width:1440,height:1000},false);
  mobile=await exerciseScopedRegex({width:390,height:844},true);
  await page.screenshot({path:path.join(evidenceDir,'qidu-regex-diagnostic.png'),fullPage:true});
}finally{await browser.close();}

const diagnosis={
  rootCause:'SillyTavern blocks character-scoped embedded regex until the character avatar is explicitly allowed in extension_settings.character_allowed_regex. Previous smoke incorrectly called runRegexScript directly and bypassed this permission gate.',
  requiredUserAction:'Accept the built-in embedded-regex permission prompt for this character, or enable the current character Scoped regex toggle in Extensions > Regex.',
  cardCanForceEnable:false,
};
const report={version:card.data.character_version,hash:compactSha256,import:{ok:imported.ok,status:imported.status,text:importText.slice(0,300)},staticChecks,api,diagnosis,desktop,mobile,pageErrors,consoleErrors};
await fs.writeFile(path.join(evidenceDir,'qidu-onefile-runtime-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.15-onefile.json'),raw);
console.log(JSON.stringify(report,null,2));

const failedStatic=Object.entries(staticChecks).filter(([,v])=>!v).map(([k])=>k);
if(!imported.ok) throw new Error(`import failed ${imported.status}: ${importText}`);
if(failedStatic.length) throw new Error(`static failed: ${failedStatic.join(',')}`);
if(!api?.ok||!api?.found||api?.version!==ONEFILE_VERSION||api?.entries!==55||api?.regexCount<4) throw new Error(`api failed ${JSON.stringify(api)}`);
for(const [name,x] of [['desktop',desktop],['mobile',mobile]]){
  if(x?.allowedBefore!==false) throw new Error(`${name}: expected scoped regex to be blocked before permission: ${JSON.stringify(x)}`);
  if(x?.blockedRawStillPresent!==true || x?.blockedFormattedRawStillPresent!==true) throw new Error(`${name}: permission gate was not reproduced: ${JSON.stringify(x)}`);
  if(x?.allowedAfter!==true || !x?.enabledRegexHasHtml || !x?.enabledRegexStateRemoved) throw new Error(`${name}: regex did not activate after permission: ${JSON.stringify(x)}`);
  if(x?.labelCount!==2 || !x?.terminalVisible || x?.secretVisible || x?.rawTagsRemain || !x?.firstMessageTerminalRendered || !x?.firstMessageStateHidden || x?.bridgePresent || x?.probePresent) throw new Error(`${name}: enabled rendering failed ${JSON.stringify(x)}`);
}
if(pageErrors.length) throw new Error(`page errors: ${pageErrors.join(' | ')}`);
