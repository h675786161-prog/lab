import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ST_URL=process.env.ST_URL||'http://127.0.0.1:8042/';
const EVIDENCE=process.env.EVIDENCE;
const report={checks:[],pageErrors:[],consoleErrors:[],blockers:[]};
const check=(ok,name,extra={})=>report.checks.push({ok:Boolean(ok),name,...extra});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
page.setDefaultTimeout(12000);
page.on('pageerror',e=>report.pageErrors.push(String(e?.stack||e)));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
const sleep=ms=>page.waitForTimeout(ms);

async function dismissHostPopups(){for(let i=0;i<8;i++){const d=page.locator('dialog[open].popup').last();if(!await d.count())return;const bs=d.locator('button:visible'),labels=await bs.allTextContents();let idx=labels.findIndex(x=>/关闭|close|确定|ok|知道|got it|稍后|later|取消|cancel|继续|continue|跳过|skip/i.test(x));if(idx<0&&labels.length)idx=labels.length-1;if(idx>=0){try{await bs.nth(idx).click();await sleep(120);continue;}catch{}}await page.keyboard.press('Escape');await sleep(120);}}
async function selectSeraphina(){const info=await page.evaluate(async()=>{const t=await import('/script.js');return{idx:(t.characters||[]).findIndex(c=>/seraphina/i.test(String(c?.name||'')))};});if(info.idx<0)throw new Error('Seraphina missing');await page.evaluate(async idx=>{const ctx=globalThis.SillyTavern?.getContext?.();await ctx.selectCharacterById(idx);},info.idx);await page.waitForFunction(()=>/seraphina/i.test(String(globalThis.SillyTavern?.getContext?.()?.characters?.[globalThis.SillyTavern?.getContext?.()?.characterId]?.name||'')),null,{timeout:15000});}
async function home(){for(let i=0;i<6;i++){const b=page.locator('#world-phone-stage [data-app-back]').first();if(!await b.count())break;await b.click().catch(()=>{});await sleep(100);}}
async function openPhone(){await page.waitForSelector('#world-phone-launcher',{timeout:30000});await page.locator('#world-phone-launcher').click();await sleep(220);const u=page.locator('#world-phone-stage [data-unlock]');if(await u.count()){await u.click().catch(()=>{});await sleep(120);}}
async function openApp(name){await home();await page.locator(`#world-phone-stage .wp-app[data-app="${name}"]`).first().click();await sleep(180);}
async function setGameMode(){await openApp('settings');const b=page.locator('#world-phone-stage [data-game-mode="game"]');if(await b.count()){await b.click();await sleep(160);}}
async function refresh(platform){const tools=page.locator('#world-phone-stage .echo-feed-tools').first();if(await tools.count())await tools.locator('summary').click();const b=page.locator(`#world-phone-stage [data-pg-refresh="${platform}"]`).first();await b.click();await page.waitForFunction(p=>{const x=document.querySelector(`#world-phone-stage [data-pg-refresh="${p}"]`);return x&&!x.disabled&&!String(x.textContent||'').includes('更新中');},platform,{timeout:60000});await sleep(300);if(await tools.count()&&await tools.getAttribute('open')!==null)await tools.locator('summary').click().catch(()=>{});}
async function noHorizontalOverflow(label){const v=await page.evaluate(()=>{const s=document.querySelector('#world-phone-stage .wp-screen');const root=document.querySelector('#world-phone-stage [data-phone-game-app]');return{screenClient:s?.clientWidth||0,screenScroll:s?.scrollWidth||0,rootClient:root?.clientWidth||0,rootScroll:root?.scrollWidth||0};});check(v.screenScroll<=v.screenClient+1&&v.rootScroll<=v.rootClient+1,`${label} has no horizontal overflow`,v);}
async function shot(app,width){await page.setViewportSize({width,height:844});await sleep(200);await noHorizontalOverflow(`${app} ${width}`);await page.screenshot({path:path.join(EVIDENCE,`${app}-${width}.png`),fullPage:true});}
async function reopenPhoneSession(){await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded',timeout:60000});await sleep(4200);await dismissHostPopups();await selectSeraphina();await openPhone();await setGameMode();}

try{
  await page.goto(ST_URL,{waitUntil:'domcontentloaded',timeout:60000});await sleep(4200);await dismissHostPopups();await selectSeraphina();await openPhone();await setGameMode();

  await openApp('rednote');
  check(await page.locator('#world-phone-stage .echo-rn-channel').count()===1,'RedNote uses channel-style top navigation');
  check((await page.locator('#world-phone-stage .echo-rn-channel').innerText()).includes('关注')&&(await page.locator('#world-phone-stage .echo-rn-channel').innerText()).includes('发现'),'RedNote shows 关注 / 发现 channels');
  check(await page.locator('#world-phone-stage .echo-feed-tools').count()===1,'RedNote generation controls are behind overflow menu');
  check(await page.locator('#world-phone-stage .echo-feed-tools[open]').count()===0,'RedNote generator controls are hidden by default');
  await refresh('rednote');
  check(await page.locator('#world-phone-stage .echo-note-card').count()===6,'RedNote renders six seeded notes');
  const columns=await page.locator('#world-phone-stage .echo-note-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  check(columns===2,'RedNote uses two-column waterfall feed',{columns});
  check(await page.locator('#world-phone-stage .echo-note-copy .wpg-image-actions:visible').count()===0,'RedNote feed hides developer image controls');
  check(await page.locator('#world-phone-stage .echo-real-social-nav button').count()===4,'RedNote bottom nav has four app-level destinations');
  await shot('rednote',390);await shot('rednote',320);

  await reopenPhoneSession();await openApp('weibo');
  check(await page.locator('#world-phone-stage .echo-wb-channel').count()===1,'Weibo uses channel-style top navigation');
  check((await page.locator('#world-phone-stage .echo-wb-channel').innerText()).includes('推荐')&&(await page.locator('#world-phone-stage .echo-wb-channel').innerText()).includes('关注'),'Weibo shows 推荐 / 关注 channels');
  await refresh('weibo');
  check(await page.locator('#world-phone-stage .echo-post.is-weibo').count()===5,'Weibo renders five seeded posts');
  check(await page.locator('#world-phone-stage .echo-wb-actions').count()===5,'Weibo posts use social action rows');
  const actionText=await page.locator('#world-phone-stage .echo-wb-actions').first().innerText();
  check(/转发/.test(actionText)&&/评论/.test(actionText)&&/赞/.test(actionText),'Weibo action row shows 转发 / 评论 / 赞',{actionText});
  const bodyText=await page.locator('#world-phone-stage').innerText();
  check(!/\b(?:fact|mixed|rumor)\b/i.test(bodyText),'Weibo hides backend claim-state labels');
  check(await page.locator('#world-phone-stage .echo-post.is-weibo:not(.is-detail) > .wpg-image-actions:visible').count()===0,'Weibo feed hides developer image controls');
  check(await page.locator('#world-phone-stage .echo-real-social-nav button').count()===4,'Weibo bottom nav has four app-level destinations');
  await shot('weibo',390);await shot('weibo',320);

  report.pageErrors=report.pageErrors.filter(Boolean);
}catch(error){report.blockers.push(String(error?.stack||error));}
finally{report.passed=report.checks.length>0&&report.checks.every(x=>x.ok)&&report.blockers.length===0&&report.pageErrors.length===0;fs.writeFileSync(path.join(EVIDENCE,'social-ui-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
if(!report.passed)process.exitCode=1;
