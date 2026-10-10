import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const here = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(process.env.LAB_EVIDENCE_DIR || path.join(here, 'lab-evidence/echo-performance-real'));
const FIXTURE_DIR = path.resolve(process.env.ECHO_FIXTURE_DIR || path.join(here, 'fixtures/echo-performance-real/generated'));
const THEME_DIR = path.resolve(process.env.ECHO_THEME_DIR || path.join(FIXTURE_DIR, 'themes'));
const ST_URL = process.env.LAB_ST_URL || 'http://127.0.0.1:8039/';
const STACK_KIND = process.env.ECHO_STACK_KIND || 'bare';
const CASE_MODES = (process.env.ECHO_CASE_MODES || 'off,on').split(',').map(x => x.trim()).filter(Boolean);
const FIXTURE_NAMES = (process.env.ECHO_FIXTURES || 'real-heavy-259,long-dom-1036,long-dom-1295').split(',').map(x => x.trim()).filter(Boolean);
const THEMES = STACK_KIND === 'real'
    ? (process.env.ECHO_THEMES || 'CRYSTAL_CLARITY.json,加菲也开学_8.22.json').split(',').map(x => x.trim()).filter(Boolean)
    : [null];
const IDLE_POINTS = (process.env.ECHO_IDLE_SECONDS || '30,60,180,300').split(',').map(Number).filter(Number.isFinite).sort((a, b) => a - b);
const RUN_IDLE = process.env.ECHO_RUN_IDLE !== '0';
const RUN_TRACE = process.env.ECHO_RUN_TRACE === '1';
const RUN_MEMORY_CYCLE = process.env.ECHO_RUN_MEMORY_CYCLE !== '0';
const DIAGNOSTIC_HOOKS = process.env.ECHO_DIAGNOSTIC_HOOKS === '1';
const HEADLESS = process.env.ECHO_HEADLESS !== '0';
const VIEWPORT = { width: Number(process.env.ECHO_VIEWPORT_WIDTH || 1440), height: Number(process.env.ECHO_VIEWPORT_HEIGHT || 980) };
const EXPECTED_MESSAGES = { 'real-heavy-259': 259, 'long-dom-1036': 1036, 'long-dom-1295': 1295 };

await fs.mkdir(OUT, { recursive: true });

