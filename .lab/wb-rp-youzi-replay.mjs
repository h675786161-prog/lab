import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const core = await import(pathToFileURL(path.resolve('wb-candidate/core.js')));
const progress = JSON.parse(await fs.readFile('bench-evidence/wb-youzi-source/progress.json', 'utf8'));
const out = 'bench-evidence/wb-youzi-replay';
await fs.mkdir(out, { recursive: true });
if (progress.chat.length !== 120 || progress.state.storyMemory.indexedThroughMessageId !== 119) {
    throw new Error('Source RP did not complete 120 indexed floors');
}
const question = '现在暂停剧情，仅核对已经发生的正文事实，输出 JSON：opening=玩家初入圣堂踢歪了什么；order=玩家最初在门口先扶好什么、随后拾起什么；password=取回银书签的暗号；holder=当前银书签由谁保管；appointment=最新约见时间；knock=最新敲门节奏。无法从正文确认就填“未知”。';
const settings = { enabled: true, worldSimulationEnabled: false, memorySystemEnabled: true, injectionMemory: true };
const injection = core.buildInjectionPackage(progress.state, settings, question).text;
for (const item of ['门垫', '烛台', '信封', '晚钟九号', '乔', '周日正午', '一长两短']) {
    if (!injection.includes(item)) throw new Error(`Revised prompt omitted ${item}`);
}
if (injection.length > 4200) throw new Error('Revised prompt exceeded context budget');
const key = process.env.LAB_MODEL_KEY;
const endpoint = process.env.LAB_MODEL_BASE_URL?.replace(/\/+$/, '');
const model = process.env.LAB_MODEL_ID || 'agnes-3.0-flash';
if (!key || !endpoint) throw new Error('Youzi credentials are missing');
const url = `${endpoint}${endpoint.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
let lastRequest = 0, requests = 0, challenges = 0;
async function ask(messages) {
    for (let retry = 0; retry < 10; retry++) {
        const delay = Math.max(0, lastRequest + 4_500 - Date.now());
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        let response;
        try {
            response = await fetch(url, {
                method: 'POST', signal: AbortSignal.timeout(170_000),
                headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
                    'User-Agent': 'SillyTavern/1.18.0' },
                body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 600, stream: false }),
            });
        } catch (error) {
            lastRequest = Date.now();
            requests++;
            if (retry < 9 && ['TimeoutError', 'AbortError'].includes(error.name)) {
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
        }
        let data;
        try { data = JSON.parse(raw); } catch { data = {}; }
        if (response.status === 429 && data.error?.code === 'quota_exceeded') throw new Error('Quota exhausted');
        if ((response.status === 429 || [500, 502, 503, 504, 520, 522, 524].includes(response.status)) && retry < 9) {
            await new Promise(resolve => setTimeout(resolve, response.status === 429 ? 60_000 : 20_000));
            continue;
        }
        if (!response.ok) throw new Error(`Youzi HTTP ${response.status}`);
        const content = data.choices?.[0]?.message?.content;
        if (content?.trim()) return content.trim();
    }
    throw new Error('No usable Youzi reply after retries');
}
const messages = [
    { role: 'system', content: '你只据角色卡和提供的正文事实回答；不要猜测。' },
    { role: 'system', content: injection },
    ...progress.chat.slice(-5).map(({ role, content }) => ({ role, content })),
    { role: 'user', content: question },
];
const replies = [];
for (let i = 0; i < 3; i++) {
    const response = await ask(messages);
    const answer = core.extractJsonObject(response) || {};
    const field = key => String(answer[key] || '');
    const order = field('order');
    const checks = {
        opening: /门垫/.test(field('opening')),
        order: /烛台/.test(order) && /信封/.test(order) && order.indexOf('烛台') < order.indexOf('信封'),
        password: /晚钟九号/.test(field('password')),
        holder: /乔/.test(field('holder')) && !/苏姨/.test(field('holder')),
        appointment: /周日正午/.test(field('appointment')),
        knock: /一长两短/.test(field('knock')),
    };
    replies.push({ response, answer, checks, score: Object.values(checks).filter(Boolean).length });
    await fs.writeFile(`${out}/results.json`, JSON.stringify({
        sourceRun: 36166138268, candidateCommit: 'e6ad92742e486ef06d564c9c75646ff8a2d6deaf',
        model, requests, challenges, injection, replies,
        scope: 'Fixed live Youzi RP archive; only candidate injection and three model answer samples replayed',
    }, null, 2));
    console.log(JSON.stringify({ sample: i + 1, score: replies.at(-1).score, checks }));
}
