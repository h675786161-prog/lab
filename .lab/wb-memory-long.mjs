import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const candidate = await import(pathToFileURL(path.resolve('wb-candidate/core.js')));
const baseline = await import(pathToFileURL(path.resolve('wb-baseline/core.js')));
const fixtures = JSON.parse(await fs.readFile('.lab/wb-memory-fixtures.json', 'utf8'));
const out = 'bench-evidence/wb-long-memory';
await fs.mkdir(out, { recursive: true });

const key = process.env.LAB_MODEL_KEY;
const baseUrl = process.env.LAB_MODEL_BASE_URL;
const model = process.env.LAB_MODEL_ID || 'gemini-2.5-flash-lite';
if (!key || !baseUrl) throw new Error('LAB model connection is unavailable');
let lastRequestAt = 0;
async function ask(messages) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const wait = Math.max(0, lastRequestAt + (attempt ? 60_000 * attempt : 20_000) - Date.now());
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST', signal: AbortSignal.timeout(150_000),
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, max_tokens: 750, temperature: 0.1,
                thinking: { type: 'disabled' }, stream: false }),
        });
        lastRequestAt = Date.now();
        if (response.status === 429 && attempt < 2) continue;
        if (!response.ok) throw new Error(`LAB model HTTP ${response.status}`);
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text?.trim()) throw new Error('LAB model returned no final answer');
        return { text, usage: data.usage, model: data.model };
    }
    throw new Error('LAB model rate limit did not clear');
}

// Hand-authored 121-floor continuity stress case. The L0 and rollups below are
// deterministic, allowing model recall to be compared without archive variance.
const lines = Array.from({ length: 121 }, (_, id) => `第${id}层：圣堂里的日常对话。`);
lines[0] = '我初到圣堂，跨门槛时踢歪了门垫。';
lines[1] = '伊莱恩先扶正烛台，再捡起信封。';
lines[2] = '我交出银书签，取回的暗号是“晚钟九号”。';
lines[4] = '我拿回银书签，转交守门人苏姨保管。';
lines[72] = '我从苏姨处取回银书签，转交修书匠乔保管。';
lines[73] = '伊莱恩确认现在由乔保管银书签。';
lines[90] = '原定周六上午十点的见面改为周日正午，敲门改成一长两短。';
lines[91] = '伊莱恩确认新的时间与敲门节奏。';
lines[120] = '最初门口我弄歪了什么？银书签取回暗号是什么？银书签现在由谁保管？改约后何时见面、怎么敲门？伊莱恩初见时先后做了什么？';
const history = lines.map((content, id) => ({ id, role: id % 2 ? 'assistant' : 'user', content }));

let state = candidate.createInitialState();
const rollups = [];
for (let start = 0; start < history.length; start += 12) {
    const end = Math.min(start + 12, history.length);
    const summaries = history.slice(start, end).flatMap(turn => turn.id === 50
        ? [] : [{ source_message_id: turn.id, summary: turn.content }]);
    state = candidate.applyHistoryIndexResult(state, {
        memory_digest: { text: start < 72
            ? '玩家在圣堂交出了银书签，后来转交苏姨。'
            : '玩家最初进入圣堂；银书签后来转交修书匠乔。约见改为周日正午，敲门一长两短。' },
        turn_summaries: summaries,
        facts_upsert: start === 0 ? [
            { key: '银书签:保管人', subject: '银书签', predicate: '保管人', value: '苏姨', visibility: 'known' },
        ] : start === 72 ? [
            { key: '银书签:保管人', subject: '银书签', predicate: '保管人', value: '修书匠乔', visibility: 'known' },
        ] : [],
    }, { startMessageId: start, endMessageId: end - 1 });
    let plan;
    while ((plan = candidate.planMemoryRollup(state))) {
        rollups.push({ level: plan.sourceLevel, first: plan.summaries[0].startMessageId,
            last: plan.summaries.at(-1).endMessageId });
        state = candidate.applyMemoryRollupResult(state, {
            summary_rollup: {
                title: `消息${plan.summaries[0].startMessageId}—${plan.summaries.at(-1).endMessageId}`,
                summary: plan.summaries.map(item => item.summary).join('；').slice(0, 1100),
            },
        }, plan);
    }
}

const question = '只输出JSON。first_action=玩家最初在门口弄歪了什么；npc_action_order=伊莱恩初见的两个动作顺序；password=银书签取回暗号；holder=银书签最新保管人；appointment=改约后的见面时间；knock=改约后的敲门节奏。正文证据不足填“未知”，不得凭角色设定补写。';
const settings = { enabled: true, worldSimulationEnabled: false,
    memorySystemEnabled: true, injectionMemory: true };
const packet = candidate.buildInjectionPackage(state, settings, question);
const oldPacket = baseline.buildInjectionPackage(state, settings, question);
await fs.writeFile(`${out}/fixture.json`, JSON.stringify({
    floors: history.length, omittedL0: 50, rollups, digest: state.storyMemory.digest.text,
    candidateInjection: packet.text, baselineInjection: oldPacket.text,
    scope: 'Hand-authored 121-floor L0 and deterministic rollups; real ST UI checked by world-backstage runtime smoke',
}, null, 2));
const required = ['门垫', '烛台', '信封', '晚钟九号', '修书匠乔', '周日正午', '一长两短'];
for (const term of required) {
    if (!packet.text.includes(term)) throw new Error(`Candidate injection lost ${term}`);
}
if (packet.text.includes('消息50') || packet.text.length > 4200 || rollups.length < 8) {
    throw new Error('Long-floor hierarchy or prompt budget was not exercised');
}
const system = `成人角色资料：${JSON.stringify(fixtures.cards[1].context)}\n` +
    `预设中的四条已启用规则：${fixtures.preset.rules.map(rule => rule.content).join('\n')}\n` +
    '本轮是正文记忆核对，只输出问题要求的JSON。';
const recent = history.slice(-5).map(({ role, content }) => ({ role, content }));
const results = [];
try {
    for (const [variant, injection] of [['recent_only', ''], ['baseline', oldPacket.text], ['candidate', packet.text]]) {
        const messages = [{ role: 'system', content: system }, ...recent];
        if (injection) messages.push({ role: 'system', content: injection });
        messages.push({ role: 'user', content: question });
        const response = await ask(messages);
        const answer = candidate.extractJsonObject(response.text) || {};
        const normalized = value => String(value || '').replace(/[\s，。、“”]/g, '');
        const order = normalized(answer.npc_action_order);
        const checks = {
            first_action: normalized(answer.first_action).includes('门垫'),
            npc_action_order: order.includes('烛台') && order.includes('信封')
                && order.indexOf('烛台') < order.indexOf('信封'),
            password: normalized(answer.password).includes('晚钟九号'),
            holder: /乔/.test(normalized(answer.holder)) && !/苏姨/.test(normalized(answer.holder)),
            appointment: normalized(answer.appointment).includes('周日正午'),
            knock: normalized(answer.knock).includes('一长两短'),
        };
        results.push({ variant, answer, checks, response });
        await fs.writeFile(`${out}/results.json`, JSON.stringify({ model, floors: history.length, results }, null, 2));
        console.log(JSON.stringify({ variant, answer, checks }));
    }
} finally {
    await fs.writeFile(`${out}/summary.json`, JSON.stringify({ model, floors: history.length,
        completedVariants: results.length, expectedVariants: 3 }, null, 2));
}
