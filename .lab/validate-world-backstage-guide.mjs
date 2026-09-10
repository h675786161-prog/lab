import path from 'node:path';
import fs from 'node:fs/promises';
await import('./fix-world-backstage-hero.mjs');
const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const base = process.env.GUIDE_SITE_URL || 'http://127.0.0.1:4173';
const evidence = process.env.LAB_EVIDENCE_DIR || process.cwd();
const siteDir = process.env.GUIDE_SITE_DIR || '/tmp/world-backstage-guide-site';
const pageNames = ['index.html','start.html','now.html','people.html','memory.html','settings.html','help.html'];

// Static checks first: the public guide should read like a user guide, not leak repo/dev language,
// and all local page/anchor links must actually resolve.
for (const name of pageNames) {
  const html = await fs.readFile(path.join(siteDir,name),'utf8');
  if (/github\.com\/h675786161-prog\/world-backstage/i.test(html)) throw new Error(`${name}: formal repo link leaked into public guide`);
  if (/\b(fixture|schema|runtime|commit)\b/i.test(html)) throw new Error(`${name}: developer jargon leaked into public guide`);
  for (const m of html.matchAll(/href="([^"#]+\.html)(#[^"]+)?"/g)) {
    const targetFile = path.join(siteDir,m[1]);
    await fs.access(targetFile);
    if (m[2]) {
      const target = await fs.readFile(targetFile,'utf8');
      const id = m[2].slice(1).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      if (!(new RegExp(`id="${id}"`)).test(target)) throw new Error(`${name}: broken anchor ${m[0]}`);
    }
  }
}

const browser = await chromium.launch({ headless:true, executablePath:process.env.LAB_CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport:{width:1440,height:960}, deviceScaleFactor:1 });
  await page.goto(`${base}/index.html`, { waitUntil:'networkidle', timeout:30000 });
  const hero = page.locator('.hero');
  await hero.waitFor({state:'visible'});
  const art = page.locator('.hero-art');
  await art.waitFor({state:'visible'});
  const artInfo = await art.evaluate(img => ({naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,complete:img.complete}));
  if (!artInfo.complete || artInfo.naturalWidth < 1500 || artInfo.naturalHeight < 800) throw new Error(`hero image is not HQ: ${JSON.stringify(artInfo)}`);
  const heroBox = await hero.boundingBox();
  const copyBox = await page.locator('.hero-copy').boundingBox();
  const cardBox = await page.locator('.hero-card').boundingBox();
  if (!heroBox || !copyBox || !cardBox) throw new Error('hero layout boxes missing');
  if (copyBox.x > heroBox.x + heroBox.width * .52) throw new Error(`hero copy is not on left: ${JSON.stringify(copyBox)}`);
  if (cardBox.x < heroBox.x + heroBox.width * .45) throw new Error(`hero state card is not on right: ${JSON.stringify(cardBox)}`);
  if (await page.locator('#pick .need-card').count() !== 6) throw new Error('homepage symptom routes missing');
  if (!(await page.locator('.story-demo').count())) throw new Error('homepage story explanation missing');
  await page.waitForTimeout(250);
  await page.screenshot({path:path.join(evidence,'site-home-user-first.png'),fullPage:false});

  await page.locator('a[href="start.html"]').first().click();
  await page.waitForURL(/start\.html$/,{timeout:10000});
  if (!(await page.locator('.lesson').count())) throw new Error('start page lesson missing');
  if (!(await page.locator('.dont-do').count())) throw new Error('start page no-do guidance missing');

  await page.goto(`${base}/now.html`,{waitUntil:'networkidle'});
  const hot = page.locator('.hotspot').first();
  await hot.click();
  if (!(await page.locator('.tip').isVisible())) throw new Error('hotspot tip did not open');
  await page.screenshot({path:path.join(evidence,'site-now-tip-user-first.png'),fullPage:false});

  await page.goto(`${base}/people.html`,{waitUntil:'networkidle'});
  const detail = page.locator('.detail-story');
  const detailImage = detail.locator('img');
  await detail.scrollIntoViewIfNeeded();
  const detailBox = await detail.boundingBox();
  const detailImageBox = await detailImage.boundingBox();
  if (!detailBox || !detailImageBox) throw new Error('people detail layout boxes missing');
  if (detailBox.width < 900) throw new Error(`people detail section too narrow: ${JSON.stringify(detailBox)}`);
  if (detailImageBox.width < 420) throw new Error(`people detail image squeezed: ${JSON.stringify(detailImageBox)}`);
  if (detailImageBox.width / detailBox.width < .38) throw new Error(`people detail image has too little visual weight: section=${detailBox.width}, image=${detailImageBox.width}`);
  await page.screenshot({path:path.join(evidence,'site-people-roomy.png'),fullPage:false});

  await page.goto(`${base}/settings.html`,{waitUntil:'networkidle'});
  const settingsText = await page.locator('.docs-head h1').innerText();
  if (!settingsText.includes('一个都不用改')) throw new Error('settings page does not reassure first-time users');
  if (await page.locator('.settings-chapter').count() !== 4) throw new Error('settings guide chapters missing');
  await page.screenshot({path:path.join(evidence,'site-settings-guide-full.png'),fullPage:true});
  const common = page.locator('#common');
  await common.scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  await page.screenshot({path:path.join(evidence,'site-settings-guide-main.png'),fullPage:false});

  const mobile = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  await mobile.goto(`${base}/index.html`,{waitUntil:'networkidle'});
  const mobileArt = await mobile.locator('.hero-art').evaluate(img => ({naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight}));
  if (mobileArt.naturalWidth < 1500) throw new Error('mobile hero art is not HQ');
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 2) throw new Error(`mobile horizontal overflow: ${overflow}px`);
  await mobile.locator('.menu').click();
  if (!(await mobile.locator('.top nav').evaluate(el=>el.classList.contains('open')))) throw new Error('mobile menu did not open');
  await mobile.screenshot({path:path.join(evidence,'site-mobile-user-first.png'),fullPage:false});
  await mobile.close();

  await fs.writeFile(path.join(evidence,'site-validation.json'),JSON.stringify({
    ok:true,
    userFirstRoutes:6,
    storyDemo:true,
    heroRendered:artInfo,
    heroHQ:true,
    crossPage:true,
    anchors:true,
    hotspot:true,
    peopleDetail:true,
    peopleDetailWidth:detailImageBox.width,
    firstUseGuidance:true,
    settingsReassurance:true,
    settingsGuideChapters:4,
    settingsScreenshots:true,
    noFormalRepoLink:true,
    noDeveloperJargon:true,
    mobileMenu:true,
    mobileOverflow:false,
  },null,2));
} finally { await browser.close(); }
