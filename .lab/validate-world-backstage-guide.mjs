import path from 'node:path';
import fs from 'node:fs/promises';
await import('./fix-world-backstage-hero.mjs');
const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const base = process.env.GUIDE_SITE_URL || 'http://127.0.0.1:4173';
const evidence = process.env.LAB_EVIDENCE_DIR || process.cwd();
const siteDir = process.env.GUIDE_SITE_DIR || '/tmp/world-backstage-guide-site';
const pageNames = ['index.html','start.html','now.html','people.html','memory.html','settings.html','help.html'];

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
  if (await page.locator('main.docs > .lesson.simple').count() !== 0) throw new Error('old giant settings screenshot still dominates the page');
  if (await page.locator('.settings-tab-visual').count() !== 0) throw new Error('old one-shot settings figures survived annotated atlas rebuild');

  const atlases = page.locator('.settings-atlas');
  const atlasCount = await atlases.count();
  if (atlasCount !== 4) throw new Error(`settings atlas count mismatch: ${atlasCount}`);

  const notes = page.locator('.setting-note');
  const markers = page.locator('.setting-marker');
  const noteCount = await notes.count();
  const markerCount = await markers.count();
  if (noteCount !== 31) throw new Error(`expected 31 settings explanations, got ${noteCount}`);
  if (markerCount !== noteCount) throw new Error(`settings pins/notes mismatch: pins=${markerCount}, notes=${noteCount}`);

  // The four sheets are very tall and intentionally lazy in production. Force them to load for QA
  // before measuring them, otherwise Chromium may leave lower-page images at naturalWidth 0.
  await page.locator('.settings-atlas-stage img').evaluateAll(images => {
    for (const img of images) {
      img.loading = 'eager';
      const src = img.getAttribute('src');
      if (src) img.src = src;
    }
  });
  await page.waitForFunction(() => [...document.querySelectorAll('.settings-atlas-stage img')].every(img => img.complete && img.naturalWidth > 0), null, { timeout: 20000 });

  const expectedMinimumHeights = [2200, 3100, 4700, 8500];
  const settingsImageInfo = [];
  for (let i = 0; i < 4; i += 1) {
    const image = atlases.nth(i).locator('.settings-atlas-stage img');
    const info = await image.evaluate(img => ({naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,complete:img.complete,src:img.getAttribute('src')}));
    if (!info.complete || info.naturalWidth < 700 || info.naturalHeight < expectedMinimumHeights[i]) {
      throw new Error(`full settings screenshot ${i + 1} missing/cropped: ${JSON.stringify(info)}`);
    }
    settingsImageInfo.push(info);
  }

  const injectionAtlas = page.locator('[data-settings-atlas="injection"]');
  const injectionScroll = injectionAtlas.locator('[data-settings-scroll]');
  await injectionAtlas.scrollIntoViewIfNeeded();
  await injectionScroll.evaluate(node => { node.scrollTop = 0; });
  const beforeScroll = await injectionScroll.evaluate(node => node.scrollTop);
  const lastInjectionNote = page.locator('#setting-note-injection-12');
  await lastInjectionNote.click();
  await page.waitForTimeout(700);
  const afterScroll = await injectionScroll.evaluate(node => node.scrollTop);
  if (afterScroll <= beforeScroll + 50) throw new Error(`settings note did not move screenshot: ${beforeScroll} -> ${afterScroll}`);
  if (!(await injectionAtlas.locator('[data-settings-note="injection-12"].setting-marker').evaluate(node => node.classList.contains('is-active')))) {
    throw new Error('matching settings pin did not highlight');
  }

  const snapSection = async (id, file) => {
    const section = page.locator(`#${id}`);
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(evidence,file),fullPage:false});
  };
  await snapSection('common','site-settings-atlas-common.png');
  await snapSection('connection','site-settings-atlas-connection.png');
  await snapSection('advanced','site-settings-atlas-advanced.png');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(220);
  await page.screenshot({path:path.join(evidence,'site-settings-guide-full.png'),fullPage:true});

  const mobile = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  await mobile.goto(`${base}/index.html`,{waitUntil:'networkidle'});
  const mobileArt = await mobile.locator('.hero-art').evaluate(img => ({naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight}));
  if (mobileArt.naturalWidth < 1500) throw new Error('mobile hero art is not HQ');
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 2) throw new Error(`mobile horizontal overflow: ${overflow}px`);
  await mobile.locator('.menu').click();
  if (!(await mobile.locator('.top nav').evaluate(el=>el.classList.contains('open')))) throw new Error('mobile menu did not open');
  await mobile.screenshot({path:path.join(evidence,'site-mobile-user-first.png'),fullPage:false});
  await mobile.goto(`${base}/settings.html`,{waitUntil:'networkidle'});
  const settingsOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (settingsOverflow > 2) throw new Error(`mobile settings horizontal overflow: ${settingsOverflow}px`);
  await mobile.locator('#common').scrollIntoViewIfNeeded();
  await mobile.screenshot({path:path.join(evidence,'site-settings-atlas-mobile.png'),fullPage:false});
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
    settingsAtlasCount:atlasCount,
    settingsNotes:noteCount,
    settingsPins:markerCount,
    settingsFullRealScreens:true,
    settingsImageInfo,
    settingsInteraction:true,
    oldSettingsHeroRemoved:true,
    oldSettingsFiguresRemoved:true,
    noFormalRepoLink:true,
    noDeveloperJargon:true,
    mobileMenu:true,
    mobileOverflow:false,
    mobileSettingsOverflow:false,
  },null,2));
} finally { await browser.close(); }
