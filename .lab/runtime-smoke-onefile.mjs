import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, ONEFILE_VERSION } from './qidu-card-v0415-onefile.mjs';

const baseUrl = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const evidenceDir = process.env.LAB_EVIDENCE_DIR || 'lab-evidence';
const stDir = process.env.LAB_ST_DIR;
await fs.mkdir(evidenceDir, { recursive: true });
if (!stDir) throw new Error('LAB_ST_DIR required');

// Acceptance must prove the card works without the old helper extension.
await fs.rm(path.join(stDir, 'public/scripts/extensions/third-party/qidu-choice-bridge'), { recursive:true, force:true });
await fs.rm(path.join(stDir, 'public/scripts/extensions/third-party/lingqi-lab-probe'), { recursive:true, force:true });

const { card, raw, compactSha256 } = await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE || process.cwd(), { skipHashCheck:true });
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
  choiceTargetsTextarea: String(choice?.replaceString||'').includes('for="send_textarea"'),
  tolerantWhitespace: String(choice?.findRegex||'').includes('\\s*f7d_choice'),
  terminalIsRealHtml: !String(terminal?.replaceString||'').includes('```'),
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

async function renderCase(viewport, spaced=false){
  await page.setViewportSize(viewport);
  const hostId = `qidu-onefile-${spaced ? 'spaced' : 'canonical'}`;
  const result = await page.evaluate(async ({terminal,stateHide,wrap,choice,spaced,hostId})=>{
    const { runRegexScript } = await import('/scripts/extensions/regex/engine.js');
    const { messageFormatting } = await import('/script.js');
    const ta=document.querySelector('#send_textarea');
    if(!(ta instanceof HTMLTextAreaElement)) return {error:'no textarea'};
    ta.blur();
    const tags=spaced
      ? '< f7d_terminal >任务：测试终端< / f7d_terminal >< f7d_state >SECRET< / f7d_state >< f7d_choices >< f7d_choice >去高校< / f7d_choice >< f7d_choice >留在中央庭< / f7d_choice >< / f7d_choices >'
      : '<f7d_terminal>任务：测试终端</f7d_terminal><f7d_state>SECRET</f7d_state><f7d_choices><f7d_choice>去高校</f7d_choice><f7d_choice>留在中央庭</f7d_choice></f7d_choices>';
    let html=tags;
    for(const s of [terminal,stateHide,wrap,choice]) html=runRegexScript(s,html);
    const formatted=messageFormatting(html,'七都UI测试',false,false,999999,{},false);
    document.getElementById(hostId)?.remove();
    const host=document.createElement('div'); host.id=hostId; host.innerHTML=formatted; host.style.width='100%'; document.body.appendChild(host);
    const labels=[...host.querySelectorAll('[data-f7d-choice="1"]')];
    const grid=host.querySelector('[data-f7d-choice-grid="1"]');
    const term=host.querySelector('[data-f7d-terminal="1"]');
    return {
      spaced,
      labels:labels.map(x=>x.textContent?.trim()),
      labelCount:labels.length,
      labelFor:labels[0]?.getAttribute('for')||null,
      secretVisible:host.textContent?.includes('SECRET')||false,
      terminalVisible:Boolean(term)&&term.textContent?.includes('任务：测试终端'),
      rawTagsRemain:/f7d_(?:terminal|state|choices?|choice)/i.test(host.textContent||''),
      gridColumns:grid?getComputedStyle(grid).gridTemplateColumns:null,
      gridWidth:grid?getComputedStyle(grid).width:null,
      minHeight:labels[0]?getComputedStyle(labels[0]).minHeight:null,
      bridgePresent:Boolean(window.__QIDU_CHOICE_BRIDGE__),
      probePresent:Boolean(window.__LINGQI_LAB_PROBE__),
    };
  },{terminal,stateHide,wrap,choice,spaced,hostId});
  if(result?.labelCount){
    await page.locator(`#${hostId} [data-f7d-choice="1"]`).first().click();
    await page.waitForTimeout(50);
    result.focused = await page.evaluate(()=>document.activeElement?.id === 'send_textarea');
  } else result.focused = false;
  await page.evaluate(id=>document.getElementById(id)?.remove(), hostId);
  return result;
}

let api=null,desktop=null,mobile=null;
try{
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!r||r.status()>=400) throw new Error(`ST HTTP ${r?.status()}`);
  await page.waitForTimeout(2500);
  api=await page.evaluate(async ({name,version})=>{
    let r=await fetch('/api/characters/all',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});let text=await r.text();let data;try{data=JSON.parse(text)}catch{data=null}
    if(!r.ok||!data){r=await fetch('/api/characters/all');text=await r.text();try{data=JSON.parse(text)}catch{data=null}}
    const arr=Array.isArray(data)?data:Array.isArray(data?.characters)?data.characters:(data&&typeof data==='object'?Object.values(data):[]);
    const found=arr.find(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version);
    return {ok:r.ok,found:Boolean(found),version:found?.data?.character_version||null,entries:found?.data?.character_book?.entries?.length||0,regexCount:found?.data?.extensions?.regex_scripts?.length||0,bridge:Boolean(found?.data?.extensions?.qidu_choice_bridge),frontend:found?.data?.extensions?.qidu_frontend||null};
  },{name:card.data.name,version:ONEFILE_VERSION});
  desktop=await renderCase({width:1440,height:1000},false);
  mobile=await renderCase({width:390,height:844},true);
  await page.screenshot({path:path.join(evidenceDir,'qidu-onefile-mobile.png'),fullPage:true});
}finally{await browser.close();}

const report={version:card.data.character_version,hash:compactSha256,import:{ok:imported.ok,status:imported.status,text:importText.slice(0,300)},staticChecks,api,desktop,mobile,pageErrors,consoleErrors};
await fs.writeFile(path.join(evidenceDir,'qidu-onefile-runtime-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.15-onefile.json'),raw);
console.log(JSON.stringify(report,null,2));

const failed=Object.entries(staticChecks).filter(([,v])=>!v).map(([k])=>k);
if(!imported.ok) throw new Error(`import failed ${imported.status}: ${importText}`);
if(failed.length) throw new Error(`static failed: ${failed.join(',')}`);
if(!api?.ok||!api?.found||api?.version!==ONEFILE_VERSION||api?.entries!==55||api?.regexCount<4||api?.bridge||api?.frontend?.external_extension_required!==false) throw new Error(`api failed ${JSON.stringify(api)}`);
for(const [name,x] of [['desktop',desktop],['mobile',mobile]]){
  if(x?.labelCount!==2||x?.labelFor!=='send_textarea'||!x?.focused||x?.secretVisible||!x?.terminalVisible||x?.rawTagsRemain||x?.bridgePresent||x?.probePresent) throw new Error(`${name} failed ${JSON.stringify(x)}`);
}
if(pageErrors.length) throw new Error(`page errors: ${pageErrors.join(' | ')}`);
