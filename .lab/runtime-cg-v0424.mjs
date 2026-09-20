import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduCgCandidate, ONEFILE_VERSION, assertReleasePrivacy } from './qidu-card-v0424-cg-candidate.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'cg-evidence';
await fs.mkdir(evidenceDir,{recursive:true});
const {card,raw,compactSha256}=await loadQiduCgCandidate(process.env.GITHUB_WORKSPACE||process.cwd());
assertReleasePrivacy(card);

const regexes=card.data.extensions?.regex_scripts||[];
if(!regexes.some(x=>x?.id==='f7d-cg-cg_ann_first_meet-v001')) throw new Error('embedded Ann CG regex missing');
const firstState=String(card.data.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
if(!firstState) throw new Error('initial state missing');
const initial=JSON.parse(firstState[1]);
if(initial?.cg_system?.mode!=='direct_only'||initial?.cg_system?.album_enabled!==false||initial?.cg_system?.responsive_enabled!==true) throw new Error('initial CG system invalid');
if(initial?.player_profile?.gender!=='unknown') throw new Error('initial gender must remain unknown');

const form=new FormData();
form.set('file_type','json');
form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-v0424-cg.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});
const importText=await imported.text();
if(!imported.ok) throw new Error(`CG candidate import failed ${imported.status}: ${importText.slice(0,200)}`);

const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
let client;
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!r||r.status()>=400)throw new Error(`HTTP ${r?.status()}`);
  await page.waitForTimeout(1800);
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});
  client=await page.evaluate(async({name,version,hash})=>{
    const st=await import('/script.js');
    const eng=await import('/scripts/extensions/regex/engine.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator==='叶罹');
    if(idx<0)return{found:false};
    st.setCharacterId(idx);
    const ch=st.characters[idx];
    eng.allowScopedScripts(ch);
    const sample='<f7d_state>{"private":1}</f7d_state>病房里的少女向你俯身，轻声说她叫安。<f7d_cg key="cg_ann_first_meet"></f7d_cg><f7d_terminal>第7天｜0/12｜中央庭病房</f7d_terminal>';
    const html=st.messageFormatting(sample,'release',false,false,888889,{},false);
    const h=document.createElement('dialog');
    h.id='qidu-cg-acceptance-dialog';
    h.style.cssText='position:fixed;left:8px;top:44px;margin:0;width:min(1000px,calc(100vw - 16px));max-width:none;max-height:calc(100vh - 60px);overflow:auto;padding:8px;border:0;border-radius:16px;background:rgba(5,10,18,.97);';
    h.innerHTML=html;
    document.body.appendChild(h);
    h.showModal();
    const fig=h.querySelector('[data-f7d-cg="1"]');
    const img=h.querySelector('[data-f7d-cg-image="1"]');
    if(img&&!img.complete) await new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,3000)});
    const R=e=>e?e.getBoundingClientRect():null;
    const hr=R(h),fr=R(fig),ir=R(img);
    return{
      found:true,
      creator:ch?.data?.creator,
      version:ch?.data?.character_version,
      allowed:eng.isScopedScriptsAllowed(ch),
      hidden:!h.textContent?.includes('private'),
      cg:Boolean(fig),
      image:Boolean(img),
      imageComplete:Boolean(img?.complete),
      naturalWidth:Number(img?.naturalWidth||0),
      naturalHeight:Number(img?.naturalHeight||0),
      dataUri:Boolean(img?.getAttribute('src')?.startsWith('data:image/webp;base64,')),
      noAlbumText:!/相册|小手机|已保存|已同步/.test(h.textContent||''),
      mobileFits:Boolean(fr&&hr&&fr.left>=hr.left-2&&fr.right<=hr.right+2&&ir&&ir.left>=fr.left-2&&ir.right<=fr.right+2),
      aspect:ir&&ir.height?ir.width/ir.height:null,
      hash
    };
  },{name:card.data.name,version:ONEFILE_VERSION,hash:compactSha256});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0424-cg-mobile.png'),fullPage:false});

  await page.setViewportSize({width:1366,height:768});
  await page.waitForTimeout(350);
  client.desktop=await page.evaluate(()=>{
    const h=document.getElementById('qidu-cg-acceptance-dialog');
    const fig=h?.querySelector('[data-f7d-cg="1"]');
    const img=h?.querySelector('[data-f7d-cg-image="1"]');
    const R=e=>e?e.getBoundingClientRect():null;
    const hr=R(h),fr=R(fig),ir=R(img);
    return{
      fits:Boolean(fr&&hr&&fr.left>=hr.left-2&&fr.right<=hr.right+2&&ir&&ir.left>=fr.left-2&&ir.right<=fr.right+2),
      figureWidth:fr?.width||0,
      imageWidth:ir?.width||0,
      imageHeight:ir?.height||0,
      aspect:ir&&ir.height?ir.width/ir.height:null
    };
  });
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0424-cg-desktop.png'),fullPage:false});
} finally {
  await browser.close();
}

const report={version:ONEFILE_VERSION,sha256:compactSha256,importStatus:imported.status,client};
await fs.writeFile(path.join(evidenceDir,'qidu-v0424-cg-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.24-cg-probe.json'),raw);
console.log(JSON.stringify(report,null,2));

const ratioOk=x=>x&&Math.abs(x-(16/9))<0.04;
const ok=client?.found&&client?.creator==='叶罹'&&client?.version===ONEFILE_VERSION&&client?.allowed&&client?.hidden&&client?.cg&&client?.image&&client?.imageComplete&&client?.naturalWidth>0&&client?.naturalHeight>0&&client?.dataUri&&client?.noAlbumText&&client?.mobileFits&&ratioOk(client?.aspect)&&client?.desktop?.fits&&ratioOk(client?.desktop?.aspect);
if(!ok) throw new Error(`CG real-ST/browser acceptance failed: ${JSON.stringify(client)}`);
