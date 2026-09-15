import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduReleaseCandidate, ONEFILE_VERSION, assertReleasePrivacy } from './qidu-card-v0423-release-candidate.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'release-evidence';
await fs.mkdir(evidenceDir,{recursive:true});
const {card,raw,compactSha256}=await loadQiduReleaseCandidate(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
assertReleasePrivacy(card);
const rawText=raw.toString('utf8');
if(/(?:玲|h675786161|github\.com|raw\.githubusercontent\.com|api\.github\.com|实验酒馆|world-backstage|(?:\bLAB\b|[-_]lab\b|\blab[-_])|feature\/qidu-card|gmail\.com)/i.test(rawText)) throw new Error('release candidate contains private development provenance');
const by=p=>(card.data.character_book?.entries||[]).find(e=>String(e.name||'').startsWith(p));
if(!String(by('41｜')?.content||'').includes('第一活骸事故只讲已锚定事实')) throw new Error('release candidate first-chimera fidelity guard missing');

const form=new FormData();form.set('file_type','json');form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-v0423-release.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});const importText=await imported.text();
if(!imported.ok) throw new Error(`release candidate import failed ${imported.status}: ${importText.slice(0,200)}`);
const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
let client;
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});if(!r||r.status()>=400)throw new Error(`HTTP ${r?.status()}`);await page.waitForTimeout(1800);
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});
  client=await page.evaluate(async({name,version,hash})=>{
    const st=await import('/script.js');const eng=await import('/scripts/extensions/regex/engine.js');await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator==='叶罹'&&String(x?.data?.character_book?.entries?.find(e=>String(e?.name||'').startsWith('41｜'))?.content||'').includes('第一活骸事故只讲已锚定事实'));
    if(idx<0)return{found:false};st.setCharacterId(idx);const ch=st.characters[idx];eng.allowScopedScripts(ch);
    const html=st.messageFormatting('<f7d_terminal>RELEASE CANDIDATE</f7d_terminal><f7d_state>{"private":1}</f7d_state><f7d_choices><f7d_choice>Continue</f7d_choice><f7d_choice>Ask Kaji</f7d_choice></f7d_choices>','release',false,false,888888,{},false);
    const h=document.createElement('dialog');h.id='qidu-release-acceptance-dialog';h.style.cssText='position:fixed;left:12px;top:72px;margin:0;width:min(780px,calc(100vw - 24px));max-width:none;padding:10px;border:0;border-radius:16px;background:rgba(5,10,18,.96);';h.innerHTML=html;document.body.appendChild(h);h.showModal();
    const term=h.querySelector('[data-f7d-terminal="1"]'),grid=h.querySelector('[data-f7d-choice-grid="1"]'),labels=[...h.querySelectorAll('[data-f7d-choice="1"]')];const ts=term?getComputedStyle(term):null,gs=grid?getComputedStyle(grid):null,ls=labels.map(x=>getComputedStyle(x));
    const rect=e=>e?e.getBoundingClientRect():null,hr=rect(h),gr=rect(grid),rs=labels.map(rect);
    return{found:true,creator:ch?.data?.creator,bookCreator:ch?.data?.character_book?.extensions?.creator,bookVersion:ch?.data?.character_book?.extensions?.version,allowed:eng.isScopedScriptsAllowed(ch),terminal:Boolean(term),grid:Boolean(grid),hidden:!h.textContent?.includes('private'),choiceCount:labels.length,terminalGradient:Boolean(ts?.backgroundImage&&ts.backgroundImage!=='none'),gridGradient:Boolean(gs?.backgroundImage&&gs.backgroundImage!=='none'),choiceGradients:ls.map(s=>Boolean(s?.backgroundImage&&s.backgroundImage!=='none')),choiceMinHeights:ls.map(s=>parseFloat(s?.minHeight||'0')),stacked:Boolean(rs.length===2&&rs[1].top>rs[0].top+4),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2),hash};
  },{name:card.data.name,version:ONEFILE_VERSION,hash:compactSha256});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0423-release-candidate-mobile.png'),fullPage:false});await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(250);
  client.desktop=await page.evaluate(()=>{const h=document.getElementById('qidu-release-acceptance-dialog'),g=h?.querySelector('[data-f7d-choice-grid="1"]'),ls=[...(h?.querySelectorAll('[data-f7d-choice="1"]')||[])];const R=e=>e?e.getBoundingClientRect():null,hr=R(h),gr=R(g),rs=ls.map(R);return{multiColumn:Boolean(rs.length===2&&Math.abs(rs[0].top-rs[1].top)<4&&rs[1].left>rs[0].left+20),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2)}});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0423-release-candidate-desktop.png'),fullPage:false});
}finally{await browser.close()}
const report={version:ONEFILE_VERSION,sha256:compactSha256,importStatus:imported.status,client};await fs.writeFile(path.join(evidenceDir,'qidu-v0423-release-candidate-report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.23.json'),raw);console.log(JSON.stringify(report,null,2));
const ok=client?.found&&client?.creator==='叶罹'&&client?.bookCreator==='叶罹'&&client?.bookVersion==='0.4.23'&&client?.allowed&&client?.terminal&&client?.grid&&client?.hidden&&client?.choiceCount===2&&client?.terminalGradient&&client?.gridGradient&&client?.choiceGradients?.every(Boolean)&&client?.choiceMinHeights?.every(x=>x>=44)&&client?.stacked&&client?.gridFits&&client?.desktop?.multiColumn&&client?.desktop?.gridFits;
if(!ok)throw new Error(`release candidate real-ST/browser acceptance failed: ${JSON.stringify(client)}`);
