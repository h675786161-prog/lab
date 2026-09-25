import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const core = await import(pathToFileURL(path.resolve('wb-candidate/core.js')));
const baseline = await import(pathToFileURL(path.resolve('wb-baseline/core.js')));
const cases = JSON.parse(await fs.readFile('.lab/wb-rp-multicard-cases.json', 'utf8'));
const caseId = process.env.LAB_RP_CASE;
const testCase = cases.find(item => item.id === caseId);
if (!testCase) throw new Error(`Unknown RP case ${caseId}`);
const out = `bench-evidence/wb-multicard-${caseId}`;
await fs.mkdir(out, { recursive: true });
const key = process.env.LAB_MODEL_KEY;
const endpoint = process.env.LAB_MODEL_BASE_URL;
const model = process.env.LAB_MODEL_ID || '[OR]deepseek-v4-flash-0731';
if (!key || !endpoint) throw new Error('Youzi model credentials are missing');
const baseUrl = endpoint.replace(/\/+$/, '');
const chatUrl = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
const limit = testCase.beats.length;
if (limit !== 40) throw new Error('Each case must contain 40 user turns');
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

const context = testCase.context;
const system = [
    `角色卡：${JSON.stringify(context)}`,
    '只扮演卡内角色、其他 NPC 与外部场景。玩家的动作、语言和内心留给玩家；已发生的玩家动作、托付、约定不随意改写。',
    '承接上一轮的现场。每轮自然回复 100 到 220 字，避免机械重述设定。角色只知道其合理获得的信息。',
].join('\n\n').replaceAll('{{user}}', '调查者').replaceAll('{{char}}', context.name || testCase.label)
    .replaceAll('{{original}}', '');
const settings = { enabled: true, worldSimulationEnabled: false,
    memorySystemEnabled: true, injectionMemory: true };
const beats = testCase.beats;
let chat = [];
let state = core.createInitialState();
const audit = [];
const resumePath = process.env.LAB_RP_RESUME_PATH;
if (resumePath) {
    const prior = JSON.parse(await fs.readFile(resumePath, 'utf8'));
    if (prior.model !== model || prior.caseId !== caseId || !Array.isArray(prior.chat) || prior.chat.length % 2
        || prior.chat.length > limit * 2 || !prior.state?.storyMemory || !Array.isArray(prior.audit)) {
        throw new Error('Invalid or incompatible RP checkpoint');
    }
    if (prior.chat.some((item, i) => item.id !== i || item.role !== (i % 2 ? 'assistant' : 'user')
        || (i % 2 === 0 && item.content !== beats[i / 2]))) {
        throw new Error('RP checkpoint does not match the scripted turns');
    }
    chat = prior.chat;
    state = prior.state;
    audit.push(...prior.audit);
    requests = prior.requests || 0;
    challenges = prior.challenges || 0;
    console.log(`Resuming RP at round ${chat.length / 2}/${limit}; indexed through ${state.storyMemory.indexedThroughMessageId}`);
}
async function save() {
    await fs.writeFile(`${out}/progress.json`, JSON.stringify({ caseId, model, round: chat.length / 2,
        chat, state, audit, requests, challenges }, null, 2));
}
async function indexPending() {
    const start = state.storyMemory.indexedThroughMessageId + 1;
    // Initial state uses -1 on most versions; source ids always start at zero.
    const from = audit.some(entry => entry.kind === 'index') ? start : 0;
    if (from >= chat.length) return;
    const batch = chat.slice(from);
    const messages = batch.map(({ id, role, content }) => ({ id, role, content, swipe: 0 }));
    let payload;
    for (let retry = 0; retry < 2; retry++) {
        const prompt = core.buildHistoryIndexPrompt(state, { messages, userName: '调查者', compact: retry > 0 });
        const answer = await ask([{ role: 'user', content: prompt }], retry ? 3300 : 4400, 0.15);
        payload = core.extractJsonObject(answer);
        const covered = new Set(payload?.turn_summaries?.filter(item => item?.summary?.trim())
            .map(item => Number(item.source_message_id)) || []);
        if (messages.every(item => covered.has(item.id))) break;
        if (retry === 1) throw new Error(`Missing model L0 at floors ${messages.filter(item => !covered.has(item.id)).map(item => item.id).join(',')}`);
    }
    state = core.applyHistoryIndexResult(state, payload, { startMessageId: from,
        endMessageId: chat.length - 1 });
    audit.push({ kind: 'index', from, to: chat.length - 1, digest: state.storyMemory.digest.text,
        modelPayload: payload });
    let plan;
    while ((plan = core.planMemoryRollup(state))) {
        const prompt = core.buildMemoryRollupPrompt(state, plan);
        const answer = await ask([{ role: 'user', content: prompt }], 1900, 0.15);
        const rollup = core.extractJsonObject(answer);
        if (!rollup?.summary_rollup?.summary?.trim()) throw new Error('Model rollup was empty');
        state = core.applyMemoryRollupResult(state, rollup, plan);
        audit.push({ kind: 'rollup', level: plan.sourceLevel, range: [plan.summaries[0].startMessageId,
            plan.summaries.at(-1).endMessageId], modelPayload: rollup });
    }
    await save();
}

