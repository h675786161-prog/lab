import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, ONEFILE_VERSION } from './qidu-card-v0417-knowledge-gate.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'lab-evidence';
const stDir=process.env.LAB_ST_DIR;
if(!stDir) throw new Error('LAB_ST_DIR required');
await fs.mkdir(evidenceDir,{recursive:true});
await fs.rm(path.join(stDir,'public/scripts/extensions/third-party/qidu-choice-bridge'),{recursive:true,force:true});
await fs.rm(path.join(stDir,'public/scripts/extensions/third-party/lingqi-lab-probe'),{recursive:true,force:true});

const {card,raw,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const book=card.data.character_book?.entries||[];
const protocol=book.find(e=>String(e.name||'').startsWith('04｜'));
const day7=book.find(e=>String(e.name||'').startsWith('10｜'));
const hiro=book.find(e=>String(e.name||'').startsWith('43｜'));
const stateEntry=book.find(e=>String(e.name||'').startsWith('91｜'));
const scripts=card.data.extensions?.regex_scripts||[];
const staticChecks={
  version:card.data.character_version===ONEFILE_VERSION,
  worldbook55:book.length===55,
  regex4:scripts.length>=4,
  depth0:card.data.extensions?.depth_prompt?.depth===0,
  infoGate:Boolean(protocol?.content?.includes('信息权限判定链｜隐藏执行')),
  countdownGate:Boolean(day7?.content?.includes('安托涅瓦')&&day7?.content?.includes('都看不见')),
  hiroGate:Boolean(hiro?.content?.includes('不说“我现在不是指挥使了”')),
  stateGate:Boolean(stateEntry?.content?.includes('intel_flags信息门')),
  noBridge:!card.data.extensions?.qidu_choice_bridge,
};
const sm=String(card.data.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
if(!sm) throw new Error('first_mes state missing');
const initialState=JSON.parse(sm[1]);
const initialChecks={
  countdownVisible:initialState.intel_flags?.countdown_visible_to_user===true,
  countdownMeaningLocked:initialState.intel_flags?.countdown_meaning_known===false,
  chimeraLocked:initialState.intel_flags?.chimera_exists_known===false,
  zeroLocked:initialState.intel_flags?.zero_identity_known===false,
  loopLocked:initialState.intel_flags?.loop_truth_known===false,
};

const form=new FormData(); form.set('file_type','json'); form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-card-v0417.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form}); const importText=await imported.text();

const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844}}); const pageErrors=[]; page.on('pageerror',e=>pageErrors.push(String(e)));
let client=null;
try{
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000}); if(!r||r.status()>=400) throw new Error(`ST HTTP ${r?.status()}`); await page.waitForTimeout(2500);
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});
  client=await page.evaluate(async ({name,version,firstMes})=>{
    const st=await import('/script.js'); const eng=await import('/scripts/extensions/regex/engine.js'); await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version); if(idx<0)return{error:'not found'};
    st.setCharacterId(idx); const ch=st.characters[idx]; eng.allowScopedScripts(ch);
    const sample='<f7d_terminal>任务：知识闸门测试</f7d_terminal><f7d_state>{"secret":1}</f7d_state><f7d_choices><f7d_choice>继续询问安托涅瓦</f7d_choice><f7d_choice>先观察那个数字</f7d_choice></f7d_choices>';
    const formatted=st.messageFormatting(sample,'七都UI测试',false,false,999999,{},false);
    const host=document.createElement('div'); host.innerHTML=formatted; document.body.appendChild(host);
    const choices=[...host.querySelectorAll('[data-f7d-choice="1"]')]; const terminal=host.querySelector('[data-f7d-terminal="1"]'); const grid=host.querySelector('[data-f7d-choice-grid="1"]');
    const first=st.messageFormatting(firstMes,name,false,false,0,{},false); const fh=document.createElement('div'); fh.innerHTML=first;
    const result={
      regexAllowed:eng.isScopedScriptsAllowed(ch), labelCount:choices.length, labels:choices.map(x=>x.textContent?.trim()), terminalVisible:Boolean(terminal), secretVisible:host.textContent?.includes('secret')||false,
      mobileColumns:grid?getComputedStyle(grid).gridTemplateColumns:null, minHeight:choices[0]?getComputedStyle(choices[0]).minHeight:null,
      firstStateHidden:!fh.textContent?.includes('countdown_visible_to_user')&&!fh.textContent?.includes('f7d_textloop_0.4'), bridge:Boolean(window.__QIDU_CHOICE_BRIDGE__), probe:Boolean(window.__LINGQI_LAB_PROBE__),
    }; host.remove(); eng.disallowScopedScripts(ch); return result;
  },{name:card.data.name,version:ONEFILE_VERSION,firstMes:card.data.first_mes});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0417-real-st.png'),fullPage:true});
}finally{await browser.close();}

const report={version:ONEFILE_VERSION,hash:compactSha256,import:{ok:imported.ok,status:imported.status,text:importText.slice(0,240)},staticChecks,initialChecks,client,pageErrors};
await fs.writeFile(path.join(evidenceDir,'qidu-v0417-runtime-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.17.json'),raw);
console.log(JSON.stringify(report,null,2));
const failed=[...Object.entries(staticChecks).filter(([,v])=>!v).map(([k])=>`static:${k}`),...Object.entries(initialChecks).filter(([,v])=>!v).map(([k])=>`initial:${k}`)];
if(!imported.ok)failed.push(`import:${imported.status}`);
if(client?.error||!client?.regexAllowed||client?.labelCount!==2||!client?.terminalVisible||client?.secretVisible||!client?.firstStateHidden||client?.bridge||client?.probe)failed.push(`client:${JSON.stringify(client)}`);
if(pageErrors.length)failed.push(`page:${pageErrors.join('|')}`);
if(failed.length)throw new Error(`v0417 real ST failed: ${failed.join(', ')}`);
