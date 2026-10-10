import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const evidence = process.env.EVIDENCE;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true, args: ['--no-sandbox'] });
const viewports = [
  ['phone',390,844],['narrow',320,640],['tablet',820,1180],['desktop',1440,1000],['landscape',844,390],
];
const sequence = ['wechat','weibo','rednote','wallet','delivery','music','phone','messages','appstore'];
const report = { yellowmiSha: fs.readFileSync(path.join(evidence,'yellowmi-sha.txt'),'utf8').trim(), runs: [], consoleErrors: [] };

for (const [name,width,height] of viewports) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const run = { name, width, height, apps: {}, shell: {}, notes: [] };
  page.on('pageerror', error => report.consoleErrors.push({ viewport:name, type:'pageerror', text:String(error) }));
  page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push({ viewport:name, type:'console', text:msg.text() }); });
  await page.goto(process.env.ST_URL, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(4500);

  const launcher = page.locator('#world-phone-launcher');
  run.shell.launcher = await launcher.count() > 0;
  if (!run.shell.launcher) {
    run.notes.push('手机入口未出现；真实酒馆初始页面未加载扩展。');
    await page.screenshot({ path:path.join(evidence,`${name}-no-launcher.png`), fullPage:true });
    report.runs.push(run); await context.close(); continue;
  }
  await launcher.click({ timeout:10000 });
  await page.waitForTimeout(500);
  const unlock = page.locator('#world-phone-stage [data-unlock]');
  if (await unlock.count()) { try { await unlock.click({ timeout:3000 }); await page.waitForTimeout(300); } catch {} }
  run.shell.stageVisible = await page.locator('#world-phone-stage.is-open').count() > 0;
  run.shell.bounds = await page.locator('#world-phone-stage .wp-screen-glass').evaluate(el => {
    const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight};
  }).catch(()=>null);

  for (const app of sequence) {
    const entry = page.locator(`#world-phone-stage .wp-app[data-app="${app}"]`).first();
    if (!await entry.count()) { run.apps[app] = { entry:false, status:'入口不存在或当前环境未提供' }; continue; }
    try {
      await entry.click({ timeout:5000 });
      await page.waitForTimeout(250);
      const root = page.locator('#world-phone-stage .wp-native-app').last();
      const appResult = { entry:true, opened:await root.count()>0, overflow:false, actions:[], residues:[] };
      appResult.overflow = await page.locator('#world-phone-stage .wp-screen-glass').evaluate(el => el.scrollWidth > el.clientWidth + 2).catch(()=>false);
      const currentGame = await page.locator('#world-phone-stage [data-phone-game-app]').getAttribute('data-phone-game-app').catch(()=>null);
      if (currentGame && currentGame !== app && !(app === 'messages' || app === 'phone')) appResult.residues.push(`残留 data-phone-game-app=${currentGame}`);

      if (app === 'wechat') {
        const thread = page.locator('#world-phone-stage .wpg-chat-list [data-pg-chat]').first();
        if (await thread.count()) { await thread.click(); await page.waitForTimeout(100); appResult.actions.push('thread'); const back=page.locator('#world-phone-stage [data-pg-chats]').first(); if(await back.count()) await back.click(); }
        else appResult.actions.push('thread：无真实人物，未验证');
        const contacts = page.locator('#world-phone-stage [data-pg-view="relations"]').first();
        if (await contacts.count()) { await contacts.click(); await page.waitForTimeout(100); appResult.actions.push('通讯录'); }
        const contact = page.locator('#world-phone-stage [data-pg-contact]').first();
        if (await contact.count()) { await contact.click(); await page.waitForTimeout(100); appResult.actions.push('联系人详情'); const back=page.locator('#world-phone-stage [data-pg-contact-back]').first(); if(await back.count()) await back.click(); }
        else appResult.actions.push('联系人详情：无真实人物，未验证');
        const discover = page.locator('#world-phone-stage [data-pg-view="moments"]').first();
        if (await discover.count()) { await discover.click(); await page.waitForTimeout(100); appResult.actions.push('发现'); }
        const moments = page.locator('#world-phone-stage [data-pg-open-moments]').first();
        if (await moments.count()) { await moments.click(); await page.waitForTimeout(100); appResult.actions.push('朋友圈'); }
        const backMoments = page.locator('#world-phone-stage [data-pg-discovery-back]').first();
        if (await backMoments.count()) { await backMoments.click(); appResult.actions.push('返回发现'); }
      }
      if (app === 'weibo') {
        const post = page.locator('#world-phone-stage [data-pg-post]').first();
        if (await post.count()) { await post.click(); await page.waitForTimeout(100); appResult.actions.push('详情'); const back=page.locator('#world-phone-stage [data-pg-post-back]').first(); if(await back.count()) await back.click(); }
        else appResult.actions.push('详情：无真实帖子，未验证');
      }
      if (app === 'rednote') {
        const post = page.locator('#world-phone-stage [data-pg-post]').first();
        if (await post.count()) { await post.click(); await page.waitForTimeout(100); appResult.actions.push('笔记详情'); if(await page.locator('#world-phone-stage .echo-rn-detail').count()) appResult.actions.push('独立详情结构'); const back=page.locator('#world-phone-stage [data-pg-post-back]').first(); if(await back.count()) await back.click(); }
        else appResult.actions.push('笔记详情：无真实人物/帖子数据，未验证');
      }
      if (app === 'delivery') {
        const merchant = page.locator('#world-phone-stage [data-pg-delivery-merchant]').first();
        if (await merchant.count()) { await merchant.click(); await page.waitForTimeout(100); appResult.actions.push('商家'); }
        const add = page.locator('#world-phone-stage [data-pg-delivery-add]').first();
        if (await add.count()) { await add.click(); await page.waitForTimeout(100); appResult.actions.push('商品→购物车'); }
        const checkout = page.locator('#world-phone-stage [data-pg-delivery-go="checkout"]').first();
        if (await checkout.count() && await checkout.isEnabled()) { await checkout.click(); await page.waitForTimeout(100); appResult.actions.push('结算'); }
        else appResult.actions.push('结算/下单：无真实收礼角色或余额条件不足，未验证');
      }
      run.apps[app] = appResult;
      await page.screenshot({ path:path.join(evidence,`${name}-${app}.png`) });
      const back = page.locator('#world-phone-stage [data-app-back]').first();
      if (await back.count()) { await back.click(); await page.waitForTimeout(150); }
      else run.notes.push(`${app}: 未找到标准返回桌面按钮`);
    } catch (error) {
      run.apps[app] = { entry:true, opened:false, status:String(error) };
      const homeBack = page.locator('#world-phone-stage [data-app-back]').first();
      if (await homeBack.count()) { try { await homeBack.click(); await page.waitForTimeout(100); } catch {} }
    }
  }
  await page.screenshot({ path:path.join(evidence,`${name}-final.png`) });
  report.runs.push(run);
  await context.close();
}
await browser.close();
fs.writeFileSync(path.join(evidence,'ui-audit.json'), JSON.stringify(report,null,2));
const actionable = report.consoleErrors.filter(item => !/favicon|extensions\/version/i.test(item.text));
if (actionable.length) { console.error(JSON.stringify(actionable,null,2)); process.exitCode = 2; }
