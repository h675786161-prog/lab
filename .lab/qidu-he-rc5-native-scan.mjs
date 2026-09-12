import fs from 'node:fs/promises';
import path from 'node:path';

const CARD_PATH = process.env.CARD_PATH || 'fixtures/qidu-he-if/qidu-he-if.character.json';
const OUT = process.env.LAB_OUT || 'bench-evidence/qidu-he-rc5-native-st';
const ST_URL = process.env.ST_URL || 'http://127.0.0.1:8000/';
const CHROME_BIN = process.env.CHROME_BIN || '';
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || 'file:///tmp/qidu-rc5-native-browser/node_modules/playwright-core/index.mjs';

if (!CHROME_BIN) throw new Error('CHROME_BIN is missing');
await fs.mkdir(OUT, { recursive: true });

const card = JSON.parse(await fs.readFile(CARD_PATH, 'utf8'));
const data = card.data;
if (data.character_version !== '0.3.0-rc5') throw new Error(`expected rc5 candidate, got ${data.character_version}`);
if (!data.post_history_instructions?.includes('【用户主权硬门槛】')) throw new Error('missing user sovereignty guard');
if (!data.post_history_instructions?.includes('【当前回合连续性与身份精确性】')) throw new Error('missing continuity/identity guard');
if (data.character_book?.entries?.length !== 31) throw new Error(`expected 31 entries, got ${data.character_book?.entries?.length}`);
if (data.character_book.entries.filter(e => e.extensions?.prevent_recursion === true).length !== 31) throw new Error('candidate does not contain 31/31 prevent_recursion flags');
const milaEntry = data.character_book.entries.find(e => e.name === '米菈');
if (!milaEntry?.content?.includes('身份名锚点：自我介绍时姓名使用“米菈”')) throw new Error('米菈 exact-name anchor missing before ST import');

const cases = [
  {
    id: 'qianxue_ballet_room',
    user: '午后我去学园区一间芭蕾舞蹈室给朋友送落下的水杯。排练还没结束，我站在门边等，不主动叫任何人的名字。继续眼前普通场景。',
    target: '源千雪',
    injectionNeedle: '源千雪：',
  },
  {
    id: 'mila_fountain_bass',
    user: '傍晚我路过中央城区喷泉广场，听见一小段明显还不算熟练、但很认真在跟节拍的贝斯。我停下来听一会儿，不认识演奏的人。继续眼前普通场景。',
    target: '米菈',
    injectionNeedle: '米菈：',
  },
  {
    id: 'ash_police_case',
    user: '下午我去警局补一份案件材料，等叫号时听见旁边有人对案情里的矛盾点冷嘲热讽。我没见过他，只是顺着声音看过去。继续眼前普通场景。',
    target: '亚修',
    injectionNeedle: '亚修：',
  },
  {
    id: 'control_coffee',
    user: '下午我一个人去一家普通咖啡店，靠窗坐十分钟，看街上的车和行人。今天没约任何人，也没有特别要找谁。继续这一小段普通时间。',
    target: null,
    injectionNeedle: null,
  },
];

const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ headless: true, executablePath: CHROME_BIN, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));

async function snapshotDialogs() {
  return page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map(d => ({
    id: d.getAttribute('data-id') || '',
    text: (d.innerText || d.textContent || '').trim().slice(0, 4000),
  })));
}

async function acceptLore() {
  const dialogs = page.locator('dialog[open]');
  for (let i = (await dialogs.count()) - 1; i >= 0; i--) {
    const d = dialogs.nth(i);
    const text = await d.innerText().catch(() => '');
    if (!text.includes('embedded World/Lorebook')) continue;
    const id = await d.getAttribute('data-id');
    const yes = d.locator('[role="button"][data-result="1"]').first();
    const geom = await yes.evaluate(el => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { x, y, w: r.width, h: r.height, hitResult: hit?.getAttribute?.('data-result') || null, hitIsSelf: hit === el, hitWithin: !!hit && el.contains(hit) };
    });
    if (!(geom.w > 0 && geom.h > 0 && (geom.hitIsSelf || geom.hitWithin || geom.hitResult === '1'))) {
      throw new Error(`lore Yes is not hit-testable: ${JSON.stringify(geom)}`);
    }
    await page.mouse.click(geom.x, geom.y);
    if (id) await page.locator(`dialog[data-id="${id}"]`).waitFor({ state: 'hidden', timeout: 10000 });
    return true;
  }
  return false;
}

await page.goto(ST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
const raw = await fs.readFile(CARD_PATH, 'utf8');
const imported = await page.evaluate(async rawCard => {
  const f = new FormData();
  f.set('file_type', 'json');
  f.set('avatar', new Blob([rawCard], { type: 'application/json' }), 'qidu-he-rc5-native.character.json');
  const r = await fetch('/api/characters/import', { method: 'POST', body: f });
  return { ok: r.ok, status: r.status, text: (await r.text()).slice(0, 500) };
}, raw);
if (!imported.ok) throw new Error(`card import failed: ${JSON.stringify(imported)}`);

await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3500);
for (let guard = 0; guard < 4; guard++) {
  const visible = page.locator('dialog[open]:visible');
  const n = await visible.count();
  if (!n) break;
  const d = visible.nth(n - 1);
  const text = await d.innerText().catch(() => '');
  if (!text.includes('Welcome to SillyTavern')) break;
  const cancel = d.getByRole('button', { name: /^(cancel|取消)$/i }).first();
  if (await cancel.isVisible().catch(() => false)) await cancel.click(); else await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
}

