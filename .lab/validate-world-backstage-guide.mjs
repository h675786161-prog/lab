import path from 'node:path';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const base = process.env.GUIDE_SITE_URL || 'http://127.0.0.1:4173';
const evidence = process.env.LAB_EVIDENCE_DIR || process.cwd();
const browser = await chromium.launch({ headless:true, executablePath:process.env.LAB_CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport:{width:1440,height:960}, deviceScaleFactor:1 });
  await page.goto(`${base}/index.html`, { waitUntil:'networkidle', timeout:30000 });
  const hero = page.locator('.hero');
  await hero.waitFor({state:'visible'});
  const bg = await hero.evaluate(el => getComputedStyle(el).backgroundImage);
  if (!bg.includes('hero.webp')) throw new Error(`hero art missing: ${bg}`);
  await page.screenshot({path:path.join(evidence,'site-home-polished.png'),fullPage:false});
  await page.locator('a[href="start.html"]').first().click();
  await page.waitForURL(/start\.html$/,{timeout:10000});
  if (!(await page.locator('.lesson').count())) throw new Error('start page lesson missing');
  await page.goto(`${base}/now.html`,{waitUntil:'networkidle'});
  const hot = page.locator('.hotspot').first();
  await hot.click();
  if (!(await page.locator('.tip').isVisible())) throw new Error('hotspot tip did not open');
  await page.screenshot({path:path.join(evidence,'site-now-tip-polished.png'),fullPage:false});

  const mobile = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  await mobile.goto(`${base}/index.html`,{waitUntil:'networkidle'});
  await mobile.locator('.menu').click();
  if (!(await mobile.locator('.top nav').evaluate(el=>el.classList.contains('open')))) throw new Error('mobile menu did not open');
  await mobile.screenshot({path:path.join(evidence,'site-mobile-polished.png'),fullPage:false});
  await mobile.close();
  await fs.writeFile(path.join(evidence,'site-validation.json'),JSON.stringify({ok:true,hero:true,crossPage:true,hotspot:true,mobileMenu:true},null,2));
} finally { await browser.close(); }
