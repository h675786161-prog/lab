import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduCgCandidate, ONEFILE_VERSION } from './qidu-card-v0424-cg-candidate.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'lab-evidence';
await fs.mkdir(evidenceDir,{recursive:true});
const {card,raw}=await loadQiduCgCandidate(process.env.GITHUB_WORKSPACE||process.cwd());

const form=new FormData();
form.set('file_type','json');
form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-v0424-ui.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});
if(!imported.ok) throw new Error(`v0424 UI card import failed: ${imported.status} ${(await imported.text()).slice(0,200)}`);

const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
const report={version:ONEFILE_VERSION,bridge:null,mobile:null,desktop:null,pageErrors};

try{
  const response=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!response||response.status()>=400) throw new Error(`HTTP ${response?.status()}`);
  await page.waitForTimeout(1800);
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});

  const selected=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator==='叶罹');
    if(idx<0)return false;
    void st.selectCharacterById(idx,{switchMenu:false});
    return true;
  },{name:card.data.name,version:ONEFILE_VERSION});
  if(!selected) throw new Error('v0424 UI character not found after import');
  await page.waitForTimeout(900);

  const helperPrompt=await page.evaluate(()=>/角色卡[\s\S]*嵌入式脚本|嵌入式脚本[\s\S]*启用/.test(document.body.innerText||''));
  if(helperPrompt){
    const clicked=await page.evaluate(()=>{
      const btn=[...document.querySelectorAll('button,.menu_button')].find(x=>String(x.textContent||'').trim()==='确认');
      if(!btn)return false;btn.click();return true;
    });
    if(!clicked) throw new Error('embedded-script confirmation button missing');
  }

  for(let i=0;i<50;i++){
    if(await page.evaluate(()=>window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.version==='1.5.0'))break;
    await page.waitForTimeout(120);
  }
  report.bridge=await page.evaluate(()=>window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.version||null);
  if(report.bridge!=='1.5.0') throw new Error(`choice bridge version mismatch: ${report.bridge}`);

  report.mobile=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');
    const eng=await import('/scripts/extensions/regex/engine.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator==='叶罹');
    if(idx<0)return{error:'not-found'};
    st.setCharacterId(idx);
    const ch=st.characters[idx];
    eng.allowScopedScripts(ch);
    const source='<f7d_terminal>【战术终端】第4天｜剧情推进中\n当前位置：中央庭</f7d_terminal><f7d_state>{"hidden":true}</f7d_state><f7d_choices><f7d_choice>跟安一起去确认中央庭的情况</f7d_choice><f7d_choice>先找珈儿问清楚高校学园的消息</f7d_choice><f7d_choice>打开战术终端，整理目前掌握的线索</f7d_choice><f7d_choice>什么都不做，任由这次机会过去</f7d_choice></f7d_choices>';
    const html=st.messageFormatting(source,'Qidu UI QA',false,false,919191,{},false);
    document.getElementById('qidu-v0424-ui-mount')?.remove();
    document.getElementById('qidu-v0424-ui-mount-style')?.remove();
    const style=document.createElement('style');
    style.id='qidu-v0424-ui-mount-style';
    style.textContent='#qidu-v0424-ui-mount::backdrop{background:transparent!important;}';
    document.head.appendChild(style);
    const h=document.createElement('dialog');
    h.id='qidu-v0424-ui-mount';
    h.style.cssText='position:fixed;z-index:2147483647;left:10px;top:48px;right:auto;bottom:auto;margin:0;width:calc(100vw - 20px);max-width:780px;max-height:calc(100vh - 58px);overflow:auto;padding:10px;border:0;border-radius:18px;background:rgba(23,26,31,.96);box-shadow:0 16px 46px rgba(0,0,0,.42);';
    h.innerHTML=html;
    document.body.appendChild(h);
    h.showModal();
    window.__F7D_CARD_CHOICE_BRIDGE_V0424__?.refresh?.();
    await new Promise(r=>setTimeout(r,100));
    const grid=h.querySelector('[data-f7d-choice-grid="1"]');
    const choices=[...h.querySelectorAll('[data-f7d-choice="1"]')];
    const free=h.querySelector('[data-f7d-choice-free="1"]');
    const title=h.querySelector('[data-f7d-choice-title="1"]');
    const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const rs=choices.map(rect),gr=rect(grid),fr=rect(free);
    const css=choices.map(x=>{const s=getComputedStyle(x);return{radius:parseFloat(s.borderRadius),minHeight:parseFloat(s.minHeight),background:s.backgroundImage,kind:x.getAttribute('data-f7d-choice-kind')}});
    return{
      allowed:eng.isScopedScriptsAllowed(ch),
      grid:Boolean(grid),choiceCount:choices.length,free:Boolean(free),title:String(title?.textContent||'').replace(/\s+/g,' ').trim(),
      hiddenStateVisible:Boolean(h.textContent?.includes('"hidden"')),
      stacked:Boolean(rs.length===4&&rs.every((r,i)=>i===0||r.top>rs[i-1].top+4)),
      gridWidth:gr?.width||0,freeWidth:fr?.width||0,
      skipKind:choices[3]?.getAttribute('data-f7d-choice-kind')||null,
      css
    };
  },{name:card.data.name,version:ONEFILE_VERSION});

  const mobileGrid=page.locator('#qidu-v0424-ui-mount [data-f7d-choice-grid="1"]');
  await mobileGrid.screenshot({path:path.join(evidenceDir,'qidu-v0424-choice-mobile.png')});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0424-choice-mobile-context.png'),fullPage:false});

  await page.setViewportSize({width:1366,height:768});
  await page.waitForTimeout(180);
  report.desktop=await page.evaluate(()=>{
    const h=document.getElementById('qidu-v0424-ui-mount');
    const grid=h?.querySelector('[data-f7d-choice-grid="1"]');
    const choices=[...(h?.querySelectorAll('[data-f7d-choice="1"]')||[])];
    const free=h?.querySelector('[data-f7d-choice-free="1"]');
    const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const rs=choices.map(rect),gr=rect(grid),fr=rect(free);
    return{
      multiColumn:Boolean(rs.length===4&&Math.abs(rs[0].top-rs[1].top)<4&&rs[1].left>rs[0].left+20&&Math.abs(rs[2].top-rs[3].top)<4),
      freeFullRow:Boolean(fr&&gr&&fr.width>=gr.width-30),
      grid:gr,free:fr,choices:rs
    };
  });
  const desktopGrid=page.locator('#qidu-v0424-ui-mount [data-f7d-choice-grid="1"]');
  await desktopGrid.screenshot({path:path.join(evidenceDir,'qidu-v0424-choice-desktop.png')});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0424-choice-desktop-context.png'),fullPage:false});
}finally{
  await browser.close();
}

await fs.writeFile(path.join(evidenceDir,'qidu-v0424-choice-visual-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

const fail=[];
if(report.bridge!=='1.5.0')fail.push('bridge');
if(report.mobile?.error||!report.mobile?.allowed||!report.mobile?.grid||report.mobile?.choiceCount!==4||!report.mobile?.free)fail.push('mobile-structure');
if(report.mobile?.hiddenStateVisible)fail.push('state-visible');
if(!report.mobile?.stacked)fail.push('mobile-not-stacked');
if(report.mobile?.skipKind!=='slack')fail.push('skip-not-classified');
if(!report.mobile?.css?.every(x=>x.radius>=14&&x.minHeight>=54&&x.background&&x.background!=='none'))fail.push('choice-style');
if(!report.desktop?.multiColumn||!report.desktop?.freeFullRow)fail.push('desktop-layout');
if(pageErrors.length)fail.push('page-errors');
if(fail.length)throw new Error(`v0424 choice visual acceptance failed: ${fail.join(', ')}`);