const chid = await page.evaluate(async () => {
  const st = await import('/script.js');
  await st.getCharacters();
  if (typeof st.printCharactersDebounced === 'function') st.printCharactersDebounced();
  await new Promise(r => setTimeout(r, 700));
  return (st.characters || []).findIndex(c => c?.data?.character_version === '0.3.0-rc5');
});
if (chid < 0) throw new Error('rc5 character not loaded');

await page.locator('#rightNavDrawerIcon').click();
await page.locator('#right-nav-panel').waitFor({ state: 'visible', timeout: 10000 });
const cardEl = page.locator(`#rm_print_characters_block .character_select[data-chid="${chid}"]`).first();
await cardEl.waitFor({ state: 'visible', timeout: 15000 });
await cardEl.click();
await page.waitForFunction(async expected => {
  const st = await import('/script.js');
  return String(st.this_chid) === String(expected) && !!st.getCurrentChatId?.();
}, chid, { timeout: 15000 });
await page.waitForTimeout(900);

if (!(await acceptLore())) {
  const menu = page.locator('#char-management-dropdown');
  await menu.waitFor({ state: 'visible', timeout: 10000 });
  await menu.selectOption({ label: 'Import Card Lore' });
  await page.waitForTimeout(500);
  if (!(await acceptLore())) throw new Error(`No embedded lore confirmation. dialogs=${JSON.stringify(await snapshotDialogs())}`);
}

await page.waitForFunction(async world => {
  const wi = await import('/scripts/world-info.js');
  return (wi.world_names || []).includes(world);
}, data.extensions.world, { timeout: 15000 });
await page.waitForTimeout(1200);

const scans = [];
for (const test of cases) {
  const scan = await page.evaluate(async text => {
    const wi = await import('/scripts/world-info.js');
    const defaults = { trigger: 'normal', personaDescription: '', characterDescription: '', characterPersonality: '', characterDepthPrompt: '', scenario: '', creatorNotes: '' };
    const r = await wi.getWorldInfoPrompt([text], 200000, true, defaults);
    const joined = [r.worldInfoString || '', r.worldInfoBefore || '', r.worldInfoAfter || '', JSON.stringify(r.worldInfoDepth || []), JSON.stringify(r.outletEntries || {})].join('\n');
    return { joined, chars: joined.length };
  }, test.user);
  scans.push({ ...test, injection: scan.joined, injectionChars: scan.chars, injectionHit: test.injectionNeedle ? scan.joined.includes(test.injectionNeedle) : null });
}

const stState = await page.evaluate(async () => {
  const st = await import('/script.js');
  const wi = await import('/scripts/world-info.js');
  const sorted = await wi.getSortedEntries();
  return {
    thisChid: st.this_chid,
    chat: st.getCurrentChatId?.() || null,
    worldNames: [...(wi.world_names || [])],
    sortedCount: sorted.length,
    preventRecursionCount: sorted.filter(e => e.preventRecursion === true).length,
  };
});

await page.screenshot({ path: path.join(OUT, 'st-native-scan.png'), fullPage: true });
await browser.close();

const scanEvidence = {
  imported,
  chid,
  cardVersion: data.character_version,
  world: data.extensions.world,
  stState,
  pageErrors,
  guards: {
    userSovereignty: data.post_history_instructions.includes('【用户主权硬门槛】'),
    continuityIdentity: data.post_history_instructions.includes('【当前回合连续性与身份精确性】'),
    milaExactName: milaEntry.content.includes('身份名锚点：自我介绍时姓名使用“米菈”'),
  },
  scans: scans.map(x => ({
    id: x.id,
    user: x.user,
    target: x.target,
    injectionChars: x.injectionChars,
    injectionHit: x.injectionHit,
    injection: x.injection,
  })),
};
await fs.writeFile(path.join(OUT, 'st-native-injections.json'), JSON.stringify(scanEvidence, null, 2));

if (pageErrors.length) throw new Error(`ST page errors: ${JSON.stringify(pageErrors)}`);
if (stState.sortedCount !== 31 || stState.preventRecursionCount !== 31 || !stState.worldNames.includes(data.extensions.world)) {
  throw new Error(`ST world state invalid: ${JSON.stringify(stState)}`);
}
for (const s of scans.filter(x => x.target)) {
  if (!s.injectionHit) throw new Error(`native ST scanner missed ${s.target} for ${s.id}`);
  for (const other of ['源千雪：', '米菈：', '亚修：']) {
    if (other !== `${s.target}：` && s.injection.includes(other)) throw new Error(`${s.id} cross-injected unrelated detail ${other}`);
  }
}
const controlScan = scans.find(x => x.id === 'control_coffee');
for (const name of ['源千雪：', '米菈：', '亚修：']) {
  if (controlScan.injection.includes(name)) throw new Error(`control scan unexpectedly injected ${name}`);
}
const milaScan = scans.find(x => x.id === 'mila_fountain_bass');
if (!milaScan.injection.includes('身份名锚点：自我介绍时姓名使用“米菈”')) throw new Error('native ST injection lost 米菈 exact-name anchor');

console.log('RC5 NATIVE ST PASS', JSON.stringify({ stState, injectionChars: Object.fromEntries(scans.map(s => [s.id, s.injectionChars])) }));
