import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ST_URL = process.env.ST_URL || 'http://127.0.0.1:8041/';
const EVIDENCE = process.env.EVIDENCE;
const EXPECTED_MAX = 8192;
const TARGET_COUNT = 7;
const report = {
  stUrl:ST_URL, expectedMaxTokens:EXPECTED_MAX, targetCount:TARGET_COUNT,
  yellowmiSha:fs.readFileSync(path.join(EVIDENCE,'yellowmi-sha.txt'),'utf8').trim(),
  sillyTavernSha:fs.readFileSync(path.join(EVIDENCE,'sillytavern-sha.txt'),'utf8').trim(),
  checks:[], requests:[], pageErrors:[], consoleErrors:[], blockers:[],
};
const check=(ok,name,extra={})=>report.checks.push({ok:Boolean(ok),name,...extra});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
page.setDefaultTimeout(10000);
page.on('pageerror',e=>report.pageErrors.push(String(e?.stack||e)));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
page.on('request',req=>{
  if(req.method()!=='POST'||!/chat-completions\/generate/.test(req.url()))return;
  let body=null;try{body=req.postDataJSON();}catch{try{body=JSON.parse(req.postData()||'{}');}catch{body={raw:req.postData()};}}
  report.requests.push({url:req.url(),body});
});
const sleep=ms=>page.waitForTimeout(ms);
async function dismissHostPopups(){
  for(let i=0;i<8;i++){
    const dialog=page.locator('dialog[open].popup').last();if(!await dialog.count())return;
    const buttons=dialog.locator('button:visible'),labels=await buttons.allTextContents();
    let idx=labels.findIndex(x=>/关闭|close|确定|ok|知道|got it|稍后|later|取消|cancel|继续|continue|跳过|skip/i.test(x));
    if(idx<0&&labels.length)idx=labels.length-1;
    if(idx>=0){try{await buttons.nth(idx).click();await sleep(150);continue;}catch{}}
    await page.keyboard.press('Escape');await sleep(120);
  }
}
async function selectSeraphina(){
  const info=await page.evaluate(async()=>{const t=await import('/script.js');const idx=(t.characters||[]).findIndex(c=>/seraphina/i.test(String(c?.name||'')));return{idx,names:(t.characters||[]).map(c=>c?.name||'')};});
  check(info.idx>=0,'bundled Seraphina exists',{names:info.names});if(info.idx<0)throw new Error('Seraphina missing');
  const target=page.locator(`#rm_print_characters_block .character_select[chid="${info.idx}"]`).first();
  let activation='host-selectCharacterById';
  if(await target.count()&&await target.isVisible().catch(()=>false)){activation='visible-character-card-click';await target.click();}
  else await page.evaluate(async idx=>{const ctx=globalThis.SillyTavern?.getContext?.();if(typeof ctx?.selectCharacterById!=='function')throw new Error('selectCharacterById unavailable');await ctx.selectCharacterById(idx);},info.idx);
  report.characterActivation=activation;
  await page.waitForFunction(()=>/seraphina/i.test(String(globalThis.SillyTavern?.getContext?.()?.characters?.[globalThis.SillyTavern?.getContext?.()?.characterId]?.name||'')),null,{timeout:15000});
  check(true,'Seraphina activated through real SillyTavern host',{activation});await sleep(500);
}
async function home(){for(let i=0;i<5;i++){const back=page.locator('#world-phone-stage [data-app-back]').first();if(!await back.count())break;await back.click().catch(()=>{});await sleep(120);}}
async function openPhone(){await page.waitForSelector('#world-phone-launcher',{timeout:30000});await page.locator('#world-phone-launcher').click();await sleep(250);const unlock=page.locator('#world-phone-stage [data-unlock]');if(await unlock.count()){await unlock.click().catch(()=>{});await sleep(150);}}
async function openApp(name){await home();await page.locator(`#world-phone-stage .wp-app[data-app="${name}"]`).first().click();await sleep(180);}
async function refreshAndWait(){
  const button=page.locator('#world-phone-stage [data-pg-refresh="rednote"]').first();
  await button.click();await sleep(150);
  await page.waitForFunction(()=>{const b=document.querySelector('#world-phone-stage [data-pg-refresh="rednote"]');return b&&!b.disabled&&!String(b.textContent||'').includes('更新中');},null,{timeout:60000});
  await sleep(350);
}
const cardCount=()=>page.locator('#world-phone-stage .echo-note-card').count();
const stageText=()=>page.locator('#world-phone-stage').innerText();

