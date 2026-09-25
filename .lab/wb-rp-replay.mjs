import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const core = await import(pathToFileURL(path.resolve('wb-candidate/core.js')));
const progress = JSON.parse(await fs.readFile('bench-evidence/wb-rp-source/progress.json', 'utf8'));
const out = 'bench-evidence/wb-rp-replay';
await fs.mkdir(out, { recursive: true });
const key = process.env.LAB_MODEL_KEY;
const endpoint = process.env.LAB_MODEL_BASE_URL;
const model = process.env.LAB_MODEL_ID || 'gemini-2.5-flash-lite';
if (!key || !endpoint) throw new Error('GG model credentials are missing');
if (progress.chat.length !== 120 || progress.state.storyMemory.indexedThroughMessageId !== 119) {
    throw new Error('Original live RP run did not complete 120 indexed floors');
}
const question = '现在暂停剧情，仅核对已经发生的正文事实，输出 JSON：opening=玩家初入圣堂踢歪了什么；order=玩家最初在门口先扶好什么、随后拾起什么；password=取回银书签的暗号；holder=当前银书签由谁保管；appointment=最新约见时间；knock=最新敲门节奏。无法从正文确认就填“未知”。';
const settings = { enabled: true, worldSimulationEnabled: false,
    memorySystemEnabled: true, injectionMemory: true };
const injection = core.buildInjectionPackage(progress.state, settings, question).text;
const required = ['门垫', '烛台', '信封', '晚钟九号', '乔', '周日正午', '一长两短'];
for (const item of required) {
    if (!injection.includes(item)) throw new Error(`Revised prompt omitted ${item}`);
}
if (injection.length > 4200) throw new Error('Revised prompt exceeded context budget');
const checks = answer => {
    const string = key => String(answer[key] || '');
    const order = string('order');
    return {
        opening: /门垫/.test(string('opening')),
        order: /烛台/.test(order) && /信封/.test(order)
            && order.indexOf('烛台') < order.indexOf('信封'),
        password: /晚钟九号/.test(string('password')),
        holder: /乔/.test(string('holder')) && !/苏姨/.test(string('holder')),
        appointment: /周日正午/.test(string('appointment')),
        knock: /一长两短/.test(string('knock')),
    };
};
const replies = [];
for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, 20_000));
    const messages = [
        { role: 'system', content: '你只据角色卡和提供的正文事实回答；不要猜测。' },
        { role: 'system', content: injection },
        ...progress.chat.slice(-5).map(({ role, content }) => ({ role, content })),
        { role: 'user', content: question },
    ];
    let response;
    for (let retry = 0; retry < 4; retry++) {
        const result = await fetch(`${endpoint}/v1/chat/completions`, {
            method: 'POST', signal: AbortSignal.timeout(170_000),
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 600,
                thinking: { type: 'disabled' }, stream: false }),
        });
        if (result.status === 429 && retry < 3) {
            await new Promise(resolve => setTimeout(resolve, (retry + 1) * 40_000));
            continue;
        }
        if (!result.ok) throw new Error(`GG HTTP ${result.status}`);
        const data = await result.json();
        response = data.choices?.[0]?.message?.content;
        if (!response?.trim()) throw new Error('GG returned an empty reply');
        break;
    }
    const answer = core.extractJsonObject(response) || {};
    const passed = checks(answer);
    replies.push({ response, answer, checks: passed, score: Object.values(passed).filter(Boolean).length });
    await fs.writeFile(`${out}/results.json`, JSON.stringify({ model, floors: 121, sourceRun: 36136504193,
        candidateCommit: '8b99b8150d1153a0720dc48ef5ac7a8c132a5a0b',
        injection, replies }, null, 2));
    console.log(JSON.stringify({ attempt: attempt + 1, score: replies.at(-1).score, checks: passed }));
}
