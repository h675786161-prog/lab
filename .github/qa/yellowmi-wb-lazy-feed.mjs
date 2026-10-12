import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ST_URL=process.env.ST_URL||'http://127.0.0.1:8043/';
const EVIDENCE=process.env.EVIDENCE;
const report={checks:[],pageErrors:[],consoleErrors:[],blockers:[]};
const check=(ok,name,extra={})=>report.checks.push({ok:Boolean(ok),name,...extra});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror',e=>report.pageErrors.push(String(e?.stack||e)));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
const sleep=ms=>page.waitForTimeout(ms);

async function dismissHostPopups(){for(let i=0;i<8;i++){const d=page.locator('dialog[open].popup').last();if(!await d.count())return;const bs=d.locator('button:visible'),labels=await bs.allTextContents();let idx=labels.findIndex(x=>/关闭|close|确定|ok|知道|got it|稍后|later|取消|cancel|继续|continue|跳过|skip/i.test(x));if(idx<0&&labels.length)idx=labels.length-1;if(idx>=0){try{await bs.nth(idx).click();await sleep(120);continue;}catch{}}await page.keyboard.press('Escape');await sleep(120);}}
async function selectSeraphina(){const info=await page.evaluate(async()=>{const t=await import('/script.js');return{idx:(t.characters||[]).findIndex(c=>/seraphina/i.test(String(c?.name||'')))};});if(info.idx<0)throw new Error('Seraphina missing');await page.evaluate(async idx=>{const ctx=globalThis.SillyTavern?.getContext?.();await ctx.selectCharacterById(idx);},info.idx);await page.waitForFunction(()=>/seraphina/i.test(String(globalThis.SillyTavern?.getContext?.()?.characters?.[globalThis.SillyTavern?.getContext?.()?.characterId]?.name||'')),null,{timeout:15000});}
async function openPhone(){if(await page.locator('#world-phone-stage .wp-app[data-app]').count())return;const launcher=page.locator('#world-phone-launcher');await launcher.waitFor({state:'visible',timeout:30000});await launcher.click();await sleep(250);const u=page.locator('#world-phone-stage [data-unlock]');if(await u.count()){await u.click().catch(()=>{});await sleep(120);}await page.locator('#world-phone-stage .wp-app[data-app]').first().waitFor({state:'visible',timeout:12000});}
async function desktop(){if(await page.locator('#world-phone-stage .wp-app[data-app]').count())return;const back=page.locator('#world-phone-stage [data-app-back]:visible').first();if(await back.count()){await back.click();await sleep(200);}if(!await page.locator('#world-phone-stage .wp-app[data-app]').count())await openPhone();}
async function openApp(name){await desktop();const icon=page.locator(`#world-phone-stage .wp-app[data-app="${name}"]`).first();await icon.waitFor({state:'visible'});await icon.click();await sleep(250);}
async function setWorldMode(){await openApp('settings');const b=page.locator('#world-phone-stage [data-game-mode="world"]');await b.waitFor({state:'visible'});await b.click();await sleep(220);await desktop();}
async function qaState(){return page.evaluate(()=>({calls:globalThis.__PAIR_QA__||null,cache:globalThis.SillyTavern?.getContext?.()?.chatMetadata?.world_backstage_v1?.phoneFeedCacheV1||null,surface:globalThis.worldBackstageHost?.getPhoneSurface?.()}));}