try{
  await page.goto(ST_URL,{waitUntil:'domcontentloaded',timeout:60000});await sleep(4500);await dismissHostPopups();await selectSeraphina();
  const host=await page.evaluate(()=>{const ctx=globalThis.SillyTavern?.getContext?.();return{character:ctx?.characters?.[ctx?.characterId]?.name||'',generateRawType:typeof ctx?.generateRaw,generateRawLength:ctx?.generateRaw?.length,configuredMax:ctx?.chatCompletionSettings?.openai_max_tokens};});
  check(host.character==='Seraphina','real character selected',host);check(host.generateRawType==='function','real host exposes generateRaw',host);check(host.generateRawLength<=1,'real host uses object-style generateRaw signature',host);check(Number(host.configuredMax)===EXPECTED_MAX,'real host output setting is 8192',host);
  await openPhone();await openApp('settings');const gameMode=page.locator('#world-phone-stage [data-game-mode="game"]');if(await gameMode.count()){await gameMode.click();await sleep(180);}await openApp('rednote');
  const countInput=page.locator('#world-phone-stage [data-pg-feed-count="rednote"]').first();check(await countInput.count()===1,'RedNote target-count control exists');if(!await countInput.count())throw new Error('target-count control missing');await countInput.fill(String(TARGET_COUNT));await countInput.dispatchEvent('input');check(await countInput.inputValue()===String(TARGET_COUNT),'RedNote target-count control accepts 7');

  await refreshAndWait();
  check(await cardCount()===7,'full local upstream response saves and renders all 7 posts',{cardCount:await cardCount()});
  const firstReq=report.requests[0];check(Boolean(firstReq),'full refresh reached real SillyTavern backend');
  if(firstReq){const s=JSON.stringify(firstReq.body||{});check(Number(firstReq.body?.max_tokens)===EXPECTED_MAX,'full request keeps SillyTavern 8192 output setting',{actualMaxTokens:firstReq.body?.max_tokens});check(s.includes(`本次目标生成${TARGET_COUNT}条新帖`),'full request carries target count 7');}
  await page.screenshot({path:path.join(EVIDENCE,'yellowmi-feed-full-390.png'),fullPage:true});

  await refreshAndWait();
  const textAfterPartial=await stageText();
  check(await cardCount()===8,'one complete plus one truncated post adds only the complete post',{cardCount:await cardCount()});
  check(textAfterPartial.includes('已保留完整返回的 1 条动态'),'partial response reports exactly one preserved post');
  await page.screenshot({path:path.join(EVIDENCE,'yellowmi-feed-partial-one-390.png'),fullPage:true});

  await refreshAndWait();
  const textAfterZero=await stageText();
  check(await cardCount()===8,'first-post truncation preserves all existing posts without adding a broken post',{cardCount:await cardCount()});
  check(textAfterZero.includes('动态内容被截断')&&textAfterZero.includes('没有完整帖子可保存'),'first-post truncation shows explicit retry error');
  check(report.requests.length===3,'three real browser refreshes produced three SillyTavern backend requests',{requestCount:report.requests.length});
  check(report.requests.every(r=>Number(r.body?.max_tokens)===EXPECTED_MAX),'all three backend requests keep 8192 rather than Echo 6144',{maxTokens:report.requests.map(r=>r.body?.max_tokens)});
  await page.screenshot({path:path.join(EVIDENCE,'yellowmi-feed-partial-zero-390.png'),fullPage:true});
}catch(error){report.blockers.push(String(error?.stack||error));}
finally{
  report.passed=report.checks.length>0&&report.checks.every(x=>x.ok)&&report.blockers.length===0;
  fs.writeFileSync(path.join(EVIDENCE,'feed-control-local-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
}
if(!report.passed)process.exitCode=1;
