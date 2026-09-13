import fs from 'node:fs/promises';
import path from 'node:path';
import { loadQiduOneFileCard, ONEFILE_VERSION } from './qidu-card-v0422-npc-knowledge.mjs';

const baseUrl=process.env.LAB_ST_URL||'http://127.0.0.1:8000';
const evidenceDir=process.env.LAB_EVIDENCE_DIR||'lab-evidence';
const stDir=process.env.LAB_ST_DIR;
if(!stDir)throw new Error('LAB_ST_DIR required');
await fs.mkdir(evidenceDir,{recursive:true});
await fs.rm(path.join(stDir,'public/scripts/extensions/third-party/qidu-choice-bridge'),{recursive:true,force:true});
await fs.rm(path.join(stDir,'public/scripts/extensions/third-party/lingqi-lab-probe'),{recursive:true,force:true});

const {card,raw,compactSha256}=await loadQiduOneFileCard(process.env.GITHUB_WORKSPACE||process.cwd(),{skipHashCheck:true});
const book=card.data.character_book?.entries||[];
const by=p=>book.find(e=>String(e.name||'').startsWith(p));
const staticChecks={
  version:card.data.character_version===ONEFILE_VERSION,
  worldbook55:book.length===55,
  regex4:(card.data.extensions?.regex_scripts||[]).length>=4,
  depth0:card.data.extensions?.depth_prompt?.depth===0,
  identityGate:Boolean(by('04｜')?.content?.includes('角色首次识别门禁｜隐藏执行')),
  requiredCast:Boolean(by('04｜')?.content?.includes('场景必出角色连续性检查')),
  tokenOrder:Boolean(by('04｜')?.content?.includes('高校初见姓名令牌顺序锁｜隐藏执行')),
  mandatoryState:Boolean(by('04｜')?.content?.includes('状态块强制提交｜隐藏执行')),
  firstSightFocus:Boolean(by('04｜')?.content?.includes('首次目击去标签焦点｜隐藏执行')),
  npcKnowledgeGate:Boolean(by('04｜')?.content?.includes('NPC知识来源门禁｜隐藏执行')),
  schoolPair:Boolean(by('30｜')?.content?.includes('高校双人初见硬锁')),
  schoolOrder:Boolean(by('30｜')?.content?.includes('高校2/6姓名顺序不可交换')),
  schoolNoRecall:Boolean(by('30｜')?.content?.includes('2/6目击阶段禁主动回想姓名')),
  kajiGate:Boolean(by('44｜')?.content?.includes('首次出场识别硬锁')),
  kajiKnowledgeBoundary:Boolean(by('44｜')?.content?.includes('活骸知识边界')),
  teslaRequired:Boolean(by('67｜')?.content?.includes('高校主线不可省略')),
  knownSemantics:Boolean(by('91｜')?.content?.includes('known字段身份语义')),
  playerIntelNotNpcIntel:Boolean(by('91｜')?.content?.includes('玩家知识不等于NPC知识')),
  stateInvariant:Boolean(by('91｜')?.content?.includes('每轮状态块不可省略')),
  noBridge:!card.data.extensions?.qidu_choice_bridge
};
const sm=String(card.data.first_mes||'').match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
if(!sm)throw new Error('first state missing');
const initial=JSON.parse(sm[1]);
const initialChecks={kajiUnknown:!initial.known?.includes('珈儿'),teslaUnknown:!initial.known?.includes('泰丝拉'),countdownVisible:initial.intel_flags?.countdown_visible_to_user===true};

const form=new FormData();
form.set('file_type','json');
form.set('avatar',new Blob([raw],{type:'application/json'}),'qidu-v0422.json');
const imported=await fetch(`${baseUrl}/api/characters/import`,{method:'POST',body:form});
const importText=await imported.text();
const {chromium}=await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser=await chromium.launch({headless:true,executablePath:process.env.LAB_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
let client=null;
try{
  const r=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!r||r.status()>=400)throw new Error(`HTTP ${r?.status()}`);
  await page.waitForTimeout(2200);
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]')){try{d.close()}catch{}}});
  client=await page.evaluate(async({name,version})=>{
    const st=await import('/script.js');
    const eng=await import('/scripts/extensions/regex/engine.js');
    await st.getCharacters();
    const idx=st.characters.findIndex(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version);
    if(idx<0)return{error:'not-found'};
    st.setCharacterId(idx);const ch=st.characters[idx];eng.allowScopedScripts(ch);
    const sample='<f7d_terminal>任务：NPC知识边界测试</f7d_terminal><f7d_state>{"secret":1}</f7d_state><f7d_choices><f7d_choice>继续观察</f7d_choice><f7d_choice>询问珈儿</f7d_choice></f7d_choices>';
    const html=st.messageFormatting(sample,'七都UI测试',false,false,999999,{},false);
    const h=document.createElement('div');h.innerHTML=html;document.body.appendChild(h);
    const labels=[...h.querySelectorAll('[data-f7d-choice="1"]')],term=h.querySelector('[data-f7d-terminal="1"]');
    const res={allowed:eng.isScopedScriptsAllowed(ch),labels:labels.map(x=>x.textContent?.trim()),count:labels.length,terminal:Boolean(term),secret:h.textContent?.includes('secret')||false,bridge:Boolean(window.__QIDU_CHOICE_BRIDGE__),probe:Boolean(window.__LINGQI_LAB_PROBE__)};
    h.remove();eng.disallowScopedScripts(ch);return res;
  },{name:card.data.name,version:ONEFILE_VERSION});
  await page.screenshot({path:path.join(evidenceDir,'qidu-v0422-real-st.png'),fullPage:true});
}finally{await browser.close()}

const report={version:ONEFILE_VERSION,hash:compactSha256,import:{ok:imported.ok,status:imported.status,text:importText.slice(0,200)},staticChecks,initialChecks,client,pageErrors};
await fs.writeFile(path.join(evidenceDir,'qidu-v0422-runtime-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'永远的7日之都-七日轮回文本互动-v0.4.22.json'),raw);
console.log(JSON.stringify(report,null,2));
const fail=[...Object.entries(staticChecks).filter(([,v])=>!v).map(([k])=>`static:${k}`),...Object.entries(initialChecks).filter(([,v])=>!v).map(([k])=>`initial:${k}`)];
if(!imported.ok)fail.push(`import:${imported.status}`);
if(client?.error||!client?.allowed||client?.count!==2||!client?.terminal||client?.secret||client?.bridge||client?.probe)fail.push(`client:${JSON.stringify(client)}`);
if(pageErrors.length)fail.push(`page:${pageErrors.join('|')}`);
if(fail.length)throw new Error(`v0422 smoke failed ${fail.join(',')}`);