try{
  await page.goto(ST_URL,{waitUntil:'domcontentloaded',timeout:60000});await sleep(4500);await dismissHostPopups();await selectSeraphina();
  await page.waitForFunction(()=>Boolean(globalThis.worldBackstageHost?.phoneBridgeVersion>=2&&globalThis.worldBackstageHost?.phoneFeedBridgeVersion>=1&&typeof globalThis.worldBackstageHost?.requestPhoneFeed==='function'),null,{timeout:30000});

  await page.evaluate(()=>{
    const ctx=globalThis.SillyTavern.getContext();
    const host=globalThis.worldBackstageHost;
    ctx.chatMetadata ||= {};

    // Let World Backstage create and normalize its real store first. The paired QA
    // then mutates only public test fixtures inside that valid state, rather than
    // inventing a partial store that production would never persist.
    host.getPublicSurface?.();
    const store=ctx.chatMetadata.world_backstage_v1;
    if(!store?.currentState)throw new Error('World Backstage did not initialize a real currentState');
    store.currentState={
      ...store.currentState,
      world:{...(store.currentState.world||{}),name:'懒加载测试城'},
      clock:{...(store.currentState.clock||{}),absoluteMinute:600,displayTime:'10:00'},
      lastCommit:{...(store.currentState.lastCommit||{}),sourceKey:'branch-A'},
      people:[
        ...(Array.isArray(store.currentState.people)?store.currentState.people:[]).filter(person=>person?.id!=='p1'),
        {id:'p1',name:'阿青',source:'background',simulationEnabled:true,relevance:1,updatedAt:600},
      ],
      events:[],
    };
    store.social={schemaVersion:2,activeConversationId:'',conversations:[],connections:[{personId:'p1',status:'accepted'}],moments:[{id:'m1',personId:'p1',text:'今天买了花，顺路在河边坐了一会儿。',visibility:'friends',likes:2,likedByUser:false,comments:[],worldMinute:599,createdAt:'2026-10-13T02:00:00.000Z'}],notices:[]};
    store.publicOpinion={generatedAt:'2026-10-13T02:00:00.000Z',sourceWorldMinute:600,news:[],forums:[]};
    delete store.phoneFeedCacheV1;

    globalThis.__PAIR_QA__={refresh:0,sandbox:0};
    host.generatePublicOpinionSandbox=async()=>{globalThis.__PAIR_QA__.sandbox+=1;};
    host.getPublicSurface=()=>({sandbox:{generatedAt:'2026-10-13T02:01:00.000Z',nonCanon:true,news:[{headline:'街角新开了一家小店',summary:'有人路过时拍了菜单，晚上灯牌很亮。',source:'本地生活',category:'生活',heat:1}],forums:[{board:'闲聊',title:'今天的风很舒服',summary:'下班路上很多人在河边坐着。',heat:1,replies:[{author:'路人甲',text:'确实，今天适合散步。'}]},{board:'吃喝',title:'夜市烤饼排队了吗',summary:'新摊第一天，队伍拐了个弯。',heat:2,replies:[]}]}});
    host.refreshPublicOpinion=async()=>{
      globalThis.__PAIR_QA__.refresh+=1;
      store.currentState.events=[
        {id:'e-night',publicity:'public',status:'active',publicTrace:'河边夜市客流变多。',publicHeadline:'夜市新摊开张',publicSummary:'河边夜市多了个烤饼摊。'},
        {id:'e-walk',publicity:'public',status:'active',publicTrace:'今晚河边散步的人不少。',publicHeadline:'今晚适合散步',publicSummary:'河边风很轻，散步的人不少。'},
        {id:'e-cafe',publicity:'public',status:'active',publicTrace:'街角咖啡店延长夜间营业。',publicHeadline:'咖啡店延长营业',publicSummary:'街角咖啡店今天营业到很晚。'}
      ];
      store.publicOpinion={generatedAt:`2026-10-13T02:0${globalThis.__PAIR_QA__.refresh+1}:00.000Z`,sourceWorldMinute:600,news:[],forums:[
        {id:'f-night',board:'夜市',title:'夜市新摊开张',summary:'河边夜市多了个烤饼摊。',sourceType:'unofficial',scope:'生活',claimStatus:'fact',heat:2,replies:[],relatedEventId:'e-night'},
        {id:'f-walk',board:'闲聊',title:'今晚适合散步',summary:'河边风很轻，散步的人不少。',sourceType:'unofficial',scope:'生活',claimStatus:'fact',heat:1,replies:[],relatedEventId:'e-walk'},
        {id:'f-cafe',board:'探店',title:'咖啡店延长营业',summary:'街角咖啡店今天营业到很晚。',sourceType:'unofficial',scope:'生活',claimStatus:'fact',heat:1,replies:[],relatedEventId:'e-cafe'}
      ]};
    };
  });

  const before=await qaState();
  check(before.calls?.refresh===0&&before.calls?.sandbox===0,'Loading both extensions spends zero phone-feed generation calls',{calls:before.calls});
  check(!before.cache,'Phone feed cache does not exist before a social app is requested');

  await openPhone();await setWorldMode();
  const afterMode=await qaState();
  check(afterMode.calls?.refresh===0&&afterMode.calls?.sandbox===0,'Opening phone and settings still spends zero phone-feed calls',{calls:afterMode.calls});

  await openApp('weibo');
  await page.waitForFunction(()=>Boolean(globalThis.worldBackstageHost?.peekPhoneFeed?.('weibo')),null,{timeout:12000});
  await sleep(350);
  const first=await qaState();
  check(first.calls?.refresh===0&&first.calls?.sandbox===1,'First sparse Weibo open requests one non-canon filler and no canonical refresh',{calls:first.calls});
  check(Boolean(first.cache?.weibo),'First Weibo open creates branch-scoped cache');
  const wbText=await page.locator('#world-phone-stage').innerText();
  check(/买了花|街角新开|今天的风|夜市烤饼/.test(wbText),'World-mode Weibo renders World Backstage projected feed',{sample:wbText.slice(0,800)});
  await page.screenshot({path:path.join(EVIDENCE,'weibo-first-open.png'),fullPage:true});

  await desktop();await openApp('weibo');
  await sleep(350);
  const second=await qaState();
  check(second.calls?.refresh===0&&second.calls?.sandbox===1,'Reopening unchanged Weibo hits cache with zero new generation',{calls:second.calls});

  const refresh=page.locator('#world-phone-stage [data-social-opinion-refresh]').first();
  await refresh.waitFor({state:'visible'});await refresh.click();
  await page.waitForFunction(()=>globalThis.__PAIR_QA__?.refresh===1,null,{timeout:12000});await sleep(450);
  const forced=await qaState();
  check(forced.calls?.refresh===1&&forced.calls?.sandbox===1,'Explicit refresh invokes canonical World Backstage refresh without unnecessary second filler',{calls:forced.calls});
  const refreshedText=await page.locator('#world-phone-stage').innerText();
  check(/夜市新摊开张|今晚适合散步|咖啡店延长营业/.test(refreshedText),'Weibo repaints from refreshed canonical World Backstage public opinion');
  await page.screenshot({path:path.join(EVIDENCE,'weibo-after-refresh.png'),fullPage:true});

  await desktop();await openApp('rednote');
  await page.waitForFunction(()=>Boolean(globalThis.worldBackstageHost?.peekPhoneFeed?.('rednote')),null,{timeout:12000});await sleep(350);
  const red=await qaState();
  check(red.calls?.refresh===1&&red.calls?.sandbox===1,'RedNote reuses lifestyle-friendly canonical data with zero extra generation',{calls:red.calls});
  const rnText=await page.locator('#world-phone-stage').innerText();
  check(/夜市新摊开张|今晚适合散步|咖啡店延长营业|买了花/.test(rnText),'World-mode RedNote renders the same world through its own UI');
  await page.screenshot({path:path.join(EVIDENCE,'rednote-world-feed.png'),fullPage:true});

  report.pageErrors=report.pageErrors.filter(Boolean);
}catch(error){report.blockers.push(String(error?.stack||error));}
finally{report.passed=report.checks.length>0&&report.checks.every(x=>x.ok)&&report.blockers.length===0&&report.pageErrors.length===0;fs.writeFileSync(path.join(EVIDENCE,'paired-lazy-feed-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
if(!report.passed)process.exitCode=1;
