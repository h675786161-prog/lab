import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduReleaseCard, ONEFILE_VERSION, RELEASE_CREATOR, RELEASE_CREATOR_NOTES, assertReleasePrivacy } from './qidu-card-v0423-release-sanitized.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'release-evidence';
await fs.mkdir(evidenceDir,{recursive:true});

const {card,raw,compactSha256}=await loadQiduReleaseCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
assertReleasePrivacy(card);
const rawText=raw.toString('utf8');
const forbidden=/(?:玲|h675786161|github\.com|raw\.githubusercontent\.com|api\.github\.com|实验酒馆|world-backstage|(?:\bLAB\b|[-_]lab\b|\blab[-_])|feature\/qidu-card)/i;
if(forbidden.test(rawText)) throw new Error('sanitized release bytes still contain private development provenance');

const form=new FormData();
form.set('file_type','json');
form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-release-v0423.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});
const importText=await imported.text();
if(!imported.ok) throw new Error(`release import failed ${imported.status}: ${importText.slice(0,200)}`);

const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
let client;
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!r||r.status()>=400) throw new Error(`ST page HTTP ${r?.status()}`);
  await page.waitForTimeout(1800);
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});
  client=await page.evaluate(async({name,version,creator,notes})=>{
    const st=await import('/script.js');
    const eng=await import('/scripts/extensions/regex/engine.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator===creator);
    if(idx<0)return{found:false};
    st.setCharacterId(idx);
    const ch=st.characters[idx];
    eng.allowScopedScripts(ch);
    const sample='<f7d_terminal>RELEASE PRIVACY // UI CHECK</f7d_terminal><f7d_state>{"hidden":1}</f7d_state><f7d_choices><f7d_choice>Continue</f7d_choice><f7d_choice>Ask Kaji</f7d_choice></f7d_choices>';
    const html=st.messageFormatting(sample,'qidu-release',false,false,777777,{},false);
    const h=document.createElement('dialog');
    h.id='qidu-v0423-release-smoke';
    h.style.cssText='position:fixed;z-index:2147483647;left:12px;top:72px;right:auto;bottom:auto;margin:0;width:min(780px,calc(100vw - 24px));max-width:none;padding:10px;border:0;border-radius:16px;background:rgba(5,10,18,.96);';
    h.innerHTML=html;document.body.appendChild(h);h.showModal();
    const term=h.querySelector('[data-f7d-terminal="1"]'),grid=h.querySelector('[data-f7d-choice-grid="1"]'),labels=[...h.querySelectorAll('[data-f7d-choice="1"]')];
    const ts=term?getComputedStyle(term):null,gs=grid?getComputedStyle(grid):null,ls=labels.map(x=>getComputedStyle(x));
    const rect=e=>e?(()=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})():null;
    const hr=rect(h),gr=rect(grid),rs=labels.map(rect);
    return{
      found:true,
      creator:ch?.data?.creator,
      notes:ch?.data?.creator_notes,
      creatorcomment:ch?.creatorcomment,
      bookCreator:ch?.data?.character_book?.extensions?.creator,
      bookVersion:ch?.data?.character_book?.extensions?.version,
      metadataClean:ch?.data?.creator===creator&&ch?.data?.creator_notes===notes&&ch?.data?.character_book?.extensions?.creator===creator&&ch?.data?.character_book?.extensions?.version===version,
      allowed:eng.isScopedScriptsAllowed(ch),
      terminal:Boolean(term),
      grid:Boolean(grid),
      choiceCount:labels.length,
      hiddenState:!h.textContent?.includes('hidden'),
      ui:{
        terminalGradient:Boolean(ts?.backgroundImage&&ts.backgroundImage!=='none'),
        gridGradient:Boolean(gs?.backgroundImage&&gs.backgroundImage!=='none'),
        gridDisplay:gs?.display||'',
        choiceGradients:ls.map(s=>Boolean(s?.backgroundImage&&s.backgroundImage!=='none')),
        choiceMinHeights:ls.map(s=>parseFloat(s?.minHeight||'0')),
        stacked:Boolean(rs.length===2&&rs[1].top>rs[0].top+4),
        gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2)
      }
    };
  },{name:card.data.name,version:ONEFILE_VERSION,creator:RELEASE_CREATOR,notes:RELEASE_CREATOR_NOTES});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0423-release-mobile.png'),fullPage:false});
  await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(180);
  client.desktop=await page.evaluate(()=>{
    const h=document.getElementById('qidu-v0423-release-smoke'),g=h?.querySelector('[data-f7d-choice-grid="1"]'),ls=[...(h?.querySelectorAll('[data-f7d-choice="1"]')||[])];
    const R=e=>e?e.getBoundingClientRect():null;const hr=R(h),gr=R(g),rs=ls.map(R);
    return{multiColumn:Boolean(rs.length===2&&Math.abs(rs[0].top-rs[1].top)<4&&rs[1].left>rs[0].left+20),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2)};
  });
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0423-release-desktop.png'),fullPage:false});
}finally{await browser.close()}

const report={version:ONEFILE_VERSION,sha256:compactSha256,importStatus:imported.status,client};
await fs.writeFile(path.join(evidenceDir,'qidu-v0423-release-privacy-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.23-release-sanitized.json'),raw);
console.log(JSON.stringify(report,null,2));
const uiOk=Boolean(client?.found&&client?.metadataClean&&client?.allowed&&client?.terminal&&client?.grid&&client?.choiceCount===2&&client?.hiddenState&&client?.ui?.terminalGradient&&client?.ui?.gridGradient&&client?.ui?.gridDisplay==='grid'&&client?.ui?.choiceGradients?.every(Boolean)&&client?.ui?.choiceMinHeights?.every(x=>x>=44)&&client?.ui?.stacked&&client?.ui?.gridFits&&client?.desktop?.multiColumn&&client?.desktop?.gridFits);
if(!uiOk) throw new Error(`release privacy/browser UI smoke failed: ${JSON.stringify(client)}`);
