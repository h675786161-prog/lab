import fs from 'node:fs/promises';
import path from 'node:path';

const CARD = process.env.CARD_ABS;
const PRESET = process.env.PRESET_ABS;
const OUT = process.env.LAB_EVIDENCE_DIR;
const source = JSON.parse(await fs.readFile(CARD, 'utf8'));
const canonClosureProbe = '分支点前若原作未交代，保持未定义。';
if (source.data.character_version !== '1.0.3') throw new Error(`Expected Huo Nü v1.0.3; got ${source.data.character_version}`);
if (!String(source.data.system_prompt || '').includes(canonClosureProbe)) throw new Error('v1.0.3 canon-closure rule missing from source card');
const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);

const browser = await chromium.launch({ headless: true, executablePath: process.env.LAB_CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
let captured = null;
let resolveCaptured;
const capturedPromise = new Promise(r => { resolveCaptured = r; });

async function dismissFirstRunWelcome() {
  const welcome = page.getByText('Welcome to SillyTavern!', { exact: true });
  if (!(await welcome.isVisible().catch(() => false))) return false;
  const saves = page.getByText('Save', { exact: true });
  const count = await saves.count();
  for (let i = 0; i < count; i++) {
    const candidate = saves.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ force: true });
      await page.waitForTimeout(1500);
      if (!(await welcome.isVisible().catch(() => false))) return true;
    }
  }
  throw new Error(`First-run welcome is visible but no clickable visible Save text closed it; candidates=${count}`);
}

async function acceptEmbeddedLorebook() {
  const notice = page.getByText('This character has an embedded World/Lorebook.', { exact: true });
  if (!(await notice.isVisible().catch(() => false))) return false;
  const yeses = page.getByText('Yes', { exact: true });
  const count = await yeses.count();
  for (let i = 0; i < count; i++) {
    const candidate = yeses.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ force: true });
      await page.waitForTimeout(1500);
      if (!(await notice.isVisible().catch(() => false))) return true;
    }
  }
  throw new Error(`Embedded lorebook confirmation is visible but no clickable Yes closed it; candidates=${count}`);
}

async function installCaptureRoute(requiredNeedle) {
  await page.route('**/api/backends/chat-completions/generate', async route => {
    let body;
    try { body = route.request().postDataJSON(); }
    catch { body = { raw: route.request().postData() }; }
    const serialized = JSON.stringify(body);
    const matches = serialized.includes(requiredNeedle);
    const responseContent = matches ? '<content>CAPTURE_ONLY</content>' : '<content>PRECAPTURE_IGNORED</content>';
    const responseBody = [
      'data: ' + JSON.stringify({ choices: [{ delta: { content: responseContent } }] }),
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: responseBody });
    if (matches && !captured) {
      captured = body;
      resolveCaptured(captured);
    }
  });
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
  if (await target.count()) await target.evaluate(el => el.click());
  else await chars.first().evaluate(el => el.click());
  await page.waitForTimeout(750);
  report.embedded_lorebook_imported = await acceptEmbeddedLorebook();
  await page.waitForTimeout(1500);

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
  const needle = '你是狐妖吧';
  const textarea = page.locator('#send_textarea');
  await textarea.waitFor({ state: 'attached', timeout: 30_000 });
  await textarea.fill(prompt);
  const entered = await textarea.inputValue();
  if (!entered.includes(needle)) throw new Error(`User probe did not enter send textarea: ${entered}`);
  report.user_probe_entered = true;

  await installCaptureRoute(needle);
  await page.locator('#send_but').evaluate(el => el.click());

  await Promise.race([
    capturedPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('No chat-completion request containing the user probe captured within 30s')), 30_000)),
  ]);

  const serialized = JSON.stringify(captured);
  const messages = Array.isArray(captured?.messages) ? captured.messages : [];
  const systemRaw = String(source.data.system_prompt || '');
  const systemProbe = systemRaw.split('\n').map(x => x.trim()).find(x => x.length >= 18 && !x.includes('{{')) || '';
  const postRaw = String(source.data.post_history_instructions || '');
  const postProbe = postRaw.split('\n').map(x => x.trim()).find(x => x.length >= 18 && !x.includes('{{')) || '';
  if (!serialized.includes(needle)) throw new Error('Captured payload lost the real user probe');
  if (!serialized.includes(canonClosureProbe)) throw new Error('Captured payload lost the v1.0.3 canon-closure rule');
  report.result = 'pass';
  report.home_status = home.status();
  report.imported_file_name = imported.body.file_name;
  report.source_character_version = source.data.character_version;
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
    has_user_probe: serialized.includes(needle),
    has_card_system_probe: systemProbe ? serialized.includes(systemProbe) : null,
    has_v103_canon_closure_probe: serialized.includes(canonClosureProbe),
    has_card_post_history_probe: postProbe ? serialized.includes(postProbe) : null,
    canon_closure_probe: canonClosureProbe,
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
