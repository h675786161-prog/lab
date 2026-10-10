import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const evidence = process.env.EVIDENCE;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true, args: ['--no-sandbox'] });
const viewports = [
  ['phone',390,844],
  ['narrow',320,640],
  ['tablet',820,1180],
  ['desktop',1440,1000],
  ['landscape',844,390],
];
const sequence = ['wechat','weibo','rednote','wallet','delivery','music','phone','messages','appstore'];
const report = {
  yellowmiSha: fs.readFileSync(path.join(evidence,'yellowmi-sha.txt'),'utf8').trim(),
  sillyTavernSha: fs.readFileSync(path.join(evidence,'sillytavern-sha.txt'),'utf8').trim(),
  runs: [], pageErrors: [], consoleErrors: [], networkFailures: [],
};

async function dismissHostPopups(page, run, viewportName) {
  for (let pass = 0; pass < 6; pass++) {
    const dialog = page.locator('dialog[open].popup').last();
    if (!await dialog.count()) return;
    if (pass === 0) await page.screenshot({ path:path.join(evidence,`${viewportName}-host-popup.png`), fullPage:true });
    const text = (await dialog.innerText().catch(() => '')).replace(/\s+/g,' ').trim().slice(0,260);
    const buttons = dialog.locator('button:visible');
    const labels = await buttons.allTextContents();
    run.notes.push(`宿主弹窗：${text || '(无文字)'}；按钮=${labels.map(x=>x.trim()).filter(Boolean).join('|') || '(无按钮文字)'}`);
    let target = -1;
    for (let i = 0; i < labels.length; i++) {
      if (/关闭|close|确定|ok|知道|got it|稍后|later|取消|cancel|继续|continue|跳过|skip/i.test(labels[i])) { target = i; break; }
    }
    if (target < 0 && labels.length) target = labels.length - 1;
    if (target >= 0) {
      try { await buttons.nth(target).click({ timeout:3000 }); await page.waitForTimeout(200); continue; } catch {}
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    if (await dialog.count()) throw new Error('无法通过真实点击或 Escape 关闭 SillyTavern 宿主弹窗');
  }
}

async function rect(locator) {
  return locator.evaluate(el => { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; }).catch(()=>null);
}
function overlaps(a,b) {
  if (!a || !b) return false;
  return !(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y);
}
async function visibleWithin(locator, container) {
  const a = await rect(locator), b = await rect(container);
  if (!a || !b) return false;
  return a.x >= b.x - 2 && a.right <= b.right + 2 && a.y >= b.y - 2 && a.bottom <= b.bottom + 2;
}

for (const [name,width,height] of viewports) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const run = { name, width, height, apps: {}, shell: {}, modeSwitch: {}, notes: [] };
  page.on('pageerror', error => report.pageErrors.push({ viewport:name, text:String(error) }));
  page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push({ viewport:name, text:msg.text() }); });
  page.on('response', response => {
    if (response.status() >= 400) report.networkFailures.push({ viewport:name, status:response.status(), url:response.url() });
  });
  await page.goto(process.env.ST_URL, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(4500);
  await dismissHostPopups(page, run, name);

  const launcher = page.locator('#world-phone-launcher');
  run.shell.launcher = await launcher.count() > 0;
  if (!run.shell.launcher) {
    run.notes.push('手机入口未出现。');
    await page.screenshot({ path:path.join(evidence,`${name}-no-launcher.png`), fullPage:true });
    report.runs.push(run); await context.close(); continue;
  }
  await launcher.click({ timeout:10000 });
  await page.waitForTimeout(350);
  const unlock = page.locator('#world-phone-stage [data-unlock]');
  if (await unlock.count()) { try { await unlock.click({ timeout:3000 }); await page.waitForTimeout(250); } catch {} }

  const stage = page.locator('#world-phone-stage');
  const glass = page.locator('#world-phone-stage .wp-screen-glass');
  run.shell.stageVisible = await stage.count() > 0 && await stage.evaluate(el => !el.hidden && el.classList.contains('is-open'));
  run.shell.zIndex = await stage.evaluate(el => getComputedStyle(el).zIndex).catch(()=>null);
  run.shell.bounds = await glass.evaluate(el => {
    const r=el.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight};
  }).catch(()=>null);
  run.shell.noHorizontalOverflow = run.shell.bounds ? run.shell.bounds.scrollWidth <= run.shell.bounds.clientWidth + 2 : false;

  for (const app of sequence) {
    const entry = page.locator(`#world-phone-stage .wp-app[data-app="${app}"]`).first();
    if (!await entry.count()) { run.apps[app] = { entry:false, status:'入口不存在或当前环境未提供' }; continue; }
    const appResult = { entry:true, opened:false, overflow:false, headerOverlap:false, actions:[], residues:[], unverified:[] };
    try {
      await entry.click({ timeout:5000 });
      await page.waitForTimeout(180);
      const root = page.locator('#world-phone-stage .wp-native-app').last();
      appResult.opened = await root.count() > 0;
      appResult.overflow = await glass.evaluate(el => el.scrollWidth > el.clientWidth + 2).catch(()=>false);
      const statusRect = await rect(page.locator('#world-phone-stage .wp-statusbar'));
      const headerRect = await rect(page.locator('#world-phone-stage .wp-native-app .wp-app-header').first());
      appResult.headerOverlap = overlaps(statusRect, headerRect);
      const currentGame = await page.locator('#world-phone-stage [data-phone-game-app]').getAttribute('data-phone-game-app').catch(()=>null);
      if (currentGame && currentGame !== app && !(app === 'messages' || app === 'phone')) appResult.residues.push(`残留 data-phone-game-app=${currentGame}`);

      if (app === 'wechat') {
        const thread = page.locator('#world-phone-stage .wpg-chat-list [data-pg-chat]').first();
        if (await thread.count()) {
          await thread.click(); await page.waitForTimeout(80); appResult.actions.push('聊天→thread');
          const back=page.locator('#world-phone-stage [data-pg-chats]').first(); if(await back.count()) { await back.click(); appResult.actions.push('thread→返回'); }
        } else appResult.unverified.push('聊天 thread：当前真实环境没有人物');
        const contacts = page.locator('#world-phone-stage [data-pg-view="relations"]').first();
        if (await contacts.count()) { await contacts.click(); await page.waitForTimeout(80); appResult.actions.push('通讯录'); }
        const contact = page.locator('#world-phone-stage [data-pg-contact]').first();
        if (await contact.count()) {
          await contact.click(); await page.waitForTimeout(80); appResult.actions.push('联系人详情');
          const back=page.locator('#world-phone-stage [data-pg-contact-back]').first(); if(await back.count()) { await back.click(); appResult.actions.push('详情→通讯录'); }
        } else appResult.unverified.push('联系人详情：当前真实环境没有人物');
        const discover = page.locator('#world-phone-stage [data-pg-view="moments"]').first();
        if (await discover.count()) { await discover.click(); await page.waitForTimeout(80); appResult.actions.push('发现'); }
        const moments = page.locator('#world-phone-stage [data-pg-open-moments]').first();
        if (await moments.count()) { await moments.click(); await page.waitForTimeout(80); appResult.actions.push('朋友圈'); }
        const backMoments = page.locator('#world-phone-stage [data-pg-discovery-back]').first();
        if (await backMoments.count()) { await backMoments.click(); appResult.actions.push('朋友圈→发现'); }
      }

      if (app === 'weibo') {
        const post = page.locator('#world-phone-stage [data-pg-post]').first();
        if (await post.count()) {
          await post.click(); await page.waitForTimeout(80); appResult.actions.push('微博详情');
          const back=page.locator('#world-phone-stage [data-pg-post-back]').first(); if(await back.count()) { await back.click(); appResult.actions.push('详情→返回'); }
        } else appResult.unverified.push('微博详情/评论/赞：当前真实环境没有帖子');
      }

      if (app === 'rednote') {
        const post = page.locator('#world-phone-stage [data-pg-post]').first();
        if (await post.count()) {
          await post.click(); await page.waitForTimeout(80); appResult.actions.push('笔记详情');
          appResult.actions.push(await page.locator('#world-phone-stage .echo-rn-detail').count() ? '独立小红书详情结构' : '错误：未进入独立详情');
          const generic = await page.locator('#world-phone-stage .echo-rn-detail .echo-post').count();
          if (generic) appResult.residues.push('小红书详情仍含通用 echo-post');
          const back=page.locator('#world-phone-stage [data-pg-post-back]').first(); if(await back.count()) { await back.click(); appResult.actions.push('详情→发现'); }
        } else appResult.unverified.push('笔记详情/评论/点赞/收藏：当前真实环境没有人物或帖子');
      }

      if (app === 'wallet') {
        appResult.actions.push(await page.locator('#world-phone-stage .wpg-wallet-card').count() ? '资产卡' : '错误：无资产卡');
        appResult.actions.push(await page.locator('#world-phone-stage .wpg-coffee').count() ? '咖啡店' : '错误：无咖啡店');
      }

      if (app === 'delivery') {
        const merchant = page.locator('#world-phone-stage [data-pg-delivery-merchant]').first();
        if (await merchant.count()) { await merchant.click(); await page.waitForTimeout(80); appResult.actions.push('首页→商家'); }
        const add = page.locator('#world-phone-stage [data-pg-delivery-add]').first();
        if (await add.count()) { await add.click(); await page.waitForTimeout(80); appResult.actions.push('商品→购物车'); }
        const checkout = page.locator('#world-phone-stage [data-pg-delivery-go="checkout"]').first();
        if (await checkout.count()) {
          await page.locator('#world-phone-stage .wpg-main').evaluate(el => { el.scrollTop = el.scrollHeight; });
          appResult.actions.push(await visibleWithin(checkout, glass) ? '购物车结算按钮滚动后可见' : '错误：结算按钮滚动后仍不可见');
          if (await checkout.isEnabled()) { await checkout.click(); await page.waitForTimeout(80); appResult.actions.push('购物车→结算'); }
          else appResult.unverified.push('结算/下单/订单详情：当前真实环境没有收礼角色或余额条件不足');
        }
      }

      if (app === 'music') {
        appResult.actions.push(await page.locator('#world-phone-stage .wp-music-player').count() ? '独立播放器' : '错误：播放器缺失');
        appResult.actions.push(await page.locator('#world-phone-stage .wp-music-controls').count() ? '播放控制' : '错误：播放控制缺失');
        appResult.actions.push(await page.locator('#world-phone-stage .wp-music-list').count() ? '歌曲列表' : '错误：歌曲列表缺失');
      }

      if (app === 'phone') {
        const keypad = page.locator('#world-phone-stage [data-gpc-tab="keypad"]').first();
        if (await keypad.count()) { await keypad.click(); await page.waitForTimeout(80); appResult.actions.push(await page.locator('#world-phone-stage .wpg-dialer').count() ? '拨号盘' : '错误：拨号盘缺失'); }
      }

      if (app === 'messages') {
        const create = page.locator('#world-phone-stage [data-gpc-new]').first();
        if (await create.count()) {
          await create.click(); await page.waitForTimeout(80); appResult.actions.push(await page.locator('#world-phone-stage .wpg-new-sms').count() ? '新短信页' : '错误：新短信页缺失');
          const draft = page.locator('#world-phone-stage [data-gpc-sms-draft]').first();
          if (await draft.count()) { await draft.focus(); appResult.actions.push('短信输入框可聚焦'); }
          const back = page.locator('#world-phone-stage [data-app-back]').first(); if(await back.count()) { await back.click(); appResult.actions.push('新短信→列表'); }
        }
      }

      if (app === 'appstore') {
        const detail = page.locator('#world-phone-stage [data-store-detail]').first();
        if (await detail.count()) {
          await detail.click(); await page.waitForTimeout(80); appResult.actions.push('应用详情');
          const back=page.locator('#world-phone-stage [data-store-detail-back]').first(); if(await back.count()) { await back.click(); appResult.actions.push('详情→商店'); }
        }
      }

      run.apps[app] = appResult;
      await page.screenshot({ path:path.join(evidence,`${name}-${app}.png`) });
      const back = page.locator('#world-phone-stage [data-app-back]').first();
      if (await back.count()) { await back.click(); await page.waitForTimeout(100); }
      else run.notes.push(`${app}: 未找到标准返回桌面按钮`);
    } catch (error) {
      appResult.status = String(error);
      run.apps[app] = appResult;
      const homeBack = page.locator('#world-phone-stage [data-app-back]').first();
      if (await homeBack.count()) { try { await homeBack.click(); await page.waitForTimeout(100); } catch {} }
    }
  }

  // Acceptance guard regression: change phone mode from the real Settings UI.
  const settings = page.locator('#world-phone-stage .wp-app[data-app="settings"]').first();
  if (await settings.count()) {
    await settings.click(); await page.waitForTimeout(80);
    const world = page.locator('#world-phone-stage [data-game-mode="world"]').first();
    const game = page.locator('#world-phone-stage [data-game-mode="game"]').first();
    if (await world.count()) { await world.click(); await page.waitForTimeout(100); run.modeSwitch.world = await page.locator('#world-phone-stage .wp-settings-app').count() > 0; }
    if (await game.count()) { await game.click(); await page.waitForTimeout(100); run.modeSwitch.game = await page.locator('#world-phone-stage .wp-settings-app').count() > 0; }
    const back = page.locator('#world-phone-stage [data-app-back]').first(); if(await back.count()) await back.click();
  }

  // Real close/reopen cycle; confirms the floating stage remains clickable.
  const close = page.locator('#world-phone-stage [data-stage-close]').first();
  if (await close.count()) { await close.click(); await page.waitForTimeout(250); await launcher.click({timeout:5000}); await page.waitForTimeout(180); run.shell.reopen = await stage.evaluate(el=>!el.hidden && el.classList.contains('is-open')).catch(()=>false); }
  await page.screenshot({ path:path.join(evidence,`${name}-final.png`) });
  report.runs.push(run);
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(evidence,'ui-audit.json'), JSON.stringify(report,null,2));

const productConsole = report.consoleErrors.filter(item => /Echo 手机|ReferenceError|TypeError|Uncaught|SyntaxError/i.test(item.text));
const failures = [];
for (const run of report.runs) {
  if (!run.shell.launcher || !run.shell.stageVisible || !run.shell.noHorizontalOverflow || run.shell.reopen === false) failures.push(`${run.name}: shell`);
  if (run.shell.zIndex !== '2147483647') failures.push(`${run.name}: z-index=${run.shell.zIndex}`);
  if (run.modeSwitch.world === false || run.modeSwitch.game === false) failures.push(`${run.name}: mode-switch`);
  for (const [app, result] of Object.entries(run.apps)) {
    if (!result.entry || !result.opened || result.overflow || result.headerOverlap || result.residues?.length || result.status) failures.push(`${run.name}:${app}`);
    if (result.actions?.some(action => action.startsWith('错误：'))) failures.push(`${run.name}:${app}:${result.actions.find(action=>action.startsWith('错误：'))}`);
  }
}
if (report.pageErrors.length || productConsole.length || failures.length) {
  console.error(JSON.stringify({ pageErrors:report.pageErrors, productConsole, failures }, null, 2));
  process.exitCode = 2;
}
