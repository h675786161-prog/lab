import fs from 'node:fs/promises';
import path from 'node:path';
import { loadV0414R3Card, entryMap, EXPECTED_V0414_R3_SHA256 } from './qidu-card-v0414-r3.mjs';

const baseUrl = process.env.LAB_ST_URL || 'http://127.0.0.1:8000';
const evidenceDir = process.env.LAB_EVIDENCE_DIR || 'lab-evidence';
await fs.mkdir(evidenceDir, { recursive: true });

const { card, raw, compactSha256 } = await loadV0414R3Card();
const entries = card.data.character_book?.entries || [];
const BOOK = entryMap(card);
const get = n => BOOK[n] || '';
const scripts = card.data.extensions?.regex_scripts || [];
const wrap = scripts.find(x => x.id === 'f7d-choices-wrap-v0414');
const button = scripts.find(x => x.id === 'f7d-choice-button-v0414');
const staticChecks = {
  hash: compactSha256 === EXPECTED_V0414_R3_SHA256,
  version: card.data.character_version === '0.4.14-lab',
  worldbook55: entries.length === 55,
  choiceMarkup: Boolean(wrap && button) && button.replaceString.includes('data-f7d-choice="1"') && !button.replaceString.includes('onclick='),
  choiceBridgeDeclared: card.data.extensions?.qidu_choice_bridge?.required === true,
  decisionMustRender: get('04｜输出协议：隐藏状态、正文、终端').includes('决策点选项块语法锁'),
  annBoundary: get('40｜安').includes('拆解请求的回应边界'),
  yanhuaClosedEvidence: get('42｜晏华').includes('封闭证据集零扩写规则'),
  wenziAtomic: get('31｜东方古街：六巡查与五行阵黑核').includes('延误分支原子结算'),
  noGuideLeak: get('17｜最终日：普通线结局判定优先级').includes('最终抉择防攻略泄露'),
  sybillaNoNodeLeak: get('66｜西比尔').includes('节点信息不对玩家泄露'),
};

const form = new FormData();
form.set('file_type', 'json');
form.set('avatar', new Blob([raw], { type:'application/json' }), 'qidu-card-v0.4.14-lab-r4.json');
const importResponse = await fetch(`${baseUrl}/api/characters/import`, { method:'POST', body:form });
const importText = await importResponse.text();

