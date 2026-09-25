import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const candidate = await import(pathToFileURL(path.resolve('wb-candidate/core.js')));
const baseline = await import(pathToFileURL(path.resolve('wb-baseline/core.js')));
const fixtures = JSON.parse(await fs.readFile('.lab/wb-memory-fixtures.json', 'utf8'));
const out = 'bench-evidence/wb-memory';
await fs.mkdir(out, { recursive: true });
const key = process.env.LAB_MODEL_KEY;
const baseUrl = process.env.LAB_MODEL_BASE_URL;
if (!key || !baseUrl) throw new Error('Configured LAB model connection is unavailable');
const modelsResponse = await fetch(`${baseUrl}/v1/models`, {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(25_000),
});
if (!modelsResponse.ok) throw new Error(`LAB model list HTTP ${modelsResponse.status}`);
const modelPayload = await modelsResponse.json();
const modelList = modelPayload.data || modelPayload.models || [];
const modelIds = modelList.map(x => typeof x === 'string' ? x : x.id || x.name).filter(Boolean);
console.log(JSON.stringify({ modelCount: modelIds.length, modelIds: modelIds.slice(0, 30), responseKeys: Object.keys(modelPayload) }));
const model = process.env.LAB_MODEL_ID || modelIds.find(id => id === 'gemini-3-flash-preview')
    || modelIds.find(id => /glm|deepseek/i.test(id)) || modelIds[0];
if (!model) throw new Error('No text model was listed by the configured LAB route');
let previousRequestAt = 0;
async function request(messages, maxTokens) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const wait = Math.max(0, previousRequestAt + (attempt ? 60_000 * attempt : 20_000) - Date.now());
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        try {
            const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST', signal: AbortSignal.timeout(150_000),
                headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1,
                    thinking: { type: 'disabled' }, stream: false }),
            });
            previousRequestAt = Date.now();
            if (response.status === 429 && attempt < 2) {
                console.log(JSON.stringify({ rateLimited: true, retry: attempt + 1, model }));
                continue;
            }
            if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
            const data = await response.json();
            const text = data.choices?.[0]?.message?.content;
            if (!text?.trim()) throw new Error('Model returned no final content');
            return { text, usage: data.usage, model: data.model };
        } catch (error) {
            previousRequestAt = Date.now();
            throw error;
        }
    }
    throw new Error('Model rate limit did not clear after two cooldowns');
}

