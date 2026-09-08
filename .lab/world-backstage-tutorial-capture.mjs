import fs from 'node:fs/promises';
import path from 'node:path';

const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.LAB_CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  deviceScaleFactor: 1.25,
});
const out = process.env.LAB_EVIDENCE_DIR;
const report = { populated: {}, shots: [], checks: {} };

async function dismissHostPopups() {
  await page.evaluate(() => {
    document.querySelectorAll('dialog.popup, .popup.wider_dialogue_popup').forEach(node => node.remove());
  }).catch(() => {});
}

async function shot(name, locator) {
  await dismissHostPopups();
  await locator.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(450);
  await locator.screenshot({
    path: path.join(out, `${name}.png`),
    animations: 'disabled',
    timeout: 20_000,
  });
  report.shots.push(`${name}.png`);
}

async function clickFirstVisible(locator) {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const node = locator.nth(i);
    if (await node.isVisible().catch(() => false)) {
      await node.click({ force: true });
      return true;
    }
  }
  return false;
}

try {
  await fs.mkdir(out, { recursive: true });
  await page.goto(process.env.LAB_ST_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => Boolean(globalThis.SillyTavern?.getContext), null, { timeout: 30_000 });
  await page.waitForSelector('#world-backstage-root', { timeout: 30_000 });

  const controls = page.locator('button, .menu_button, input[type="button"], input[type="submit"]');
  for (let i = 0; i < await controls.count(); i += 1) {
    const node = controls.nth(i);
    if (!(await node.isVisible().catch(() => false))) continue;
    const text = ((await node.innerText().catch(() => '')) || (await node.getAttribute('value')) || '').trim();
    if (text === 'Save') {
      await node.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      break;
    }
  }

  await dismissHostPopups();
  const original = page.locator('#world-backstage-root').first();
  const onboarding = original.getByText('收好纸条', { exact: true });
  if (await onboarding.isVisible().catch(() => false)) {
    await onboarding.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  await dismissHostPopups();
  await page.screenshot({
    path: path.join(out, '00-sillytavern-with-world-backstage-entry.png'),
    animations: 'disabled',
    fullPage: false,
  });
  report.shots.push('00-sillytavern-with-world-backstage-entry.png');

  const orb = original.locator('[data-wb-action="toggle-panel"]').first();
  if (await orb.isVisible().catch(() => false)) {
    await shot('01-world-backstage-entry-orb', orb);
  }

  report.populated = await page.evaluate(async () => {
    const ext = '/scripts/extensions/third-party/world-backstage';
    const core = await import(`${ext}/core.js`);
    const { createWorldBackstageUI } = await import(`${ext}/ui.js`);

    let state = core.createInitialState();
    state.clock = {
      ...state.clock,
      absoluteMinute: 4 * 1440 + 20 * 60 + 35,
      anchored: true,
      precision: 'minute',
      source: 'tutorial-lab',
    };
    state.world = {
      ...(state.world || {}),
      name: '雾港旧城区',
      summary: '雨后的旧城区刚恢复电力，北站仍在限流。伊芙留在旅店，诺拉已经动身前往北站。',
      situation: '雨势转小，夜间交通逐步恢复。',
      location: '雾港旧城区',
    };

    state.people.push(
      {
        id: 'eve', name: '伊芙', monogram: '伊', isUser: false,
        location: '旧城区 · 白鸢旅店二楼',
        action: '把烧信后的灰烬扫进壁炉，重新检查房门',
        intent: '确认没有人跟踪到旅店',
        longTermGoal: '查清鹤纹火漆背后的来历',
        innerVoice: '诺拉已经走了。今晚最好别再有人敲门。',
        knowledge: 'known', source: 'background', simulationEnabled: true,
      },
      {
        id: 'nora', name: '诺拉', monogram: '诺', isUser: false,
        location: '前往北站的有轨电车',
        action: '坐在最后一排查看站台封锁通知',
        intent: '在末班车停止前离开旧城区',
        longTermGoal: '把掌握的名单送到安全地点',
        innerVoice: '信已经烧掉了，剩下的东西只能靠记忆。',
        knowledge: 'hidden', source: 'background', simulationEnabled: true,
      },
      {
        id: 'keeper', name: '旅店老板娘', monogram: '店', isUser: false,
        location: '白鸢旅店一楼柜台',
        action: '整理今晚的入住簿并留意门外动静',
        intent: '尽快打烊，不再接待陌生客人',
        longTermGoal: '保护旅店和常住客人的安全',
        innerVoice: '二楼那两位客人今晚惹上的事恐怕不小。',
        knowledge: 'trace', source: 'background', simulationEnabled: true,
      },
    );

    for (const event of [
      {
        id: 'north-station-restriction', title: '北站夜间限流', place: '雾港北站',
        summary: '暴雨后的线路检修导致北站只开放两个月台，进站速度明显变慢。',
        consequence: '前往北站的人需要更早出发，否则可能错过末班车。',
        status: 'active', visibility: 'known', clockMode: 'duration', durationMinutes: 95,
        actors: ['nora'], publicity: 'public',
      },
      {
        id: 'unknown-tail', title: '旧城区的陌生尾随者', place: '白鸢旅店附近',
        summary: '一名身份不明的人在雨停后两次经过旅店门口。',
        consequence: '如果继续靠近，旅店中的人可能察觉异常。',
        status: 'active', visibility: 'trace', clockMode: 'condition',
        actors: ['eve'], publicity: 'private',
      },
      {
        id: 'power-restored', title: '旧城区恢复供电', place: '雾港旧城区',
        summary: '停电二十分钟后，主街和旅店所在街区恢复供电。',
        consequence: '店铺重新营业，街道监控也陆续恢复。',
        status: 'resolved', visibility: 'known', publicity: 'public',
      },
    ]) state = core.addManualEvent(state, event);

    state = core.applyHistoryIndexResult(state, {
      memory_digest: {
        text: '伊芙与诺拉在白鸢旅店会面。诺拉交出一封带鹤纹火漆的信，伊芙读完后将信烧毁。随后诺拉动身前往北站。',
        through_message_id: 38,
        people: ['伊芙', '诺拉', '旅店老板娘'],
        tags: ['鹤纹火漆', '烧信', '北站'],
      },
      chapter_summary: {
        title: '雨夜的白鸢旅店',
        summary: '暴雨停电期间，伊芙和诺拉在旅店交换秘密情报。一封带鹤纹火漆的信被烧毁，诺拉随后离开。',
        start_message_id: 1,
        end_message_id: 38,
        people: ['伊芙', '诺拉'],
        locations: ['白鸢旅店', '雾港旧城区'],
      },
      facts_upsert: [
        {
          id: 'letter-burned', key: 'letter:sealed:status', subject: '鹤纹火漆信', predicate: '状态',
          value: '已被伊芙烧毁', status: 'active', confidence: 'high', importance: 3,
          visibility: 'known', source_message_id: 31,
        },
        {
          id: 'nora-left', key: 'person:nora:departure', subject: '诺拉', predicate: '去向',
          value: '已经离开旅店并前往北站', status: 'active', confidence: 'high', importance: 3,
          visibility: 'known', source_message_id: 36,
        },
        {
          id: 'keeper-ignorant', key: 'person:keeper:letter-knowledge', subject: '旅店老板娘', predicate: '是否知道信件内容',
          value: '不知道信件具体内容', status: 'active', confidence: 'high', importance: 2,
          visibility: 'hidden', source_message_id: 29,
        },
      ],
      clues_upsert: [
        {
          id: 'crane-wax', title: '鹤纹火漆',
          text: '被烧毁的信封上有一道极浅的鹤纹火漆，诺拉只说它来自旧城区以外。',
          source_message_id: 18, people: ['伊芙', '诺拉'], locations: ['白鸢旅店'],
          tags: ['火漆', '来历不明'], importance: 3, status: 'developing',
        },
        {
          id: 'second-footstep', title: '雨后的第二串脚印',
          text: '旅店后巷出现第二串湿脚印，鞋底纹路与住客都不相符。',
          source_message_id: 34, people: ['伊芙'], locations: ['白鸢旅店后巷'],
          tags: ['尾随', '脚印'], importance: 2, status: 'developing',
        },
      ],
    }, { startMessageId: 1, endMessageId: 38 });

    document.querySelectorAll('#world-backstage-root').forEach(node => node.remove());
    document.querySelectorAll('dialog.popup, .popup.wider_dialogue_popup').forEach(node => node.remove());

    const ctx = globalThis.SillyTavern?.getContext?.() || {};
    const e = ctx.extensionSettings?.world_backstage || globalThis.extension_settings?.world_backstage || {};
    const settings = {
      ...e,
      enabled: true,
      theme: 'day',
      uiScale: 'comfortable',
      orbEnabled: true,
      orbEdgeHide: false,
      observerMode: 'backstage',
      worldSimulationEnabled: true,
      worldPromptInjection: true,
      deliveryDensity: 'balanced',
      sceneTiming: 'smart',
      apiProfiles: Array.isArray(e.apiProfiles) ? e.apiProfiles : [],
      apiModuleRoutes: e.apiModuleRoutes || {},
      generationModuleLimits: e.generationModuleLimits || {},
      tagFilterRules: Array.isArray(e.tagFilterRules) ? e.tagFilterRules : [],
    };

    const ui = createWorldBackstageUI({
      getState: () => state,
      getSettings: () => settings,
      getSyncStatus: () => ({
        phase: 'idle',
        message: '世界状态已同步',
        connection: {},
        memory: { phase: 'idle' },
        lingqi: { phase: 'idle', notes: [] },
        social: {},
        opinion: {},
      }),
      getTavernProfiles: () => [],
      onAction: async () => null,
      pluginVersion: '2.5.7',
    });
    ui.open();
    ui.render();
    globalThis.__WB_TUTORIAL_UI__ = ui;

    return {
      people: state.people.length,
      events: state.events.length,
      facts: state.storyMemory?.facts?.length || 0,
      clues: state.storyMemory?.clues?.length || 0,
      summaries: state.storyMemory?.summaries?.length || 0,
    };
  });

  if (report.populated.people < 3 || report.populated.facts < 3 || report.populated.clues < 2) {
    throw new Error(`tutorial fixture incomplete: ${JSON.stringify(report.populated)}`);
  }

  const root = page.locator('#world-backstage-root').first();
  const win = root.locator('.wb-window').first();
  await win.waitFor({ state: 'visible', timeout: 15_000 });
  const box = await win.boundingBox();
  report.checks.window = box;
  if (!box || box.width < 900 || box.height < 600) {
    throw new Error(`tutorial window layout invalid: ${JSON.stringify(box)}`);
  }

  const views = [
    ['now', '10-此刻-有内容'],
    ['people', '11-人物-有内容'],
    ['memory', '12-记忆-有内容'],
  ];

  for (const [id, name] of views) {
    await root.locator(`[data-wb-action="set-view"][data-view="${id}"]`).first().click({ force: true });
    await page.waitForTimeout(450);
    if (id === 'people') {
      await clickFirstVisible(root.getByText('全部展开', { exact: true }));
      await page.waitForTimeout(300);
    }
    if (id === 'memory') {
      await clickFirstVisible(root.locator('button').filter({ hasText: /^全部$/ }));
      await page.waitForTimeout(300);
    }
    await shot(name, win);
  }

  await root.locator('[data-wb-action="set-view"][data-view="people"]').first().click({ force: true });
  await page.waitForTimeout(300);
  report.checks.peopleHasEve = (await root.getByText('伊芙', { exact: true }).count()) > 0;
  if (!report.checks.peopleHasEve) throw new Error('伊芙没有出现在真实人物页');

  const eveCard = root.locator('[data-wb-action="select-person"][data-person-id="eve"]').first();
  if (await eveCard.isVisible().catch(() => false)) {
    await eveCard.click({ force: true });
    await page.waitForTimeout(350);
    const drawer = root.locator('.wb-person-drawer').first();
    if (await drawer.isVisible().catch(() => false)) {
      await shot('11b-人物-伊芙详情', drawer);
    }
  }

  await root.locator('[data-wb-action="set-view"][data-view="memory"]').first().click({ force: true });
  await page.waitForTimeout(300);
  report.checks.memoryHasNora = (await root.getByText('诺拉', { exact: true }).count()) > 0;
  report.checks.memoryHasWax = (await root.getByText('鹤纹火漆', { exact: false }).count()) > 0;
  if (!report.checks.memoryHasNora || !report.checks.memoryHasWax) {
    throw new Error('真实记忆页没有渲染预期的诺拉 / 鹤纹火漆内容');
  }

  const personDrawerClose = root.locator('[data-wb-action="close-person"]').first();
  if (await personDrawerClose.isVisible().catch(() => false)) {
    await personDrawerClose.click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
  }

  await root.locator('[data-wb-action="toggle-settings"]').first().click({ force: true });
  await page.waitForTimeout(350);
  const settings = root.locator('.wb-settings-popover').first();
  if (!(await settings.isVisible().catch(() => false))) throw new Error('真实设置窗口没有打开');
  await shot('13-设置-真实界面', settings);

  await fs.writeFile(path.join(out, 'tutorial-capture-report.json'), JSON.stringify(report, null, 2));
} catch (error) {
  report.error = String(error?.stack || error);
  await fs.writeFile(path.join(out, 'tutorial-capture-report.json'), JSON.stringify(report, null, 2)).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
