import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.LAB_PLAYWRIGHT_CORE_ENTRY);
const cases = JSON.parse(await fs.readFile('.lab/wb-rp-multicard-cases.json', 'utf8'));
const testCase = cases.find(item => item.id === process.env.LAB_RP_CASE);
if (!testCase || !process.env.LAB_MODEL_KEY) throw new Error('Missing case or existing Youzi credential');
const out = path.resolve(`bench-evidence/wb-memory-real-${testCase.id}`);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.LAB_CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [], requestAudit = [], replies = [], checks = [];
page.on('pageerror', error => pageErrors.push(String(error.message)));
page.on('dialog', dialog => dialog.accept());
let lastRequestAt = 0;
// Forward every request unchanged. This hook paces real ST traffic and records only
// non-secret prompt bodies; it never supplies fixture responses or model outputs.
await page.route('**/api/backends/chat-completions/generate', async route => {
    const delay = Math.max(0, lastRequestAt + 13000 - Date.now());
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastRequestAt = Date.now();
    const data = route.request().postDataJSON();
    requestAudit.push({ time: lastRequestAt, model: data.model, messages: data.messages });
    await route.continue();
});
async function persist(extra = {}) {
    const data = await page.evaluate(() => {
        const ctx = globalThis.SillyTavern?.getContext?.();
        return ctx ? { chat: ctx.chat.map((m, id) => ({ id, name: m.name, mes: m.mes,
            is_user: m.is_user, is_system: m.is_system,
            autoHidden: Boolean(m.extra?.world_backstage_auto_hidden) })),
            memory: ctx.chatMetadata?.world_backstage_v1?.currentState?.storyMemory } : {};
    }).catch(() => ({}));
    await fs.writeFile(path.join(out, 'progress.json'), JSON.stringify({ caseId: testCase.id,
        candidate: process.env.LAB_WB_SHA, model: process.env.LAB_MODEL_ID,
        preset: 'MoM5.40KKMYUKI: 克制白描 + 第三人称 + 语言设置',
        rounds: replies.length, requests: requestAudit.length, checks, pageErrors, ...data, ...extra }, null, 2));
    await fs.writeFile(path.join(out, 'requests.json'), JSON.stringify(requestAudit, null, 2));
}
async function generate(input) {
    const before = await page.evaluate(() => globalThis.SillyTavern.getContext().chat.length);
    let generationError;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            await page.evaluate(async ({ text, retry }) => {
                globalThis.worldBackstageHost.close();
                document.querySelector('#send_textarea').value = retry ? '' : text;
                document.querySelector('#send_textarea').dispatchEvent(new Event('input', { bubbles: true }));
                await globalThis.SillyTavern.getContext().generate('normal', retry ? { automatic_trigger: true } : {});
            }, { text: input, retry: attempt > 0 });
            generationError = null;
            break;
        } catch (error) {
            generationError = error;
            if (!/Forbidden|429|502|503|504|status/.test(String(error.message))) throw error;
            console.log(`real ST ${testCase.id}: transient provider error, attempt ${attempt + 1}/4`);
        }
    }
    if (generationError) throw generationError;
    const result = await page.evaluate(start => {
        const chat = globalThis.SillyTavern.getContext().chat;
        const m = chat.at(-1);
        return { length: chat.length, reply: m?.mes || '', assistant: m && !m.is_user, start };
    }, before);
    assert.ok(result.length > before && result.assistant && result.reply.trim(),
        'Real ST Generate must append a nonempty assistant reply');
    return result.reply;
}
async function index() {
    const target = await page.evaluate(() => globalThis.SillyTavern.getContext().chat.length - 1);
    await page.evaluate(() => globalThis.worldBackstageHost.open());
    if (!await page.locator('[data-wb-action="scan-history"]').count()) {
        await page.locator('[data-wb-action="toggle-settings"]').first().evaluate(el => el.click());
    }
    const button = page.locator('[data-wb-action="scan-history"]').first();
    await button.evaluate(el => el.click());
    await page.waitForFunction(last => {
        const state = globalThis.SillyTavern.getContext().chatMetadata.world_backstage_v1?.currentState;
        const button = document.querySelector('[data-wb-action="scan-history"]');
        return Number(state?.storyMemory?.indexedThroughMessageId ?? -1) >= last && button && !button.disabled;
    }, target, { timeout: 600000 });
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => {
        const ctx = globalThis.SillyTavern.getContext();
        return { length: ctx.chat.length, hidden: ctx.chat.filter(m => m.extra?.world_backstage_auto_hidden).length,
            recentVisible: ctx.chat.slice(-5).every(m => !m.is_system),
            summaries: ctx.chatMetadata.world_backstage_v1.currentState.storyMemory.summaries.length };
    });
    assert.ok(state.hidden > 0 && state.recentVisible, 'Generated archived floors hide with five-floor buffer');
    console.log(`real ST ${testCase.id}: archived ${state.length} floors, hidden ${state.hidden}, summaries ${state.summaries}`);
    await persist();
}
try {
    await page.goto(process.env.LAB_ST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => globalThis.__worldBackstageLoaded && globalThis.worldBackstageHost, null, { timeout: 60000 });
    const onboardingSave = page.getByRole('button', { name: 'Save', exact: true });
    if (await onboardingSave.count()) await onboardingSave.first().click({ timeout: 5000 }).catch(() => {});
    // Import the selected native preset through ST's own preset input; disable all
    // other MoM modules, including competing summaries and scripts.
    await page.locator('#main_api').evaluate(el => { el.value = 'openai'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.locator('#openai_preset_import_file').setInputFiles('.lab/wb-memory-mom-selected.json');
    await page.waitForFunction(() => document.querySelector('#settings_preset_openai')?.selectedOptions[0]?.textContent.includes('wb-memory-mom-selected'));
    await page.evaluate(async ({ card, key, base, model }) => {
        const ctx = globalThis.SillyTavern.getContext();
        const created = await fetch('/api/characters/create', { method: 'POST', headers: ctx.getRequestHeaders(),
            body: JSON.stringify({ ch_name: `LAB_${card.name}`, description: card.description || '',
                personality: card.personality || '', scenario: card.scenario || '',
                first_mes: card.first_mes || '角色正在现场等待。', mes_example: card.mes_example || '' }) });
        if (!created.ok) throw new Error(`Character creation HTTP ${created.status}`);
        const script = await import('/script.js');
        await script.getCharacters();
        const ready = globalThis.SillyTavern.getContext();
        const id = ready.characters.findIndex(c => c.name === `LAB_${card.name}`);
        if (id < 0) throw new Error('Imported Library card not found');
        await ready.selectCharacterById(id);
        const { oai_settings } = await import('/scripts/openai.js');
        const { writeSecret, SECRET_KEYS } = await import('/scripts/secrets.js');
        await writeSecret(SECRET_KEYS.CUSTOM, key);
        Object.assign(oai_settings, { chat_completion_source: 'custom', custom_url: base,
            custom_model: model, custom_include_headers: 'User-Agent: SillyTavern/1.18.0\nAccept: application/json', stream_openai: false, openai_max_context: 32768,
            openai_max_tokens: 850, temperature: 0.55, bypass_status_check: true });
        script.setOnlineStatus(model);
        Object.assign(ready.extensionSettings.world_backstage, { enabled: true,
            worldSimulationEnabled: false, worldAutoEnabled: false, worldPromptInjection: false,
            memorySystemEnabled: true, injectionMemory: true, memoryPromptInjection: true,
            memoryAutoIndexInterval: 0, autoHideArchivedFloors: true,
            publicOpinionAutoEnabled: false, socialAutoEnabled: false,
            apiMode: 'custom', customApiUrl: base, customApiKey: key, customApiModel: model,
            customApiTransport: 'proxy', autoRetryCount: 2, customApiTimeoutMs: 180000 });
        ready.saveSettingsDebounced();
    }, { card: testCase.context, key: process.env.LAB_MODEL_KEY,
        base: process.env.LAB_MODEL_BASE_URL, model: process.env.LAB_MODEL_ID });
    await page.waitForTimeout(1000);
    // Keep the original ordered beats while covering all crucial changes in 24 rounds.
    const selected = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,23,24,30,31,36,39];
    for (let i = 0; i < selected.length; i++) {
        let input = testCase.beats[selected[i]];
        if (i === 4) input += '我还发现门框左下角有四道平行蓝线，旁边是倒置三角，随后继续调查。';
        const reply = await generate(input);
        replies.push(reply);
        console.log(`real ST ${testCase.id}: generated round ${i + 1}/${selected.length}`);
        if ((i + 1) % 6 === 0) await index();
        else await persist();
    }
    // Reload is part of the test: metadata, branch memory, signatures and hiding
    // must survive without a separate hand-authored archive being supplied.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.__worldBackstageLoaded && globalThis.worldBackstageHost);
    await page.waitForTimeout(1500);
    const persisted = await page.evaluate(() => {
        const ctx = globalThis.SillyTavern.getContext();
        return { hidden: ctx.chat.filter(m => m.extra?.world_backstage_auto_hidden).length,
            cursor: ctx.chatMetadata.world_backstage_v1.currentState.storyMemory.indexedThroughMessageId };
    });
    assert.ok(persisted.hidden > 0 && persisted.cursor >= 48, 'Generated archive and hidden floors survive reload');
    // Re-establish custom API settings after debounced settings persistence on reload.
    await page.evaluate(async ({ base, model }) => {
        const { oai_settings } = await import('/scripts/openai.js');
        Object.assign(oai_settings, { chat_completion_source: 'custom', custom_url: base,
            custom_model: model, stream_openai: false, bypass_status_check: true });
        (await import('/script.js')).setOnlineStatus(model);
    }, { base: process.env.LAB_MODEL_BASE_URL, model: process.env.LAB_MODEL_ID });
    const questions = [
        [testCase.question, parsed => ({
            opening: String(parsed.opening).includes(testCase.expected.opening),
            order: JSON.stringify(parsed.order).includes(testCase.expected.first) && JSON.stringify(parsed.order).includes(testCase.expected.second)
                && JSON.stringify(parsed.order).indexOf(testCase.expected.first) < JSON.stringify(parsed.order).indexOf(testCase.expected.second),
            password: String(parsed.password).includes(testCase.expected.password),
            holder: String(parsed.holder).includes(testCase.expected.holder) && !String(parsed.holder).includes(testCase.expected.oldHolder),
            appointment: String(parsed.appointment).includes(testCase.expected.appointment),
            knock: String(parsed.knock).includes(testCase.expected.knock),
        })],
        ['暂停剧情。仅据前文，核对门框上的线条颜色、数量、位置与旁边图案，输出JSON：color,count,place,shape。没有依据填未知。', parsed => ({
            color: /蓝/.test(String(parsed.color)), count: /四|4/.test(String(parsed.count)),
            place: /左下/.test(String(parsed.place)), shape: /倒置|倒三角|倒.*三角/.test(String(parsed.shape)),
        })],
    ];
    for (const [question, score] of questions) {
        const raw = await generate(question);
        const parsed = await page.evaluate(async text =>
            (await import('/scripts/extensions/third-party/world-backstage/core.js')).extractJsonObject(text) || {}, raw);
        checks.push({ question, parsed, checks: score(parsed) });
        await persist();
    }
    const all = checks.flatMap(x => Object.values(x.checks));
    const passRate = all.filter(Boolean).length / all.length;
    // Confirm subsequent normal generation uses the actual plugin's memory support.
    assert.ok(requestAudit.some(r => r.messages?.some(m => String(m.content).includes('此前正文的剧情记忆'))),
        'ST outgoing model prompts must include plugin-generated narrative memory');
    await page.evaluate(() => globalThis.worldBackstageHost.open());
    await page.screenshot({ path: path.join(out, 'desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 412, height: 915 });
    await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true });
    await persist({ passRate, passed: all.filter(Boolean).length, total: all.length,
        scope: 'Real SillyTavern 1.18.0 Generate, Library card fixture and selected MoM native modules; live Youzi replies; plugin UI history indexing and rollups; native is_system hiding; reload; independent RP per card. Scripted user inputs, 24 rounds/card, not a thousand-floor live run.' });
    console.log(JSON.stringify({ caseId: testCase.id, passRate, checks, pageErrors }));
    assert.ok(passRate >= 0.8, `Recall ${all.filter(Boolean).length}/${all.length} below 80%`);
    assert.equal(pageErrors.length, 0);
} catch (error) {
    await persist({ failure: String(error.message) });
    await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
} finally { await browser.close(); }
