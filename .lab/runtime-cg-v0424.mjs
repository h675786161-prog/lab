import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduCgCandidate, ONEFILE_VERSION, assertReleasePrivacy, CG_KEYS, resolveEndingCg } from './qidu-card-v0424-cg-candidate.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'cg-evidence';
await fs.mkdir(evidenceDir,{recursive:true});
const {card,raw,compactSha256}=await loadQiduCgCandidate(process.env.GITHUB_WORKSPACE||process.cwd());
assertReleasePrivacy(card);

const regexes=card.data.extensions?.regex_scripts||[];
if(!regexes.some(x=>x?.id==='f7d-cg-sprite-v0424')) throw new Error('embedded CG sprite regex missing');
if(card.data.extensions?.qidu_frontend?.cg_asset_mode!=='embedded-sprite') throw new Error('CG sprite mode missing');

const firstState=String(card.data.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
if(!firstState) throw new Error('initial state missing');
const initial=JSON.parse(firstState[1]);
if(initial?.cg_system?.mode!=='direct_only'||initial?.cg_system?.album_enabled!==false||initial?.cg_system?.responsive_enabled!==true) throw new Error('initial CG system invalid');
if(initial?.player_profile?.gender!=='unknown') throw new Error('initial gender must remain unknown');

const routing={
  sacrificeMale:resolveEndingCg('牺牲的意义','male'),
  sacrificeFemale:resolveEndingCg('牺牲的意义','female'),
  sacrificeUnknown:resolveEndingCg('牺牲的意义','unknown'),
  finalMale:resolveEndingCg('终结','male'),
  finalFemale:resolveEndingCg('终结','female'),
  finalUnknown:resolveEndingCg('终结','unknown'),
  boxMale:resolveEndingCg('箱庭风景','male'),
  boxFemale:resolveEndingCg('箱庭风景','female'),
  boxUnknown:resolveEndingCg('箱庭风景','unknown'),
  journey:resolveEndingCg('两个人的旅途','unknown'),
  eternal:resolveEndingCg('永恒的终焉','unknown')
};
const routingOk=
  routing.sacrificeMale==='cg_ending_sacrifice_male'&&
  routing.sacrificeFemale==='cg_ending_sacrifice_female'&&
  routing.sacrificeUnknown===null&&
  routing.finalMale==='cg_ending_final_male'&&
  routing.finalFemale==='cg_ending_final_female'&&
  routing.finalUnknown===null&&
  routing.boxMale==='cg_ending_box_male'&&
  routing.boxFemale==='cg_ending_box_female'&&
  routing.boxUnknown===null&&
  routing.journey==='cg_ending_journey'&&
  routing.eternal==='cg_ending_eternal_end';
if(!routingOk) throw new Error(`gender routing failed: ${JSON.stringify(routing)}`);

const form=new FormData();
form.set('file_type','json');
form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-v0424-cg.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});
const importText=await imported.text();
if(!imported.ok) throw new Error(`CG candidate import failed ${imported.status}: ${importText.slice(0,200)}`);

const expectedAspect=key=>{
  if(key.includes('ending_final_')) return 4/5;
  if(key.includes('ending_box_')) return 640/853;
  return 16/9;
};

