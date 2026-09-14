import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduReleaseCard, ONEFILE_VERSION, RELEASE_CREATOR, RELEASE_CREATOR_NOTES, assertReleasePrivacy } from './qidu-card-v0423-release-sanitized.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'lab-evidence';
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
  client=await page.evaluate(async({name,version,creator,notes})=>{
    const st=await import('/script.js');
    const eng=await import('/scripts/extensions/regex/engine.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version&&x?.data?.creator===creator);
    if(idx<0)return{found:false};
    st.setCharacterId(idx);
    const ch=st.characters[idx];
    eng.allowScopedScripts(ch);
    const html=st.messageFormatting('<f7d_terminal>RELEASE PRIVACY</f7d_terminal><f7d_state>{"hidden":1}</f7d_state><f7d_choices><f7d_choice>Continue</f7d_choice></f7d_choices>','qidu-release',false,false,777777,{},false);
    const host=document.createElement('div');host.innerHTML=html;document.body.appendChild(host);
    const result={
      found:true,
      creator:ch?.data?.creator,
      notes:ch?.data?.creator_notes,
      creatorcomment:ch?.creatorcomment,
      bookCreator:ch?.data?.character_book?.extensions?.creator,
      bookVersion:ch?.data?.character_book?.extensions?.version,
      hasTerminal:Boolean(host.querySelector('[data-f7d-terminal="1"]')),
      hasChoice:Boolean(host.querySelector('[data-f7d-choice="1"]')),
      hiddenState:!host.textContent?.includes('hidden'),
      allowed:eng.isScopedScriptsAllowed(ch),
      metadataClean:ch?.data?.creator===creator&&ch?.data?.creator_notes===notes&&ch?.data?.character_book?.extensions?.creator===creator
    };
    host.remove();return result;
  },{name:card.data.name,version:ONEFILE_VERSION,creator:RELEASE_CREATOR,notes:RELEASE_CREATOR_NOTES});
}finally{await browser.close()}

const report={version:ONEFILE_VERSION,sha256:compactSha256,importStatus:imported.status,client};
await fs.writeFile(path.join(evidenceDir,'qidu-v0423-release-privacy-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.23-release-sanitized.json'),raw);
console.log(JSON.stringify(report,null,2));
if(!client?.found||!client?.metadataClean||!client?.hasTerminal||!client?.hasChoice||!client?.hiddenState||!client?.allowed) throw new Error(`release privacy browser smoke failed: ${JSON.stringify(client)}`);