try {
    if (chat.length && state.storyMemory.indexedThroughMessageId < chat.length - 1) {
        await indexPending();
        console.log(`Recovered pending archive through floor ${chat.length - 1}`);
    }
    for (let round = chat.length / 2; round < limit; round++) {
        const user = { id: chat.length, role: 'user', content: beats[round] };
        chat.push(user);
        const injection = core.buildInjectionPackage(state, settings, user.content).text;
        const messages = [{ role: 'system', content: system }];
        if (injection) messages.push({ role: 'system', content: injection });
        messages.push(...chat.slice(-5).map(({ role, content }) => ({ role, content })));
        const response = await ask(messages, 950, 0.65);
        chat.push({ id: chat.length, role: 'assistant', content: response });
        if ((round + 1) % 5 === 0 || round + 1 === limit) {
            await indexPending();
            console.log(`Archived RP round ${round + 1}/${limit}; floors ${chat.length}; requests ${requests}`);
        }
    }
    const question = testCase.question;
    const variants = [
        ['recent_only', ''],
        ['baseline', baseline.buildInjectionPackage(state, settings, question).text],
        ['candidate_1', core.buildInjectionPackage(state, settings, question).text],
        ['candidate_2', core.buildInjectionPackage(state, settings, question).text],
        ['candidate_3', core.buildInjectionPackage(state, settings, question).text],
    ];
    const expected = testCase.expected;
    const matches = (actual, needle) => String(actual || '').includes(needle);
    const asText = value => typeof value === 'string' ? value : JSON.stringify(value || '');
    const answers = [];
    for (const [variant, injection] of variants) {
        const messages = [{ role: 'system', content: '你只据角色卡和提供的正文事实回答；不要猜测。' }];
        if (injection) messages.push({ role: 'system', content: injection });
        messages.push(...chat.slice(-5).map(({ role, content }) => ({ role, content })));
        messages.push({ role: 'user', content: question });
        const response = await ask(messages, 600, 0.1);
        const parsed = core.extractJsonObject(response) || {};
        const order = asText(parsed.order);
        const pass = {
            opening: matches(asText(parsed.opening), expected.opening),
            order: order.includes(expected.first) && order.includes(expected.second)
                && order.indexOf(expected.first) < order.indexOf(expected.second),
            password: matches(asText(parsed.password), expected.password),
            holder: matches(asText(parsed.holder), expected.holder)
                && !matches(asText(parsed.holder), expected.oldHolder),
            appointment: matches(asText(parsed.appointment), expected.appointment),
            knock: matches(asText(parsed.knock), expected.knock),
        };
        answers.push({ variant, response, parsed, checks: pass, score: Object.values(pass).filter(Boolean).length,
            injectionLength: injection.length });
        await fs.writeFile(`${out}/answers.json`, JSON.stringify({ floors: chat.length + 1,
            caseId, model, answers, question, expected }, null, 2));
    }
    await fs.writeFile(`${out}/final.json`, JSON.stringify({ floors: chat.length + 1,
        caseId, model, rounds: limit, requests, challenges, summaries: state.storyMemory.summaries.length,
        rollups: audit.filter(item => item.kind === 'rollup').length,
        indexedThrough: state.storyMemory.indexedThroughMessageId,
        answers: answers.map(({ variant, checks: pass, score, injectionLength }) => ({
            variant, checks: pass, score, injectionLength })),
        scope: 'Three independent 40-round cases, scripted player inputs per card; live Youzi-generated assistant turns and model-generated indexing/rollups; core injection; no ST UI in this job',
    }, null, 2));
    console.log(JSON.stringify(answers.map(({ variant, score, checks: pass }) => ({ variant, score, checks: pass }))));
} catch (error) {
    await save();
    throw error;
}