const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
let client;
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!r||r.status()>=400)throw new Error(`HTTP ${r?.status()}`);
  await page.waitForTimeout(1800);
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});
  client=await page.evaluate(async({name,version,hash,keys})=>{
    const st=await import('/script.js');
    const eng=await import('/scripts/extensions/regex/engine.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator==='叶罹');
    if(idx<0)return{found:false};
    st.setCharacterId(idx);
    const ch=st.characters[idx];
    eng.allowScopedScripts(ch);

    const allTags=keys.map(k=>`<f7d_cg key="${k}"></f7d_cg>`).join('');
    const sample=`<f7d_state>{"private":1}</f7d_state>${allTags}<f7d_terminal>第7天｜0/12｜CG验收</f7d_terminal>`;
    const html=st.messageFormatting(sample,'release',false,false,888889,{},false);
    const h=document.createElement('dialog');
    h.id='qidu-cg-acceptance-dialog';
    h.style.cssText='position:fixed;left:8px;top:44px;margin:0;width:min(1000px,calc(100vw - 16px));max-width:none;max-height:calc(100vh - 60px);overflow:auto;padding:8px;border:0;border-radius:16px;background:rgba(5,10,18,.97);';
    h.innerHTML=html;
    document.body.appendChild(h);
    h.showModal();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    const R=e=>e?e.getBoundingClientRect():null;
    const hr=R(h);
    const figures=[...h.querySelectorAll('[data-f7d-cg="1"]')];
    const items=figures.map(fig=>{
      const key=fig.getAttribute('data-f7d-cg-key');
      const img=fig.querySelector('[data-f7d-cg-image="1"]');
      const fr=R(fig),ir=R(img),cs=img?getComputedStyle(img):null;
      return{
        key,
        figure:Boolean(fig),
        image:Boolean(img),
        dataUri:Boolean(cs?.backgroundImage?.includes('data:image/webp;base64,')),
        positionY:cs?.backgroundPositionY||'',
        width:ir?.width||0,
        height:ir?.height||0,
        aspect:ir&&ir.height?ir.width/ir.height:null,
        fits:Boolean(fr&&hr&&fr.left>=hr.left-2&&fr.right<=hr.right+2&&ir&&ir.left>=fr.left-2&&ir.right<=fr.right+2)
      };
    });
    return{
      found:true,
      creator:ch?.data?.creator,
      version:ch?.data?.character_version,
      allowed:eng.isScopedScriptsAllowed(ch),
      hidden:!h.textContent?.includes('private'),
      count:items.length,
      keys:items.map(x=>x.key),
      items,
      styleCount:h.querySelectorAll('style[data-f7d-cg-style="1"]').length,
      terminal:Boolean(h.querySelector('[data-f7d-terminal="1"]')),
      hash
    };
  },{name:card.data.name,version:ONEFILE_VERSION,hash:compactSha256,keys:CG_KEYS});

  const mobilePair=await page.evaluate(async()=>{
    const st=await import('/script.js');
    const h=document.getElementById('qidu-cg-acceptance-dialog');
    h.innerHTML=st.messageFormatting('横向CG：安·初见<f7d_cg key="cg_ann_first_meet"></f7d_cg>竖向CG：箱庭·女指挥使<f7d_cg key="cg_ending_box_female"></f7d_cg>','release',false,false,888890,{},false);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return true;
  });
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0424-cg-mobile.png'),fullPage:false});

  await page.setViewportSize({width:1366,height:768});
  await page.waitForTimeout(350);
  client.desktop=await page.evaluate(()=>{
    const h=document.getElementById('qidu-cg-acceptance-dialog');
    const R=e=>e?e.getBoundingClientRect():null;
    const hr=R(h);
    const items=[...h.querySelectorAll('[data-f7d-cg="1"]')].map(fig=>{
      const img=fig.querySelector('[data-f7d-cg-image="1"]');
      const fr=R(fig),ir=R(img);
      return{
        key:fig.getAttribute('data-f7d-cg-key'),
        fits:Boolean(fr&&hr&&fr.left>=hr.left-2&&fr.right<=hr.right+2&&ir&&ir.left>=fr.left-2&&ir.right<=fr.right+2),
        width:ir?.width||0,
        height:ir?.height||0,
        aspect:ir&&ir.height?ir.width/ir.height:null
      };
    });
    return{items};
  });
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0424-cg-desktop.png'),fullPage:false});
} finally {
  await browser.close();
}

const aspectOk=(key,x)=>Number.isFinite(x)&&Math.abs(x-expectedAspect(key))<0.035;
const allKeysOk=CG_KEYS.every(k=>client?.keys?.includes(k));
const itemOk=client?.items?.length===CG_KEYS.length&&client.items.every(x=>x.figure&&x.image&&x.dataUri&&x.fits&&aspectOk(x.key,x.aspect));
const uniquePositions=new Set((client?.items||[]).map(x=>`${x.key}:${x.positionY}`)).size===CG_KEYS.length;
const desktopOk=client?.desktop?.items?.length===2&&client.desktop.items.every(x=>x.fits&&aspectOk(x.key,x.aspect));
const ok=
  client?.found&&
  client?.creator==='叶罹'&&
  client?.version===ONEFILE_VERSION&&
  client?.allowed&&
  client?.hidden&&
  client?.terminal&&
  client?.count===CG_KEYS.length&&
  allKeysOk&&
  itemOk&&
  uniquePositions&&
  client?.styleCount===CG_KEYS.length&&
  desktopOk&&
  routingOk;

const report={
  version:ONEFILE_VERSION,
  sha256:compactSha256,
  importStatus:imported.status,
  routing,
  routingOk,
  client,
  acceptance:{allKeysOk,itemOk,uniquePositions,desktopOk,ok}
};
await fs.writeFile(path.join(evidenceDir,'qidu-v0424-cg-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.24-cg-probe.json'),raw);
console.log(JSON.stringify(report,null,2));
if(!ok) throw new Error(`CG real-ST/browser acceptance failed: ${JSON.stringify(report.acceptance)}`);
