import fs from 'node:fs/promises';
import path from 'node:path';

const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.LAB_CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1.25 });
const out = process.env.LAB_EVIDENCE_DIR;

async function dismissHostPopups() {
  await page.evaluate(() => {
    document.querySelectorAll('dialog.popup, .popup.wider_dialogue_popup').forEach(node => node.remove());
  }).catch(() => {});
}

async function clickVisible(locator) {
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

async function captureTab(settings, label, file) {
  const button = settings.locator('button').filter({ hasText: new RegExp(`^${label}$`) });
  if (!(await clickVisible(button))) throw new Error(`找不到设置页签：${label}`);
  await page.waitForTimeout(350);
  await settings.evaluate(node => { node.scrollTop = 0; });
  await page.waitForTimeout(120);
  await settings.screenshot({
    path: path.join(out, file),
    animations: 'disabled',
    timeout: 20_000,
  });
}

try {
  await fs.mkdir(out, { recursive: true });
  await page.goto(process.env.LAB_ST_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => Boolean(globalThis.SillyTavern?.getContext), null, { timeout: 30_000 });
  await page.waitForSelector('#world-backstage-root', { timeout: 30_000 });
  await dismissHostPopups();

  // Build a clean, real World Backstage UI instance specifically for screenshots.
  // This avoids depending on onboarding or whatever state the host page happened to restore.
  await page.evaluate(async () => {
    const ext = '/scripts/extensions/third-party/world-backstage';
    const core = await import(`${ext}/core.js`);
    const { createWorldBackstageUI } = await import(`${ext}/ui.js`);
    const ctx = globalThis.SillyTavern?.getContext?.() || {};
    const existing = ctx.extensionSettings?.world_backstage || globalThis.extension_settings?.world_backstage || {};
    const state = core.createInitialState();
    const settings = {
      ...existing,
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
      apiProfiles: Array.isArray(existing.apiProfiles) ? existing.apiProfiles : [],
      apiModuleRoutes: existing.apiModuleRoutes || {},
      generationModuleLimits: existing.generationModuleLimits || {},
      tagFilterRules: Array.isArray(existing.tagFilterRules) ? existing.tagFilterRules : [],
    };

    document.querySelectorAll('#world-backstage-root').forEach(node => node.remove());
    document.querySelectorAll('dialog.popup, .popup.wider_dialogue_popup').forEach(node => node.remove());

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
    globalThis.__WB_SETTINGS_TUTORIAL_UI__ = ui;
  });

  const root = page.locator('#world-backstage-root').first();
  await root.locator('.wb-window').first().waitFor({ state: 'visible', timeout: 15_000 });
  if (!(await clickVisible(root.locator('[data-wb-action="toggle-settings"]')))) {
    throw new Error('找不到全局设置按钮');
  }
  await page.waitForTimeout(350);
  const settings = root.locator('.wb-settings-popover').first();
  await settings.waitFor({ state: 'visible', timeout: 15_000 });

  await captureTab(settings, '常用', '13a-设置-常用.png');
  await captureTab(settings, '正文注入', '13b-设置-正文注入.png');
  await captureTab(settings, '连接与模型', '13c-设置-连接与模型.png');
  await captureTab(settings, '高级维护', '13d-设置-高级维护.png');
} finally {
  await browser.close();
}
