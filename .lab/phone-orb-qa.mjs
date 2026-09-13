import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=await import(process.env.WP_PLAYWRIGHT_CORE_ENTRY || 'playwright-core');
const output=process.env.WP_SCREENSHOT_DIR || process.cwd();fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.WP_BROWSER_EXECUTABLE || '/usr/bin/google-chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:980},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>localStorage.setItem('world-backstage:mama-note:seen','1'));
try {
  await page.goto(process.env.WP_TAVERN_URL || 'http://127.0.0.1:8027/');
  await page.waitForSelector('#world-phone-launcher');
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog'))try{d.close();}catch{}});
  await page.evaluate(() => {
  const dismissWelcome = () => document.querySelectorAll('dialog.popup[open]').forEach(dialog => dialog.close());
  dismissWelcome();
  new MutationObserver(dismissWelcome).observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['open']});
});
  await page.locator('#preloader').waitFor({state:'hidden',timeout:60000});
  await page.waitForSelector('#world-backstage-root .wb-world-orb');
  const palette=async()=>page.evaluate(()=>({phone:getComputedStyle(document.querySelector('#world-phone-launcher')).getPropertyValue('--phone-orb-accent').trim(),world:getComputedStyle(document.querySelector('#world-backstage-root')).getPropertyValue('--wb-accent').trim()}));
  const original=await page.locator('#world-backstage-root').getAttribute('class');
  const shot=async name=>{
    await page.waitForTimeout(250);
    const value=await palette();assert.equal(value.phone,value.world);
    const a=await page.locator('#world-phone-launcher').boundingBox();const b=await page.locator('.wb-world-orb').boundingBox();
    const x=Math.max(0,Math.min(a.x,b.x)-25),y=Math.max(0,Math.min(a.y,b.y)-25);
    await page.screenshot({path:path.join(output,name+'.png'),clip:{x,y,width:Math.min(1440-x,Math.max(a.x+a.width,b.x+b.width)-x+25),height:Math.min(980-y,Math.max(a.y+a.height,b.y+b.height)-y+25)}});
  };
  await page.locator('#world-backstage-root').evaluate(n=>{n.classList.remove('theme-night');n.classList.add('theme-day');});await shot('paired-orbs-day');
  await page.locator('#world-backstage-root').evaluate(n=>{n.classList.remove('theme-day');n.classList.add('theme-night');});await shot('paired-orbs-night');
  await page.locator('#world-backstage-root').evaluate((n,c)=>n.className=c,original);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.lqwp-orb-orbit.is-one').evaluate(n=>getComputedStyle(n).animationName),'none');
  await page.locator('#world-phone-launcher').click();await page.waitForSelector('#world-phone-stage.is-open');
  assert.equal(await page.locator('.wb-world-orb').isVisible(),false);
  await page.keyboard.press('Escape');await page.waitForTimeout(250);
  assert.equal(await page.locator('.wb-world-orb').isVisible(),true);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'orb-report.json'),JSON.stringify({passed:true,checks:['palette follows real Backstage root in day and night','reduced motion','orb yields taps to open phone and returns on close'],pageErrors:errors},null,2));
  console.log('PASS: paired orbital launchers, real theme sync, reduced motion, window coexistence');
} catch(error) {await page.screenshot({path:path.join(output,'orb-failure.png')}).catch(()=>{});throw error;} finally {await browser.close();}
