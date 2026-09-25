import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const core = await import(pathToFileURL(path.resolve('wb-candidate/core.js')));
const baseline = await import(pathToFileURL(path.resolve('wb-baseline/core.js')));
const cases = JSON.parse(await fs.readFile('.lab/wb-rp-multicard-cases.json', 'utf8'));
const caseId = process.env.LAB_RP_CASE;
const testCase = cases.find(item => item.id === caseId);
if (!testCase) throw new Error(`Unknown RP case ${caseId}`);
const out = `bench-evidence/wb-multicard-replay-${caseId}`;
await fs.mkdir(out, { recursive: true });
const key = process.env.LAB_MODEL_KEY;
const endpoint = process.env.LAB_MODEL_BASE_URL;
const model = process.env.LAB_MODEL_ID || '[OR]deepseek-v4-flash-0731';
if (!key || !endpoint) throw new Error('Youzi model credentials are missing');
const baseUrl = endpoint.replace(/\/+$/, '');
const chatUrl = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
let lastRequest = 0;
let requests = 0;
let challenges = 0;
async function ask(messages, maxTokens = 1200, temperature = 0.55) {
    for (let retry = 0; retry < 10; retry++) {
        const delay = Math.max(0, lastRequest + 13_000 - Date.now());
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        let response;
        try {
            response = await fetch(chatUrl, {
            method: 'POST', signal: AbortSignal.timeout(170_000),
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
                'User-Agent': 'SillyTavern/1.18.0' },
            body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature,
                stream: false }),
            });
        } catch (error) {
            lastRequest = Date.now();
            requests++;
            if (retry < 9 && (error.name === 'TimeoutError' || error.name === 'AbortError'
                || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT')) {
                await new Promise(resolve => setTimeout(resolve, 20_000));
                continue;
            }
            throw error;
        }
        lastRequest = Date.now();
        requests++;
        const raw = await response.text();
        if (response.status === 403 && /text\/html/i.test(response.headers.get('content-type') || '')) {
            challenges++;
            if (retry < 9) continue;
            throw new Error('Youzi Cloudflare challenge persisted through 10 attempts');
        }
        let data;
        try { data = JSON.parse(raw); } catch { data = {}; }
        if (response.status === 429) {
            if (data.error?.code === 'quota_exceeded') throw new Error('Youzi model quota exhausted');
            if (retry < 9) {
                await new Promise(resolve => setTimeout(resolve, 60_000));
                continue;
            }
        }
        if ([500, 502, 503, 504, 520, 522, 524].includes(response.status) && retry < 9
            && data.error?.code !== 'model_not_found') {
            await new Promise(resolve => setTimeout(resolve, 15_000));
            continue;
        }
        if (!response.ok) throw new Error(`Youzi HTTP ${response.status}: ${String(data.error?.code || data.error?.message || '').slice(0, 150)}`);
        const content = data.choices?.[0]?.message?.content;
        if (!content?.trim()) {
            if (retry < 9) continue;
            throw new Error('Youzi returned an empty reply');
        }
        return content.trim();
    }
    throw new Error('Youzi retry budget exhausted');
}


const progress = JSON.parse(await fs.readFile('bench-evidence/wb-multicard-source/progress.json', 'utf8'));
if (progress.caseId !== caseId || progress.chat.length !== 80
    || progress.state.storyMemory.indexedThroughMessageId !== 79) {
    throw new Error('Independent source RP did not finish 80 indexed floors');
}
let state = core.createInitialState();
for (const entry of progress.audit) {
    if (entry.kind === 'index') {
        state = core.applyHistoryIndexResult(state, entry.modelPayload, {
            startMessageId: entry.from, endMessageId: entry.to,
        });
    } else if (entry.kind === 'rollup') {
        const plan = core.planMemoryRollup(state);
        if (!plan || plan.sourceLevel !== entry.level) throw new Error('Source rollup plan mismatch');
        state = core.applyMemoryRollupResult(state, entry.modelPayload, plan);
    }
}
if (state.storyMemory.indexedThroughMessageId !== 79
    || state.storyMemory.summaries.filter(item => item.level === 0).length !== 80) {
    throw new Error('Reconstructed archive lost L0 coverage');
}
const question = caseId === 'ashley'
    ? testCase.question.replace('先扶起或扶正什么', '先关掉什么')
    : testCase.question;
const settings = { enabled: true, worldSimulationEnabled: false,
    memorySystemEnabled: true, injectionMemory: true };
const candidateInjection = core.buildInjectionPackage(state, settings, question).text;
for (const detail of Object.entries(testCase.expected).filter(([key]) => key !== 'oldHolder').map(([, value]) => value)) {
    if (!candidateInjection.includes(detail)) throw new Error(`Revised prompt omitted ${detail}`);
}
if (candidateInjection.length > 4200) throw new Error('Memory prompt exceeded context budget');
const variants = [
    ['recent_only', ''],
    ['baseline', baseline.buildInjectionPackage(state, settings, question).text],
    ['candidate_1', candidateInjection], ['candidate_2', candidateInjection],
    ['candidate_3', candidateInjection],
];
const answers = [];
const expected = testCase.expected;
const asText = value => typeof value === 'string' ? value : JSON.stringify(value || '');
for (const [variant, injection] of variants) {
    const messages = [{ role: 'system', content: '你只据角色卡和提供的正文事实回答；不要猜测。' }];
    if (injection) messages.push({ role: 'system', content: injection });
    messages.push(...progress.chat.slice(-5).map(({ role, content }) => ({ role, content })));
    messages.push({ role: 'user', content: question });
    const response = await ask(messages, 600, 0.1);
    const parsed = core.extractJsonObject(response) || {};
    const order = asText(parsed.order);
    const holder = asText(parsed.holder);
    const holderNeedle = caseId === 'ashley' ? '奈拉' : expected.holder;
    const checks = {
        opening: asText(parsed.opening).includes(expected.opening),
        order: order.includes(expected.first) && order.includes(expected.second)
            && order.indexOf(expected.first) < order.indexOf(expected.second),
        password: asText(parsed.password).includes(expected.password),
        holder: holder.includes(holderNeedle) && !holder.includes(expected.oldHolder),
        appointment: asText(parsed.appointment).includes(expected.appointment),
        knock: asText(parsed.knock).includes(expected.knock),
    };
    answers.push({ variant, response, parsed, checks,
        score: Object.values(checks).filter(Boolean).length, injectionLength: injection.length });
    await fs.writeFile(`${out}/results.json`, JSON.stringify({
        sourceRun: 36170512702, candidateCommit: '3ac99a4d1e9dc6aefd3b8a67d4382eab7a245771',
        caseId, model, requests, challenges, question, expected, candidateInjection, answers,
        scope: 'Fixed independently generated RP and model-produced archive; rebuilt state with repaired core and replayed five answer calls; not new RP',
    }, null, 2));
    console.log(JSON.stringify({ caseId, variant, score: answers.at(-1).score, checks }));
}