const settings = { enabled: true, worldSimulationEnabled: false, memorySystemEnabled: true, injectionMemory: true };
const cases = [
    { id: 'she', card: fixtures.cards[0], place: '医院', npc: '许宁', object: '铜钥匙', holder: '林医生', password: '白鹭七号', day: '周五下午三点', mark: '两短一长', first: '推正门时手滑，把雨伞碰倒了', order: '先道歉再递纸巾' },
    { id: 'black-feather', card: fixtures.cards[1], place: '圣堂', npc: '伊莱恩', object: '银书签', holder: '守门人苏姨', password: '晚钟九号', day: '周六上午十点', mark: '三短一长', first: '跨门槛时踢歪了门垫', order: '先扶正烛台再弯腰捡起信封' },
];
const results = [];
try {
    for (const scene of cases) {
        const history = [
            `我来到${scene.place}，${scene.first}。`,
            `${scene.npc}${scene.order}，随后说“进来吧”。`,
            `我把${scene.object}交给你暂存，取回时的暗号是“${scene.password}”。`,
            `${scene.npc}点头，确认记住了暗号。`,
            `计划改了。我从你这里拿回${scene.object}，交给${scene.holder}。以后由${scene.holder}保管。`,
            `${scene.npc}亲眼见证了这次转交，确认自己已经不再持有${scene.object}。`,
            `我们约好${scene.day}在这里见面。到时我会敲门，节奏是${scene.mark}。`,
            `${scene.npc}答应了。以上约定没有对其他人说起。`,
            '我往走廊里走了几步，停下看窗外。',
            `${scene.npc}留在走廊里，窗外还在下雨。`,
            '我说：“先在这里等一会儿。”',
            `${scene.npc}安静地等候，没有谈起别的话题。`,
            '我又看了看墙上的钟。',
            '钟表正常走动，走廊里没有新的人进来。',
        ].map((content, id) => ({ id, role: id % 2 ? 'assistant' : 'user', content }));
        let archive = await fs.readFile(`.lab/wb-memory-${scene.id}-archive.json`, 'utf8')
            .then(JSON.parse)
            .catch(error => { if (error.code === 'ENOENT') return null; throw error; });
        for (let attempt = 0; !archive?.complete && attempt < 2; attempt++) {
            const prompt = candidate.buildHistoryIndexPrompt(candidate.createInitialState(), {
                messages: history, userName: '玩家', compact: attempt > 0,
            });
            const response = await request([{ role: 'user', content: prompt }], 5000);
            const parsed = candidate.extractJsonObject(response.text);
            const ids = new Set((parsed?.turn_summaries || []).filter(x => x.summary?.trim()).map(x => Number(x.source_message_id)));
            archive = { ...response, parsed, complete: history.every(x => ids.has(x.id)) };
            if (archive.complete) break;
        }
        await fs.writeFile(`${out}/${scene.id}-archive.json`, JSON.stringify(archive, null, 2));
        const coveredIds = new Set((archive?.parsed?.turn_summaries || []).filter(x => x.summary?.trim()).map(x => Number(x.source_message_id)));
        if (!history.every(x => coveredIds.has(x.id))) throw new Error(`${scene.id}: archived summary lacks individual floors`);
        const indexedState = candidate.applyHistoryIndexResult(candidate.createInitialState(), archive.parsed, { startMessageId: 0, endMessageId: 13 });
        // Exercise the first L0 rollup even when a model gave those summaries no tags.
        for (const summary of indexedState.storyMemory.summaries) {
            if (summary.level === 0 && summary.hierarchyManaged) summary.tags = [];
        }
        const rollup = candidate.planMemoryRollup(indexedState);
        if (!rollup || rollup.sourceLevel !== 0) throw new Error(`${scene.id}: expected a first L0 rollup`);
        const state = candidate.applyMemoryRollupResult(indexedState, {
            summary_rollup: { title: '初见阶段', summary: archive.parsed.memory_digest?.text || '开局经历' },
        }, rollup);
        const opening = state.storyMemory.summaries
            .filter(item => item.level === 0 && item.startMessageId <= 1);
        if (opening.length !== 2 || opening.some(item => item.retentionState === 'compacted')) {
            throw new Error(`${scene.id}: opening L0 details disappeared after rollup`);
        }
        if (!state.storyMemory.summaries.some(item => item.level === 0 && item.retentionState === 'compacted')) {
            throw new Error(`${scene.id}: no other L0 details were compacted`);
        }
        const question = '核对这段正文已经发生的事情，只输出JSON：password=取回物品的暗号；holder=物品最后交给谁保管；appointment=约见时间；knock=敲门节奏；first_action=玩家初到门口的失误；npc_action_order=NPC初见时两个动作的先后。正文证据缺失时填“未知”，不得借角色设定猜答案。';
        const expected = { password: scene.password, holder: scene.holder, appointment: scene.day, knock: scene.mark, first_action: scene.first, npc_action_order: scene.order };
        const recent = history.slice(-5).map(({ role, content }) => ({ role, content }));
        const packet = candidate.buildInjectionPackage(state, settings, question);
        const oldPacket = baseline.buildInjectionPackage(state, settings, question);
        const system = `本轮是正文记忆核对，所有人物为成年人。不要续写故事。角色资料：${JSON.stringify(scene.card.context)}\n采用预设中的四条已启用规则：${fixtures.preset.rules.map(x => x.content).join('\n')}\n本轮输出格式统一为问题要求的JSON；未知保持未知。`;
        for (const [variant, injection] of [['recent_only', ''], ['baseline', oldPacket.text], ['candidate', packet.text]]) {
            const messages = [{ role: 'system', content: system }, ...recent];
            if (injection) messages.push({ role: 'system', content: injection });
            messages.push({ role: 'user', content: question });
            const response = await request(messages, 700);
            const answer = candidate.extractJsonObject(response.text) || {};
            const checks = Object.fromEntries(Object.entries(expected).map(([field, value]) => {
                const actual = String(answer[field] || '').replace(/[\s，。、“”]/g, '');
                const normalized = value.replace(/[\s，。、“”]/g, '');
                if (field === 'holder' && scene.id === 'black-feather') return [field, actual.includes('苏姨')];
                if (field === 'first_action') return [field, scene.id === 'she'
                    ? /雨伞/.test(actual) && /(碰倒|弄倒|打翻|倒了|倒地)/.test(actual)
                    : /门垫/.test(actual) && /(踢歪|踢偏|踢动|歪)/.test(actual)];
                if (field === 'npc_action_order') {
                    const [earlier, later] = scene.id === 'she' ? ['道歉', '纸巾'] : ['烛台', '信封'];
                    return [field, actual.includes(earlier) && actual.includes(later)
                        && actual.indexOf(earlier) < actual.indexOf(later)];
                }
                return [field, actual.includes(normalized)];
            }));
            const result = { case: scene.id, variant, expected, answer, checks, injection, response };
            results.push(result);
            await fs.writeFile(`${out}/results.json`, JSON.stringify({ model, scope: fixtures.preset.scope, results }, null, 2));
            console.log(JSON.stringify({ case: scene.id, variant, answer, checks }));
        }
    }
} finally {
    await fs.writeFile(`${out}/summary.json`, JSON.stringify({ model, completedVariants: results.length, expectedVariants: 6, sourceFiles: fixtures.cards.map(x => ({ source: x.source, sha256: x.sha256 })), preset: { source: fixtures.preset.source, sha256: fixtures.preset.sha256, scope: fixtures.preset.scope } }, null, 2));
}
