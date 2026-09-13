import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, ONEFILE_VERSION } from './qidu-card-v0422-npc-knowledge.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'lab-evidence';
await fs.mkdir(evidenceDir,{recursive:true});
const {card}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
let report={version:ONEFILE_VERSION,mobile:null,desktop:null,pageErrors};
try{
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!r||r.status()>=400)throw new Error(`HTTP ${r?.status()}`);
  await page.waitForTimeout(1800);
  report.mobile=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');
    const eng=await import('/scripts/extensions/regex/engine.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version);
    if(idx<0)return{error:'not-found'};
    st.setCharacterId(idx);const ch=st.characters[idx];eng.allowScopedScripts(ch);
    const html=st.messageFormatting('<f7d_terminal>MISSION // UI BEAUTY CHECK</f7d_terminal><f7d_state>{"hidden":true}</f7d_state><f7d_choices><f7d_choice>Observe</f7d_choice><f7d_choice>Ask Kaji</f7d_choice></f7d_choices>','Qidu UI QA',false,false,999998,{},false);
    document.getElementById('qidu-ui-visual-mount')?.remove();
    const h=document.createElement('div');
    h.id='qidu-ui-visual-mount';
    h.style.cssText='position:fixed;z-index:2147483646;left:12px;top:72px;width:min(780px,calc(100vw - 24px));max-height:calc(100vh - 84px);overflow:auto;padding:10px;border-radius:16px;background:rgba(5,10,18,.94);box-shadow:0 14px 40px rgba(0,0,0,.48);';
    h.innerHTML=html;
    document.documentElement.appendChild(h);
    const term=h.querySelector('[data-f7d-terminal="1"]');
    const grid=h.querySelector('[data-f7d-choice-grid="1"]');
    const labels=[...h.querySelectorAll('[data-f7d-choice="1"]')];
    const rect=e=>e?(()=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})():null;
    const ts=term?getComputedStyle(term):null,gs=grid?getComputedStyle(grid):null;
    const rs=labels.map(rect),hr=rect(h),gr=rect(grid);
    return{
      allowed:eng.isScopedScriptsAllowed(ch),terminal:Boolean(term),grid:Boolean(grid),labels:labels.map(x=>x.textContent?.trim()),hiddenStateVisible:h.textContent?.includes('hidden')||false,
      terminalGradient:Boolean(ts?.backgroundImage&&ts.backgroundImage!=='none'),gridGradient:Boolean(gs?.backgroundImage&&gs.backgroundImage!=='none'),gridDisplay:gs?.display||'',
      stacked:Boolean(rs.length===2&&rs[1].top>rs[0].top+4),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2),mount:hr,gridRect:gr,labelRects:rs
    };
  },{name:card.data.name,version:ONEFILE_VERSION});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0422-ui-mobile-visible.png'),fullPage:false});
  await page.setViewportSize({width:1366,height:768});
  await page.waitForTimeout(120);
  report.desktop=await page.evaluate(()=>{
    const h=document.getElementById('qidu-ui-visual-mount');
    const grid=h?.querySelector('[data-f7d-choice-grid="1"]');
    const labels=[...(h?.querySelectorAll('[data-f7d-choice="1"]')||[])];
    const rect=e=>e?(()=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})():null;
    const rs=labels.map(rect),hr=rect(h),gr=rect(grid);
    return{multiColumn:Boolean(rs.length===2&&Math.abs(rs[0].top-rs[1].top)<4&&rs[1].left>rs[0].left+20),gridFits:Boolean(gr&&hr&&gr.left>=hr.left-2&&gr.right<=hr.right+2),mount:hr,gridRect:gr,labelRects:rs};
  });
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0422-ui-desktop-visible.png'),fullPage:false});
}finally{await browser.close()}
await fs.writeFile(path.join(evidenceDir,'qidu-v0422-ui-visual-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
const fail=[];
if(report.mobile?.error)fail.push(`mobile:${report.mobile.error}`);
if(!report.mobile?.allowed||!report.mobile?.terminal||!report.mobile?.grid||report.mobile?.labels?.length!==2||report.mobile?.hiddenStateVisible||!report.mobile?.terminalGradient||!report.mobile?.gridGradient||report.mobile?.gridDisplay!=='grid'||!report.mobile?.stacked||!report.mobile?.gridFits)fail.push(`mobile-ui:${JSON.stringify(report.mobile)}`);
if(!report.desktop?.multiColumn||!report.desktop?.gridFits)fail.push(`desktop-ui:${JSON.stringify(report.desktop)}`);
if(pageErrors.length)fail.push(`page:${pageErrors.join('|')}`);
if(fail.length)throw new Error(`v0422 visible UI smoke failed ${fail.join(',')}`);
