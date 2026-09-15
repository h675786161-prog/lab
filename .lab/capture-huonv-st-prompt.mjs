import fs from 'node:fs/promises';
import path from 'node:path';

const CARD = process.env.CARD_ABS;
const PRESET = process.env.PRESET_ABS;
const OUT = process.env.LAB_EVIDENCE_DIR;
const source = JSON.parse(await fs.readFile(CARD, 'utf8'));
const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);

const browser = await chromium.launch({ headless: true, executablePath: process.env.LAB_CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
let captured = null;
let resolveCaptured;
const capturedPromise = new Promise(r => { resolveCaptured = r; });

await page.route('**/api/backends/chat-completions/generate', async route => {
  try {
    captured = route.request().postDataJSON();
  } catch {
    captured = { raw: route.request().postData() };
  }
  resolveCaptured(captured);
  const body = [
    'data: ' + JSON.stringify({ choices: [{ delta: { content: '<content>CAPTURE_ONLY</content>' } }] }),
    '',
    'data: [DONE]',
    '',
  ].join('\n');
  await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
});

async function dismissFirstRunWelcome() {
  const welcome = page.getByText('Welcome to SillyTavern!', { exact: true });
  if (!(await welcome.isVisible().catch(() => false))) return false;
  const visibleSave = page.locator('button:visible').filter({ hasText: /^Save$/ }).first();
  if (!(await visibleSave.count())) throw new Error('First-run welcome is visible but Save button was not found');
  await visibleSave.click({ force: true });
  await page.waitForTimeout(1500);
  return true;
}

const report = { result: 'started', page_errors: pageErrors };
try {
  const home = await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2500);
  if (!home || home.status() >= 400) throw new Error(`ST home HTTP ${home?.status()}`);
  report.first_run_welcome_dismissed = await dismissFirstRunWelcome();

  const sourceText = JSON.stringify(source);
  const imported = await page.evaluate(async text => {
    const fd = new FormData();
    fd.set('file_type', 'json');
    fd.set('avatar', new File([text], 'character.json', { type: 'application/json' }));
    const r = await fetch('/api/characters/import', { method: 'POST', body: fd });
    let body; try { body = await r.json(); } catch { body = await r.text(); }
    return { ok: r.ok, status: r.status, body };
  }, sourceText);
  if (!imported.ok || !imported.body?.file_name) throw new Error(`Import failed: ${JSON.stringify(imported)}`);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2500);
  await dismissFirstRunWelcome();

  const presetInput = page.locator('#openai_preset_import_file');
  await presetInput.waitFor({ state: 'attached', timeout: 30_000 });
  await presetInput.setInputFiles(PRESET);
  await page.waitForTimeout(2000);

  const chars = page.locator('#rm_print_characters_block .character_select');
  await chars.first().waitFor({ state: 'attached', timeout: 30_000 });
  const target = chars.filter({ hasText: '霍女' }).first();
  if (await target.count()) await target.click({ force: true });
  else await chars.first().click({ force: true });
  await page.waitForTimeout(2000);

  const runtimeSettings = await page.evaluate(async () => {
    const $ = window.jQuery || window.$;
    if ($) {
      $('#main_api').val('openai').trigger('change');
      $('#chat_completion_source').val('custom').trigger('change');
      $('#openai_bypass_status_check').prop('checked', true).trigger('input');
    }
    const o = await import('/scripts/openai.js');
    o.oai_settings.chat_completion_source = 'custom';
    o.oai_settings.custom_url = 'http://127.0.0.1:9/v1';
    o.oai_settings.custom_model = 'glm-5.3';
    o.oai_settings.bypass_status_check = true;
    const s = await import('/script.js');
    if (typeof s.setOnlineStatus === 'function') s.setOnlineStatus('Status check bypassed');
    return {
      source: o.oai_settings.chat_completion_source,
      model: o.oai_settings.custom_model,
      stream: o.oai_settings.stream_openai,
      preset: o.oai_settings.preset_settings_openai,
      main_api: document.querySelector('#main_api')?.value || null,
    };
  });

  const prompt = '【导演指令】沈砚看着刚从反锁空屋里出来的霍女：“你是狐妖吧？都这样了还要骗我？”继续。';
  const textarea = page.locator('#send_textarea');
  await textarea.waitFor({ state: 'attached', timeout: 30_000 });
  await textarea.fill(prompt);
  await page.locator('#send_but').click({ force: true });

  await Promise.race([
    capturedPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('No chat-completion request captured within 30s')), 30_000)),
  ]);

  const serialized = JSON.stringify(captured);
  const messages = Array.isArray(captured?.messages) ? captured.messages : [];
  const systemRaw = String(source.data.system_prompt || '');
  const systemProbe = systemRaw.split('\n').map(x => x.trim()).find(x => x.length >= 18 && !x.includes('{{')) || '';
  const postRaw = String(source.data.post_history_instructions || '');
  const postProbe = postRaw.split('\n').map(x => x.trim()).find(x => x.length >= 18 && !x.includes('{{')) || '';
  report.result = 'pass';
  report.home_status = home.status();
  report.imported_file_name = imported.body.file_name;
  report.runtime_settings = runtimeSettings;
  report.captured = {
    message_count: messages.length,
    model: captured?.model || null,
    chat_completion_source: captured?.chat_completion_source || null,
    stream: captured?.stream ?? null,
    temperature: captured?.temperature ?? null,
    top_p: captured?.top_p ?? null,
    top_k: captured?.top_k ?? null,
    max_tokens: captured?.max_tokens ?? null,
    has_user_probe: serialized.includes('你是狐妖吧'),
    has_card_system_probe: systemProbe ? serialized.includes(systemProbe) : null,
    has_card_post_history_probe: postProbe ? serialized.includes(postProbe) : null,
    system_probe: systemProbe,
    post_history_probe: postProbe,
  };
  report.page_errors = pageErrors;
  await fs.writeFile(path.join(OUT, 'st-captured-request.json'), JSON.stringify(captured, null, 2));
  await page.screenshot({ path: path.join(OUT, 'st-prompt-capture.png'), fullPage: true });
} catch (e) {
  report.result = 'fail';
  report.error = String(e?.stack || e);
  report.page_errors = pageErrors;
  try { await page.screenshot({ path: path.join(OUT, 'st-prompt-capture-failure.png'), fullPage: true }); } catch {}
  throw e;
} finally {
  await fs.writeFile(path.join(OUT, 'st-prompt-capture-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