const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser = await chromium.launch({ headless:true, executablePath:process.env.LAB_CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
const pageErrors=[]; const consoleErrors=[];
page.on('pageerror', e=>pageErrors.push(String(e?.stack||e)));
page.on('console', m=>{ if(m.type()==='error') consoleErrors.push(m.text()); });

async function testChoice(viewport) {
  await page.setViewportSize(viewport);
  return page.evaluate(async ({ wrap, button }) => {
    const { runRegexScript } = await import('/scripts/extensions/regex/engine.js');
    const { messageFormatting } = await import('/script.js');
    const input = document.querySelector('#send_textarea');
    if (!(input instanceof HTMLTextAreaElement)) return { error:'no textarea' };
    input.value='';
    const inputDisabled = input.disabled;
    const inputReadOnly = input.readOnly;
    let inputEvents=0, changeEvents=0;
    const onInput=()=>inputEvents++; const onChange=()=>changeEvents++;
    input.addEventListener('input',onInput); input.addEventListener('change',onChange);
    const source='<f7d_choices><f7d_choice>先去高校学园看看</f7d_choice><f7d_choice>留在中央庭整理情报</f7d_choice></f7d_choices>';
    let html=runRegexScript(wrap,source); html=runRegexScript(button,html);
    const formatted=messageFormatting(html,'七都UI测试',false,false,999999,{},false);
    const host=document.createElement('div'); host.innerHTML=formatted; host.style.width='100%'; document.body.appendChild(host);
    const buttons=[...host.querySelectorAll('[data-f7d-choice="1"]')];
    const grid=buttons[0]?.closest('[class*="f7d-choice-grid"]');
    const before=document.querySelectorAll('.mes').length;
    buttons[0]?.click(); await new Promise(r=>setTimeout(r,100));
    const bstyle=buttons[0]?getComputedStyle(buttons[0]):null;
    const gstyle=grid?getComputedStyle(grid):null;
    const active = document.activeElement;
    const result={
      bridgeLoaded:Boolean(window.__LINGQI_LAB_PROBE__?.qiduChoiceBridge),
      bridgeVersion:window.__LINGQI_LAB_PROBE__?.choiceBridgeVersion||null,
      buttonCount:buttons.length,
      labels:buttons.map(b=>b.textContent?.trim()),
      inputValue:input.value,
      inputEvents,changeEvents,
      inputDisabled,inputReadOnly,
      focused:active===input,
      activeElement:active?.id||active?.tagName||null,
      noAutoSend:before===document.querySelectorAll('.mes').length,
      inlineOnclick:buttons[0]?.getAttribute('onclick')??null,
      dataHookSurvives:formatted.includes('data-f7d-choice="1"'),
      minHeight:bstyle?.minHeight??null,
      buttonWidth:bstyle?.width??null,
      gridColumns:gstyle?.gridTemplateColumns??null,
      gridWidth:gstyle?.width??null,
    };
    input.removeEventListener('input',onInput); input.removeEventListener('change',onChange); host.remove();
    return result;
  }, { wrap, button });
}

let browserApi=null, desktop=null, mobile=null;
try {
  const response=await page.goto(`${baseUrl}/`,{waitUntil:'domcontentloaded',timeout:60000});
  if(!response||response.status()>=400) throw new Error(`ST HTTP ${response?.status()}`);
  await page.waitForTimeout(2500);
  browserApi=await page.evaluate(async ({name,version})=>{
    let r=await fetch('/api/characters/all',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); let text=await r.text(); let data; try{data=JSON.parse(text)}catch{data=null}
    if(!r.ok||!data){r=await fetch('/api/characters/all');text=await r.text();try{data=JSON.parse(text)}catch{data=null}}
    const arr=Array.isArray(data)?data:Array.isArray(data?.characters)?data.characters:(data&&typeof data==='object'?Object.values(data):[]);
    const found=arr.find(x=>(x?.data?.name||x?.name)===name&&x?.data?.character_version===version);
    const scripts=found?.data?.extensions?.regex_scripts||[];
    return {ok:r.ok,found:Boolean(found),version:found?.data?.character_version||null,entries:found?.data?.character_book?.entries?.length||0,choiceScripts:scripts.filter(x=>String(x?.id||'').includes('choice')).map(x=>x.id),hasInlineJs:String(scripts.find(x=>x?.id==='f7d-choice-button-v0414')?.replaceString||'').includes('onclick='),bridgeDeclared:found?.data?.extensions?.qidu_choice_bridge?.required===true};
  },{name:card.data.name,version:'0.4.14-lab'});
  desktop=await testChoice({width:1440,height:1000});
  mobile=await testChoice({width:390,height:844});
  await page.screenshot({path:path.join(evidenceDir,'qidu-card-v0414-r4-mobile.png'),fullPage:true});
} finally { await browser.close(); }

const report={version:card.data.character_version,hash:compactSha256,import:{status:importResponse.status,ok:importResponse.ok,text:importText.slice(0,300)},staticChecks,browserApi,desktop,mobile,pageErrors,consoleErrors};
await fs.writeFile(path.join(evidenceDir,'qidu-card-runtime-report.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(evidenceDir,'qidu-card-v0.4.14-lab.json'),raw);
console.log(JSON.stringify(report,null,2));

const failed=Object.entries(staticChecks).filter(([,v])=>!v).map(([k])=>k);
if(!importResponse.ok) throw new Error(`import failed ${importResponse.status}: ${importText}`);
if(failed.length) throw new Error(`static failed: ${failed.join(',')}`);
if(!browserApi?.ok||!browserApi?.found||browserApi?.version!=='0.4.14-lab'||browserApi?.entries!==55||browserApi?.hasInlineJs||!browserApi?.bridgeDeclared) throw new Error(`browser card check failed ${JSON.stringify(browserApi)}`);
for(const [name,x] of [['desktop',desktop],['mobile',mobile]]){
  if(!x?.bridgeLoaded||x?.buttonCount!==2||x?.inputValue!=='先去高校学园看看'||x?.inputEvents<1||x?.changeEvents<1||!x?.noAutoSend||x?.inlineOnclick!==null||!x?.dataHookSurvives) throw new Error(`${name} choice failed ${JSON.stringify(x)}`);
}
if(pageErrors.length) throw new Error(`page errors: ${pageErrors.join(' | ')}`);