const playwrightEntry = process.env.LAB_PLAYWRIGHT_CORE_ENTRY;
if (!playwrightEntry) throw new Error('LAB_PLAYWRIGHT_CORE_ENTRY is required');
const { chromium } = await import(playwrightEntry.startsWith('file:') ? playwrightEntry : pathToFileURL(playwrightEntry).href);
const browser = await chromium.launch({
    executablePath: process.env.LAB_CHROME,
    headless: HEADLESS,
    args: ['--enable-precise-memory-info', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: VIEWPORT });
page.setDefaultTimeout(60_000);
const cdp = await page.context().newCDPSession(page);
let browserCdp = null;
try { browserCdp = await browser.newBrowserCDPSession(); } catch {}

const errors = [];
page.on('pageerror', error => errors.push({ type: 'pageerror', at: Date.now(), message: String(error?.stack || error) }));
page.on('console', msg => {
    if (msg.type() === 'error') errors.push({ type: 'console-error', at: Date.now(), message: msg.text() });
});

const fixturePaths = Object.fromEntries(FIXTURE_NAMES.map(name => [name, path.join(FIXTURE_DIR, `${name}.jsonl`)]));
for (const [name, file] of Object.entries(fixturePaths)) {
    await fs.access(file);
    if (!(name in EXPECTED_MESSAGES)) throw new Error(`Unknown fixture ${name}`);
}
for (const theme of THEMES.filter(Boolean)) await fs.access(path.join(THEME_DIR, theme));

await page.route('**/__echo_fixture/**', async route => {
    const url = new URL(route.request().url());
    const key = decodeURIComponent(url.pathname.split('/').pop() || '');
    const file = fixturePaths[key];
    if (!file) return route.fulfill({ status: 404, body: 'fixture not found' });
    return route.fulfill({ status: 200, path: file, contentType: 'application/x-ndjson; charset=utf-8' });
});

if (DIAGNOSTIC_HOOKS) {
    await page.addInitScript(() => {
        const counts = window.__echoRuntimeAudit = {
            setTimeoutCalls: 0,
            setIntervalCalls: 0,
            rAFCalls: 0,
            mutationObserverCreated: 0,
            mutationCallbacks: 0,
            mutationRecords: 0,
            resizeObserverCreated: 0,
            resizeCallbacks: 0,
            intersectionObserverCreated: 0,
            intersectionCallbacks: 0,
        };
        const ot = window.setTimeout.bind(window);
        window.setTimeout = (...args) => { counts.setTimeoutCalls++; return ot(...args); };
        const oi = window.setInterval.bind(window);
        window.setInterval = (...args) => { counts.setIntervalCalls++; return oi(...args); };
        const oraf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = cb => { counts.rAFCalls++; return oraf(cb); };
        const MO = window.MutationObserver;
        window.MutationObserver = class extends MO {
            constructor(cb) {
                counts.mutationObserverCreated++;
                super((records, obs) => {
                    counts.mutationCallbacks++;
                    counts.mutationRecords += records.length;
                    return cb(records, obs);
                });
            }
        };
        const RO = window.ResizeObserver;
        if (RO) window.ResizeObserver = class extends RO {
            constructor(cb) {
                counts.resizeObserverCreated++;
                super((records, obs) => {
                    counts.resizeCallbacks++;
                    return cb(records, obs);
                });
            }
        };
        const IO = window.IntersectionObserver;
        if (IO) window.IntersectionObserver = class extends IO {
            constructor(cb, opts) {
                counts.intersectionObserverCreated++;
                super((records, obs) => {
                    counts.intersectionCallbacks++;
                    return cb(records, obs);
                }, opts);
            }
        };
    });
}

async function waitForApp() {
    await page.goto(ST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.SillyTavern?.getContext && document.querySelector('#send_textarea'));
    const onboarding = page.locator('dialog[open] .onboarding');
    if (await onboarding.count()) {
        const input = page.locator('dialog[open] .popup-input');
        if (await input.count()) await input.fill('Echo Performance Lab');
        const ok = page.locator('dialog[open] .popup-button-ok');
        if (await ok.count()) await ok.click();
    }
    await page.waitForFunction(() => {
        const c = SillyTavern.getContext();
        const ready = c.eventTypes?.APP_READY;
        return Boolean(ready && c.eventSource?.autoFireLastArgs?.has?.(ready));
    }, null, { timeout: 60_000 });
    await page.evaluate(async () => {
        for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
        const { power_user } = await import('/scripts/power-user.js');
        power_user.chat_truncation = 20_000;
        power_user.reduced_motion = false;
    });
    await page.waitForFunction(() => Boolean(window.EchoPerformance), null, { timeout: 30_000 });
}

async function stackHealth() {
    return page.evaluate(kind => {
        const scripts = [...document.scripts].map(s => s.src).filter(Boolean);
        const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map(x => x.href).filter(Boolean);
        const text = document.documentElement.innerHTML;
        const globals = {
            EchoPerformance: Boolean(window.EchoPerformance),
            TavernHelper: typeof window.TavernHelper !== 'undefined',
            EjsTemplate: typeof window.EjsTemplate !== 'undefined',
            WorldBackstageInterceptor: typeof window.worldBackstageGenerationInterceptor === 'function',
        };
        return {
            kind,
            globals,
            scriptHints: scripts.filter(x => /echo-performance|JS-Slash-Runner|ST-Prompt-Template|world-backstage/i.test(x)),
            styleHints: styles.filter(x => /echo-performance|JS-Slash-Runner|ST-Prompt-Template|world-backstage/i.test(x)),
            worldBackstageTextMarker: /世界背面|world-backstage/i.test(text),
        };
    }, STACK_KIND);
}

async function ensureBenchCharacter() {
    await page.evaluate(async () => {
        const s = await import('/script.js');
        let id = s.characters.findIndex(c => c.name === 'Echo Performance Fixture Host');
        if (id < 0) {
            const form = new FormData();
            form.set('ch_name', 'Echo Performance Fixture Host');
            form.set('description', 'Local browser performance fixture host. No model calls are used.');
            form.set('first_mes', 'Echo performance fixture host ready.');
            const headers = s.getRequestHeaders();
            delete headers['Content-Type'];
            const response = await fetch('/api/characters/create', { method: 'POST', headers, body: form });
            if (!response.ok) throw new Error(`create fixture host failed: ${response.status}`);
            await s.getCharacters();
            id = s.characters.findIndex(c => c.name === 'Echo Performance Fixture Host');
        }
        if (id < 0) throw new Error('fixture host character unavailable');
        await s.selectCharacterById(id);
    });
}

async function installFixture(name) {
    const expected = EXPECTED_MESSAGES[name];
    const result = await page.evaluate(async ({ name, expected }) => {
        const s = await import('/script.js');
        const response = await fetch(`/__echo_fixture/${encodeURIComponent(name)}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`fixture fetch ${name}: ${response.status}`);
        const text = await response.text();
        const lines = text.split(/\r?\n/).filter(Boolean);
        const rows = lines.map(line => JSON.parse(line));
        const metadataRows = rows.filter(row => row && typeof row === 'object' && row.chat_metadata);
        if (metadataRows.length !== 1 || !rows[0]?.chat_metadata) throw new Error(`${name}: metadata row invariant failed`);
        if (rows.length - 1 !== expected) throw new Error(`${name}: expected ${expected} messages, got ${rows.length - 1}`);
        const file = `echo-real-${name}`;
        const responseSave = await fetch('/api/chats/save', {
            method: 'POST',
            headers: s.getRequestHeaders(),
            body: JSON.stringify({ avatar_url: s.characters[s.this_chid].avatar, file_name: file, chat: rows, force: true }),
        });
        if (!responseSave.ok) throw new Error(`save ${name}: ${responseSave.status}`);
        return {
            file,
            rows: rows.length,
            messages: rows.length - 1,
            bytes: new TextEncoder().encode(text).length,
            worldBackstage: Boolean(rows[0]?.chat_metadata?.world_backstage_v1),
            metadataRows: metadataRows.length,
        };
    }, { name, expected });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    return result;
}

async function ensureTinySwitchChat() {
    return page.evaluate(async () => {
        const s = await import('/script.js');
        const file = 'echo-switch-sentinel';
        const rows = [
            { user_name: 'Echo Lab', character_name: 'Echo Performance Fixture Host', chat_metadata: { echo_switch_sentinel: true } },
            { name: 'Echo Lab', is_user: true, is_system: false, send_date: '2026-10-11T00:00:00.000Z', mes: 'switch sentinel user' },
            { name: 'Echo Performance Fixture Host', is_user: false, is_system: false, send_date: '2026-10-11T00:00:01.000Z', mes: 'switch sentinel assistant' },
        ];
        const r = await fetch('/api/chats/save', {
            method: 'POST',
            headers: s.getRequestHeaders(),
            body: JSON.stringify({ avatar_url: s.characters[s.this_chid].avatar, file_name: file, chat: rows, force: true }),
        });
        if (!r.ok) throw new Error(`sentinel save failed: ${r.status}`);
        return file;
    });
}

async function applyTheme(themeFile) {
    if (!themeFile) return { applied: false, name: null };
    const themePath = path.join(THEME_DIR, themeFile);
    const expected = JSON.parse(await fs.readFile(themePath, 'utf8')).name;
    const input = page.locator('#ui_preset_import_file');
    await input.waitFor({ state: 'attached' });
    await input.setInputFiles(themePath);
    await page.waitForFunction(expected => {
        const select = document.querySelector('#themes');
        return select?.value === expected || [...(select?.options || [])].some(x => x.value === expected && x.selected);
    }, expected, { timeout: 30_000 }).catch(() => {});
    const state = await page.evaluate(async expected => {
        const { power_user } = await import('/scripts/power-user.js');
        return {
            expected,
            active: power_user.theme,
            customCssChars: String(power_user.custom_css || '').length,
            reducedMotion: power_user.reduced_motion,
            bodyClass: document.body.className,
        };
    }, expected);
    if (state.active !== expected) throw new Error(`theme ${expected} did not become active; active=${state.active}`);
    return { applied: true, file: themeFile, ...state };
}

async function setEcho(enabled) {
    await page.evaluate(enabled => {
        EchoPerformance.profileReset?.();
        EchoPerformance.profileExpensive?.(false);
        EchoPerformance.setEnabled(Boolean(enabled), false);
    }, enabled);
}

async function openFixture(file, expected) {
    const ms = await page.evaluate(async ({ file, expected }) => {
        const s = await import('/script.js');
        const start = performance.now();
        await s.openCharacterChat(file);
        const elapsed = performance.now() - start;
        if (s.chat.length !== expected) throw new Error(`open ${file}: expected ${expected}, got ${s.chat.length}`);
        return elapsed;
    }, { file, expected });
    await page.waitForTimeout(800);
    return ms;
}

async function perfMetrics() {
    const result = await cdp.send('Performance.getMetrics');
    const wanted = new Set(['Timestamp', 'TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'JSEventListeners']);
    return Object.fromEntries(result.metrics.filter(m => wanted.has(m.name)).map(m => [m.name, m.value]));
}

async function domCounters() {
    try { return await cdp.send('Memory.getDOMCounters'); } catch { return null; }
}

async function processCpuSnapshot() {
    if (!browserCdp) return null;
    try {
        const { processInfo } = await browserCdp.send('SystemInfo.getProcessInfo');
        const byType = {};
        let totalCpuTime = 0;
        for (const p of processInfo) {
            totalCpuTime += Number(p.cpuTime || 0);
            byType[p.type] = (byType[p.type] || 0) + Number(p.cpuTime || 0);
        }
        return { totalCpuTime, byType, processCount: processInfo.length };
    } catch { return null; }
}

function deltaMetrics(before, after) {
    const out = {};
    for (const key of Object.keys(after || {})) if (Number.isFinite(before?.[key]) && Number.isFinite(after?.[key])) out[key] = after[key] - before[key];
    return out;
}

function cpuDelta(before, after, wallSeconds) {
    if (!before || !after) return null;
    const delta = after.totalCpuTime - before.totalCpuTime;
    return { cpuSeconds: delta, wallSeconds, aggregateCpuPct: wallSeconds > 0 ? delta / wallSeconds * 100 : null };
}

async function retainedObjectCounts({ collectGarbage = false } = {}) {
    if (collectGarbage) await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const expressions = {
        Element: 'Element.prototype',
        DocumentFragment: 'DocumentFragment.prototype',
        MutationObserver: 'MutationObserver.prototype',
        ResizeObserver: 'typeof ResizeObserver === "undefined" ? null : ResizeObserver.prototype',
        IntersectionObserver: 'typeof IntersectionObserver === "undefined" ? null : IntersectionObserver.prototype',
        Map: 'Map.prototype',
        WeakMap: 'WeakMap.prototype',
    };
    const result = {};
    for (const [label, expression] of Object.entries(expressions)) {
        const proto = await cdp.send('Runtime.evaluate', { expression, objectGroup: 'echo-retained', returnByValue: false });
        const objectId = proto.result?.objectId;
        if (!objectId || proto.result?.subtype === 'null') { result[label] = null; continue; }
        let queried;
        try { queried = await cdp.send('Runtime.queryObjects', { prototypeObjectId: objectId, objectGroup: 'echo-retained' }); } catch { result[label] = null; continue; }
        const qid = queried.objects?.objectId;
        if (!qid) { result[label] = null; continue; }
        const fn = label === 'Element'
            ? 'function(){ let detached=0; for (const x of this) if (x && !x.isConnected) detached++; return {total:this.length,detached}; }'
            : 'function(){ return {total:this.length}; }';
        const counted = await cdp.send('Runtime.callFunctionOn', { objectId: qid, functionDeclaration: fn, returnByValue: true, silent: true });
        result[label] = counted.result?.value ?? null;
    }
    await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'echo-retained' }).catch(() => {});
    return result;
}

async function detachedDomCount() {
    try {
        await cdp.send('DOM.enable');
        const result = await cdp.send('DOM.getDetachedDomNodes', { includeWhitespace: 'none' });
        return { supported: true, count: result.detachedNodes?.length ?? 0 };
    } catch (error) {
        return { supported: false, error: String(error) };
    }
}

async function runtimeSnapshot({ retained = false, collectGarbage = false } = {}) {
    const [metrics, dom, cpu, echo, audit] = await Promise.all([
        perfMetrics(),
        domCounters(),
        processCpuSnapshot(),
        page.evaluate(() => window.EchoPerformance?.profile?.({ includeRuntimeStats: true }) ?? null),
        page.evaluate(() => window.__echoRuntimeAudit ? structuredClone(window.__echoRuntimeAudit) : null),
    ]);
    const snap = { at: Date.now(), metrics, dom, cpu, echo, audit };
    if (retained) {
        snap.retained = await retainedObjectCounts({ collectGarbage });
        snap.detachedDom = await detachedDomCount();
    }
    return snap;
}

async function setupPerformanceObservers() {
    await page.evaluate(() => {
        window.__echoPerfObs?.longTask?.disconnect?.();
        window.__echoPerfObs?.event?.disconnect?.();
        const store = window.__echoPerfObs = { longTasks: [], events: [], longTask: null, event: null };
        if (typeof PerformanceObserver !== 'undefined') {
            try {
                store.longTask = new PerformanceObserver(list => store.longTasks.push(...list.getEntries().map(e => ({ startTime: e.startTime, duration: e.duration, name: e.name }))));
                store.longTask.observe({ type: 'longtask', buffered: false });
            } catch {}
            try {
                store.event = new PerformanceObserver(list => store.events.push(...list.getEntries().map(e => ({
                    name: e.name,
                    startTime: e.startTime,
                    processingStart: e.processingStart,
                    duration: e.duration,
                    inputDelay: Math.max(0, e.processingStart - e.startTime),
                }))));
                store.event.observe({ type: 'event', buffered: false, durationThreshold: 16 });
            } catch {}
        }
    });
}

async function clearPerformanceObservers() {
    await page.evaluate(() => {
        if (!window.__echoPerfObs) return;
        window.__echoPerfObs.longTasks.length = 0;
        window.__echoPerfObs.events.length = 0;
    });
}

async function readPerformanceObservers() {
    return page.evaluate(() => ({
        longTasks: [...(window.__echoPerfObs?.longTasks || [])],
        events: [...(window.__echoPerfObs?.events || [])],
    }));
}

async function startTrace() {
    if (!RUN_TRACE) return null;
    const chunks = [];
    const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.start', {
        categories: 'devtools.timeline,v8,blink,cc,loading,disabled-by-default-devtools.timeline',
        transferMode: 'ReturnAsStream',
        options: 'sampling-frequency=10000',
    });
    return async () => {
        await cdp.send('Tracing.end');
        const event = await complete;
        if (!event.stream) return { supported: false };
        while (true) {
            const part = await cdp.send('IO.read', { handle: event.stream, size: 4 * 1024 * 1024 });
            chunks.push(part.data || '');
            if (part.eof) break;
        }
        await cdp.send('IO.close', { handle: event.stream }).catch(() => {});
        const trace = JSON.parse(chunks.join(''));
        return { supported: true, ...aggregateTrace(trace.traceEvents || []) };
    };
}

function aggregateTrace(events) {
    const totals = { scriptingMs: 0, styleMs: 0, layoutMs: 0, paintMs: 0, compositeMs: 0, imageDecodeMs: 0, gcMs: 0, runTaskMs: 0 };
    const names = {};
    for (const e of events) {
        if (e.ph !== 'X' || !Number.isFinite(e.dur)) continue;
        const ms = e.dur / 1000;
        const name = String(e.name || '');
        names[name] = (names[name] || 0) + ms;
        if (/FunctionCall|EvaluateScript|TimerFire|EventDispatch|v8\.execute/i.test(name)) totals.scriptingMs += ms;
        if (/RecalculateStyles|RecalculateStyle|UpdateLayoutTree|StyleRecalc/i.test(name)) totals.styleMs += ms;
        if (/^Layout$|LayoutTree|LayoutObjects/i.test(name)) totals.layoutMs += ms;
        if (/^Paint$|PrePaint|PaintImage/i.test(name)) totals.paintMs += ms;
        if (/CompositeLayers|Layerize|Commit|RasterTask/i.test(name)) totals.compositeMs += ms;
        if (/Decode.?Image|ImageDecode/i.test(name)) totals.imageDecodeMs += ms;
        if (/(?:^|\.)GC|MinorGC|MajorGC|V8\.GC|BlinkGC/i.test(name)) totals.gcMs += ms;
        if (/RunTask|ThreadControllerImpl::RunTask/i.test(name)) totals.runTaskMs += ms;
    }
    const topEvents = Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([name, ms]) => ({ name, ms }));
    return { eventCount: events.length, totals, topEvents };
}

async function action(label, fn, bucket) {
    const before = performance.now();
    let ok = true;
    let error = null;
    try { await fn(); } catch (e) { ok = false; error = String(e?.stack || e); }
    bucket.push({ label, ms: performance.now() - before, ok, error });
}

async function foregroundChain() {
    const actions = [];
    const chat = page.locator('#chat');
    const box = await chat.boundingBox();
    if (!box) throw new Error('#chat has no bounding box');
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(300, box.height / 2));

    await action('continuous-scroll', async () => {
        for (let i = 0; i < 24; i++) { await page.mouse.wheel(0, -550); await page.waitForTimeout(18); }
    }, actions);
    await action('fast-up-scroll', async () => {
        for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, -1200); await page.waitForTimeout(8); }
    }, actions);
    await action('slow-scroll', async () => {
        for (let i = 0; i < 24; i++) { await page.mouse.wheel(0, 180); await page.waitForTimeout(45); }
    }, actions);
    await action('return-bottom', async () => page.evaluate(() => {
        const c = document.querySelector('#chat');
        c.scrollTo({ top: c.scrollHeight, behavior: 'auto' });
        c.dispatchEvent(new Event('scroll'));
    }), actions);
    await action('open-sidebar', async () => {
        const target = page.locator('#leftNavDrawerIcon, #rightNavDrawerIcon').first();
        if (await target.count()) await target.click();
    }, actions);
    await action('open-extensions-page', async () => {
        const target = page.locator('#extensions_settings, #extensions_settings2').first();
        if (await target.count()) await target.scrollIntoViewIfNeeded();
    }, actions);
    await action('click-menu', async () => {
        const btn = page.locator('#extensionsMenuButton');
        if (await btn.count() && await btn.isVisible()) await btn.click();
    }, actions);
    await action('textarea-focus-and-input', async () => {
        const input = page.locator('#send_textarea');
        await input.focus();
        await input.fill('Echo latency probe');
    }, actions);
    await action('continuous-type', async () => {
        const input = page.locator('#send_textarea');
        await input.pressSequentially(' 0123456789 abcdefghijklmnopqrstuvwxyz', { delay: 8 });
    }, actions);
    await action('edit-old-message', async () => {
        await page.evaluate(() => {
            const c = document.querySelector('#chat');
            c.scrollTop = Math.max(0, c.scrollHeight * 0.2);
            c.dispatchEvent(new Event('scroll'));
        });
        await page.waitForTimeout(500);
        const edit = page.locator('#chat > .mes .mes_edit').first();
        if (!(await edit.count())) throw new Error('no editable message control');
        await edit.click();
        const ta = page.locator('.edit_textarea, #curEditTextarea').first();
        await ta.waitFor({ state: 'visible', timeout: 5000 });
        const old = await ta.inputValue();
        await ta.fill(`${old} `);
    }, actions);
    await action('save-edit', async () => {
        const done = page.locator('.mes_edit_done').first();
        if (await done.count()) await done.click();
        else await page.keyboard.press('Control+Enter');
    }, actions);
    await action('swipe', async () => {
        const result = await page.evaluate(async () => {
            const context = SillyTavern.getContext();
            const { SWIPE_DIRECTION, SWIPE_SOURCE } = await import('/scripts/constants.js');
            const target = context.chat.findIndex((m, i) => i > 5 && Array.isArray(m?.swipes) && m.swipes.length > 1);
            if (target < 0) return { supported: false };
            const before = Number(context.chat[target].swipe_id || 0);
            const desired = before === 0 ? 1 : 0;
            const direction = desired > before ? SWIPE_DIRECTION.RIGHT : SWIPE_DIRECTION.LEFT;
            await context.swipe.to(null, direction, {
                source: SWIPE_SOURCE.SWIPE_PICKER,
                repeated: false,
                forceMesId: target,
                forceSwipeId: desired,
                forceDuration: 0,
            });
            return { supported: true, target, before, after: context.chat[target].swipe_id };
        });
        if (result.supported === false) throw new Error('fixture has no swipe target');
    }, actions);
    await action('reasoning-collapse-expand', async () => {
        await page.evaluate(() => {
            const c = document.querySelector('#chat');
            c.scrollTop = 0;
            c.dispatchEvent(new Event('scroll'));
        });
        await page.waitForTimeout(600);
        const r = page.locator('#chat .mes_reasoning_header, #chat .mes_reasoning_header_title').first();
        if (!(await r.count())) throw new Error('no reasoning header');
        await r.click();
        await page.waitForTimeout(60);
        await r.click();
    }, actions);
    await action('ctrl-f', async () => {
        await page.keyboard.press('Control+F');
        await page.waitForTimeout(80);
    }, actions);
    await action('escape', async () => page.keyboard.press('Escape'), actions);
    await action('continue-input', async () => {
        const input = page.locator('#send_textarea');
        await input.focus();
        await input.fill('/echo EchoPerformanceProbe');
    }, actions);
    await action('send-probe', async () => {
        const input = page.locator('#send_textarea');
        await input.press('Enter');
        await page.waitForTimeout(120);
    }, actions);

    if (STACK_KIND === 'real') {
        await action('styled-hover', async () => {
            const m = page.locator('#chat > .mes').last();
            if (await m.count()) await m.hover();
            await page.waitForTimeout(120);
        }, actions);
        await action('styled-drawer', async () => {
            const d = page.locator('.inline-drawer-toggle').first();
            if (await d.count() && await d.isVisible()) await d.click();
            await page.waitForTimeout(100);
        }, actions);
        await action('styled-popup-floating-animation', async () => {
            const candidates = page.locator('.floating, .floating-button, [class*="floating"], [class*="orb"]');
            for (let i = 0; i < Math.min(await candidates.count(), 20); i++) {
                const el = candidates.nth(i);
                if (await el.isVisible().catch(() => false)) {
                    await el.hover().catch(() => {});
                    break;
                }
            }
            await page.waitForTimeout(300);
        }, actions);
    }
    return actions;
}

async function benchmarkForeground() {
    await clearPerformanceObservers();
    await page.evaluate(() => window.EchoPerformance?.profileReset?.());
    const before = await runtimeSnapshot();
    const traceStop = await startTrace();
    const started = Date.now();
    const actions = await foregroundChain();
    const elapsedSeconds = (Date.now() - started) / 1000;
    const after = await runtimeSnapshot();
    const observed = await readPerformanceObservers();
    const trace = traceStop ? await traceStop() : null;
    const longTasks = observed.longTasks;
    const inputDelays = observed.events.map(x => x.inputDelay).filter(Number.isFinite);
    return {
        elapsedSeconds,
        actions,
        before,
        after,
        delta: deltaMetrics(before.metrics, after.metrics),
        cpu: cpuDelta(before.cpu, after.cpu, elapsedSeconds),
        longTasks: {
            count: longTasks.length,
            totalMs: longTasks.reduce((a, b) => a + b.duration, 0),
            maxMs: longTasks.reduce((m, x) => Math.max(m, x.duration), 0),
            samples: longTasks.slice(-120),
        },
        inputDelay: {
            samples: inputDelays.length,
            maxMs: inputDelays.length ? Math.max(...inputDelays) : null,
            p95Ms: percentile(inputDelays, .95),
            events: observed.events.slice(-160),
        },
        trace,
    };
}

function percentile(values, p) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

async function benchmarkIdle() {
    if (!RUN_IDLE) return null;
    await page.evaluate(() => window.EchoPerformance?.profileReset?.());
    const start = await runtimeSnapshot();
    const samples = [];
    let previous = 0;
    for (const point of IDLE_POINTS) {
        await page.waitForTimeout(Math.max(0, point - previous) * 1000);
        const snap = await runtimeSnapshot();
        samples.push({
            seconds: point,
            snapshot: snap,
            fromStart: deltaMetrics(start.metrics, snap.metrics),
            cpuFromStart: cpuDelta(start.cpu, snap.cpu, point),
        });
        previous = point;
    }
    return { start, samples };
}

async function memorySwitchCycle(fixtureFile, expected, sentinelFile) {
    if (!RUN_MEMORY_CYCLE) return null;
    const before = await runtimeSnapshot({ retained: true, collectGarbage: true });
    await foregroundChain();
    const afterUse = await runtimeSnapshot({ retained: true, collectGarbage: false });
    await page.evaluate(async file => {
        const s = await import('/script.js');
        await s.openCharacterChat(file);
    }, sentinelFile);
    await page.waitForTimeout(500);
    const afterSwitchGc = await runtimeSnapshot({ retained: true, collectGarbage: true });
    await page.evaluate(async ({ file, expected }) => {
        const s = await import('/script.js');
        await s.openCharacterChat(file);
        if (s.chat.length !== expected) throw new Error('heavy fixture reopen length mismatch');
    }, { file: fixtureFile, expected });
    await page.waitForTimeout(500);
    const afterReturnGc = await runtimeSnapshot({ retained: true, collectGarbage: true });
    await page.evaluate(async file => {
        const s = await import('/script.js');
        await s.openCharacterChat(file);
    }, sentinelFile);
    await page.waitForTimeout(500);
    const afterSecondSwitchGc = await runtimeSnapshot({ retained: true, collectGarbage: true });
    return { before, afterUse, afterSwitchGc, afterReturnGc, afterSecondSwitchGc };
}

async function writeProgress(report) {
    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
}

await cdp.send('Performance.enable');
await cdp.send('HeapProfiler.enable').catch(() => {});
await cdp.send('Runtime.enable').catch(() => {});

const report = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    stUrl: ST_URL,
    stackKind: STACK_KIND,
    browser: await browser.version(),
    viewport: VIEWPORT,
    diagnosticHooks: DIAGNOSTIC_HOOKS,
    traceEnabled: RUN_TRACE,
    idlePoints: RUN_IDLE ? IDLE_POINTS : [],
    methodology: {
        fixtureLoad: 'Exact JSONL fixture is saved once through SillyTavern /api/chats/save, then benchmark timings use SillyTavern openCharacterChat. Fixture construction/setup is excluded from load timings.',
        cpu: 'Performance.TaskDuration measures renderer main-thread busy time. SystemInfo.getProcessInfo aggregate cpuTime, when supported, is reported separately and may exceed 100% because Chrome is multi-process.',
        retainedObjects: 'Runtime.queryObjects diagnostics count reachable JS wrappers by prototype after optional forced GC; they are diagnostics, not byte-accurate heap attribution.',
        trace: 'Trace category buckets are supplemental. ScriptDuration/LayoutDuration/RecalcStyleDuration from CDP Performance metrics are the primary timing counters.',
        duplicatedFixtures: 'long-dom-1036/1295 duplicate only the 259 original message records. They are valid for long-DOM/UI tests only and MUST NOT be interpreted as naturally evolved World Backstage state.',
    },
    stackHealth: null,
    fixtures: {},
    cases: [],
    errors,
};

try {
    await waitForApp();
    report.stackHealth = await stackHealth();
    assert.equal(report.stackHealth.globals.EchoPerformance, true);
    if (STACK_KIND === 'real') {
        if (!report.stackHealth.globals.TavernHelper) errors.push({ type: 'stack-health', message: 'TavernHelper global not detected' });
        if (!report.stackHealth.globals.EjsTemplate) errors.push({ type: 'stack-health', message: 'EjsTemplate global not detected' });
        if (!report.stackHealth.worldBackstageTextMarker && !report.stackHealth.globals.WorldBackstageInterceptor) errors.push({ type: 'stack-health', message: 'World Backstage marker not detected' });
    }
    await ensureBenchCharacter();
    const sentinelFile = await ensureTinySwitchChat();
    for (const name of FIXTURE_NAMES) {
        report.fixtures[name] = await installFixture(name);
        await writeProgress(report);
    }
    await setupPerformanceObservers();

    for (const name of FIXTURE_NAMES) {
        const info = report.fixtures[name];
        for (const theme of THEMES) {
            const themeState = await applyTheme(theme);
            for (const mode of CASE_MODES) {
                const echoOn = mode === 'on';
                await setEcho(echoOn);
                const loadBefore = await runtimeSnapshot();
                const loadStarted = Date.now();
                const loadMs = await openFixture(info.file, EXPECTED_MESSAGES[name]);
                const loadWallSeconds = (Date.now() - loadStarted) / 1000;
                const loadAfter = await runtimeSnapshot();
                if (echoOn && name.startsWith('long-dom')) {
                    await page.waitForFunction(() => EchoPerformance.stats().detachedChunks > 0, null, { timeout: 30_000 });
                    await page.waitForTimeout(350);
                }
                const settled = await runtimeSnapshot({ retained: true, collectGarbage: true });
                const foreground = await benchmarkForeground();
                const idle = await benchmarkIdle();
                const memoryCycle = name === 'real-heavy-259'
                    ? await memorySwitchCycle(info.file, EXPECTED_MESSAGES[name], sentinelFile)
                    : null;
                report.cases.push({
                    fixture: name,
                    messages: EXPECTED_MESSAGES[name],
                    stack: STACK_KIND,
                    theme: themeState,
                    echo: echoOn ? 'ON' : 'OFF',
                    load: {
                        ms: loadMs,
                        wallSeconds: loadWallSeconds,
                        before: loadBefore,
                        after: loadAfter,
                        delta: deltaMetrics(loadBefore.metrics, loadAfter.metrics),
                        cpu: cpuDelta(loadBefore.cpu, loadAfter.cpu, loadWallSeconds),
                    },
                    settled,
                    foreground,
                    idle,
                    memoryCycle,
                });
                await writeProgress(report);
            }
        }
    }
    report.completed = true;
    report.completedAt = new Date().toISOString();
    await writeProgress(report);
} finally {
    await browser.close();
}
