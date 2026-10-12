import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ST_URL = process.env.ST_URL || 'http://127.0.0.1:8041/';
const EVIDENCE = process.env.EVIDENCE;
const EXPECTED_MAX = 8192;
const TARGET_COUNT = 7;
const report = {
  stUrl: ST_URL,
  expectedMaxTokens: EXPECTED_MAX,
  targetCount: TARGET_COUNT,
  yellowmiSha: fs.readFileSync(path.join(EVIDENCE, 'yellowmi-sha.txt'), 'utf8').trim(),
  sillyTavernSha: fs.readFileSync(path.join(EVIDENCE, 'sillytavern-sha.txt'), 'utf8').trim(),
  checks: [], requests: [], pageErrors: [], consoleErrors: [], blockers: [],
};
const check = (ok, name, extra={}) => report.checks.push({ok:Boolean(ok), name, ...extra});
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true, args:['--no-sandbox','--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport:{width:390,height:844} });
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on('pageerror', e => report.pageErrors.push(String(e?.stack || e)));
page.on('console', m => { if (m.type()==='error') report.consoleErrors.push(m.text()); });
page.on('request', req => {
  if (req.method() !== 'POST' || !/chat-completions\/generate/.test(req.url())) return;
  let body = null;
  try { body = req.postDataJSON(); } catch { try { body = JSON.parse(req.postData() || '{}'); } catch { body = {raw:req.postData()}; } }
  report.requests.push({url:req.url(), body});
});
const sleep = ms => page.waitForTimeout(ms);

async function dismissHostPopups() {
  for (let i=0;i<8;i++) {
    const dialog = page.locator('dialog[open].popup').last();
    if (!await dialog.count()) return;
    const buttons = dialog.locator('button:visible');
    const labels = await buttons.allTextContents();
    let idx = labels.findIndex(x => /关闭|close|确定|ok|知道|got it|稍后|later|取消|cancel|继续|continue|跳过|skip/i.test(x));
    if (idx < 0 && labels.length) idx = labels.length - 1;
    if (idx >= 0) { try { await buttons.nth(idx).click(); await sleep(150); continue; } catch {} }
    await page.keyboard.press('Escape'); await sleep(120);
  }
}

async function selectSeraphina() {
  const info = await page.evaluate(async () => {
    const t = await import('/script.js');
    const idx = (t.characters || []).findIndex(c => /seraphina/i.test(String(c?.name || '')));
    return {idx,names:(t.characters||[]).map(c=>c?.name||'')};
  });
  check(info.idx >= 0, 'bundled Seraphina exists', {names:info.names});
  if (info.idx < 0) throw new Error('Seraphina missing');
  const drawer = page.locator('#right-nav-panel');
  if (!await drawer.isVisible().catch(()=>false)) await page.locator('#rightNavDrawerIcon').click().catch(()=>{});
  await sleep(250);
  const target = page.locator(`#rm_print_characters_block .character_select[chid="${info.idx}"]`).first();
  let activation = 'host-selectCharacterById';
  if (await target.count() && await target.isVisible().catch(()=>false)) {
    activation = 'visible-character-card-click';
    await target.click();
  } else {
    await page.evaluate(async idx => {
      const ctx = globalThis.SillyTavern?.getContext?.();
      if (typeof ctx?.selectCharacterById !== 'function') throw new Error('SillyTavern selectCharacterById unavailable');
      await ctx.selectCharacterById(idx);
    }, info.idx);
  }
  report.characterActivation = activation;
  await page.waitForFunction(() => /seraphina/i.test(String(globalThis.SillyTavern?.getContext?.()?.characters?.[globalThis.SillyTavern?.getContext?.()?.characterId]?.name || '')), null, {timeout:15000});
  check(true, 'Seraphina activated through real SillyTavern host', {activation});
  await sleep(500);
}

async function home() {
  for (let i=0;i<5;i++) {
    const back = page.locator('#world-phone-stage [data-app-back]').first();
    if (!await back.count()) break;
    await back.click().catch(()=>{}); await sleep(120);
  }
}
async function openPhone() {
  await page.waitForSelector('#world-phone-launcher', {timeout:30000});
  await page.locator('#world-phone-launcher').click(); await sleep(250);
  const unlock = page.locator('#world-phone-stage [data-unlock]');
  if (await unlock.count()) { await unlock.click().catch(()=>{}); await sleep(150); }
}
async function openApp(name) {
  await home();
  await page.locator(`#world-phone-stage .wp-app[data-app="${name}"]`).first().click();
  await sleep(180);
}
async function waitPhoneIdle(timeout=120000) {
  await sleep(200);
  await page.waitForFunction(async () => {
    const m = await import('/scripts/extensions/third-party/echo-phone/src/phone-game-ai.js?feed-control-qa');
    return !m.isPhoneGameGenerating();
  }, null, {timeout}).catch(()=>{});
  await sleep(300);
}

try {
  await page.goto(ST_URL, {waitUntil:'domcontentloaded', timeout:60000});
  await sleep(4500); await dismissHostPopups();
  await selectSeraphina();
  const host = await page.evaluate(() => {
    const ctx=globalThis.SillyTavern?.getContext?.();
    return {character:ctx?.characters?.[ctx?.characterId]?.name || '', generateRawType:typeof ctx?.generateRaw, generateRawLength:ctx?.generateRaw?.length, configuredMax:ctx?.chatCompletionSettings?.openai_max_tokens};
  });
  check(host.character === 'Seraphina', 'real character selected', host);
  check(host.generateRawType === 'function', 'real host exposes generateRaw', host);
  check(host.generateRawLength <= 1, 'real host uses object-style generateRaw signature', host);
  check(Number(host.configuredMax) === EXPECTED_MAX, 'real host output setting is 8192', host);

  await openPhone();
  await openApp('settings');
  const gameMode = page.locator('#world-phone-stage [data-game-mode="game"]');
  if (await gameMode.count()) { await gameMode.click(); await sleep(180); }
  await openApp('rednote');

  const countInput = page.locator('#world-phone-stage [data-pg-feed-count="rednote"]').first();
  check(await countInput.count() === 1, 'RedNote target-count control exists');
  if (!await countInput.count()) throw new Error('RedNote target-count control missing');
  await countInput.fill(String(TARGET_COUNT));
  await countInput.dispatchEvent('input');
  check(await countInput.inputValue() === String(TARGET_COUNT), 'RedNote target-count control accepts 7');

  const beforeRequests = report.requests.length;
  const refresh = page.locator('#world-phone-stage [data-pg-refresh="rednote"]').first();
  check(await refresh.count() === 1, 'RedNote refresh button exists');
  await refresh.click();
  for (let i=0;i<80 && report.requests.length===beforeRequests;i++) await sleep(250);
  const request = report.requests.slice(beforeRequests).find(x => /chat-completions\/generate/.test(x.url));
  check(Boolean(request), 'real RedNote click reached SillyTavern chat-completions backend');
  if (request) {
    const serialized = JSON.stringify(request.body || {});
    check(Number(request.body?.max_tokens) === EXPECTED_MAX, 'backend request follows SillyTavern 8192 output setting instead of Echo 6144', {actualMaxTokens:request.body?.max_tokens});
    check(serialized.includes(`本次目标生成${TARGET_COUNT}条新帖`), 'backend request prompt carries target count 7');
    check(Number(request.body?.max_tokens) !== 6144, 'backend request is not pinned to 6144', {actualMaxTokens:request.body?.max_tokens});
  }

  await waitPhoneIdle();
  const state = await page.evaluate(async () => {
    const m = await import('/scripts/extensions/third-party/echo-phone/src/phone-game.js?feed-control-qa');
    const a = await import('/scripts/extensions/third-party/echo-phone/src/phone-game-ai.js?feed-control-qa');
    const s = m.readPhoneGameState(m.capturePhoneGameScope());
    return {postCount:s.posts.filter(p=>p.platform==='rednote').length, status:a.phoneGameGenerationStatus()};
  });
  report.rednoteState = state;
  check(state.postCount >= 0, 'RedNote state remained readable after real request', state);
  await page.screenshot({path:path.join(EVIDENCE,'yellowmi-feed-control-390.png'), fullPage:true});
} catch (error) {
  report.blockers.push(String(error?.stack || error));
} finally {
  report.passed = report.checks.length > 0 && report.checks.every(x=>x.ok) && report.blockers.length===0;
  fs.writeFileSync(path.join(EVIDENCE,'feed-control-report.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
if (!report.passed) process.exitCode = 1;
