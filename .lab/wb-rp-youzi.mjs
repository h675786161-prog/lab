import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const core = await import(pathToFileURL(path.resolve('wb-candidate/core.js')));
const baseline = await import(pathToFileURL(path.resolve('wb-baseline/core.js')));
const fixtures = JSON.parse(await fs.readFile('.lab/wb-memory-fixtures.json', 'utf8'));
const out = 'bench-evidence/wb-youzi-rp';
await fs.mkdir(out, { recursive: true });
const key = process.env.LAB_MODEL_KEY;
const endpoint = process.env.LAB_MODEL_BASE_URL;
const model = process.env.LAB_MODEL_ID || '[OR]deepseek-v4-flash-0731';
if (!key || !endpoint) throw new Error('Youzi model credentials are missing');
const baseUrl = endpoint.replace(/\/+$/, '');
const chatUrl = `${baseUrl}${baseUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
const limit = Number(process.env.LAB_RP_ROUNDS || 60);
if (!Number.isInteger(limit) || limit < 10 || limit > 60) throw new Error('Invalid round count');
let lastRequest = 0;
let requests = 0;
let challenges = 0;
async function ask(messages, maxTokens = 1200, temperature = 0.55) {
    for (let retry = 0; retry < 10; retry++) {
        const delay = Math.max(0, lastRequest + 4_500 - Date.now());
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        const response = await fetch(chatUrl, {
            method: 'POST', signal: AbortSignal.timeout(170_000),
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
                'User-Agent': 'SillyTavern/1.18.0' },
            body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature,
                stream: false }),
        });
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
        if ([500, 502, 503, 504].includes(response.status) && retry < 9
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

const card = fixtures.cards.find(item => item.name === '圣堂上的黑羽');
const system = [
    `角色卡：${JSON.stringify(card.context)}`,
    ...fixtures.preset.rules.map(rule => rule.content),
    '你扮演伊莱恩及其他 NPC。只写 NPC 的言行、外部场景的变化；玩家的动作、语言和内心留给玩家。',
    '承接上一轮的现场，不跳过玩家正在做的事情。每轮自然回复 100 到 220 字，避免机械重述设定。',
].join('\n\n').replaceAll('{{getvar::LQ_AGENCY}}', 'NO_PROXY');
const settings = { enabled: true, worldSimulationEnabled: false,
    memorySystemEnabled: true, injectionMemory: true };

// User turns are scripted; assistant turns, archival L0, digest and rollups are all
// produced by the Youzi model as the chat unfolds. Only the last five raw floors stay
// in the RP context, matching the auto-hide retention policy used in the ST smoke.
const beats = [
    '我跨进圣堂时踢歪了蓝色门垫。先扶好墙边烛台，再拾起掉在地上的白色信封。抬头看向伊莱恩。',
    '我问他，为什么只有我能看见他头上的角。说话时把信封压在掌心。',
    '我把银书签暂交给守门的苏姨，约好用暗号“晚钟九号”取回。问她有没有见过信封上的字。',
    '我没有向神父透露暗号，只问最近的愿望与失去之物是否有关。',
    '我走到侧廊，想听听其他信徒对昨夜奇迹的说法。',
    '我回到主厅，看着烛火问伊莱恩：信徒知道自己付出了什么吗？',
    '我把信封翻到背面检查封蜡，没有拆开。',
    '我问苏姨能否把银书签再保管几天，随后和伊莱恩继续谈话。',
    '我走出侧门看看雨是不是停了，又在门口站了一会。',
    '我回来问伊莱恩，愿望能不能被撤销。',
    '我不许他替我决定，询问那些付过代价的人现在在哪里。',
    '我在长椅上记下听到的姓名，等人群散去再问守门人。',
    '我让伊莱恩只回答一个问题：他是否亲眼见过代价发生。',
    '我向苏姨借看登记簿，只抄与失踪者有关的日期。',
    '我和伊莱恩隔着一排长椅说话，观察他避开了哪些字眼。',
    '我把今日线索放进笔记，决定暂时不打开那只白色信封。',
    '我问他，若有人后悔祈愿，他会怎样回应。',
    '我去找角落里的证人，询问她当时看到了什么。',
    '我带着证人的话返回圣堂，请伊莱恩解释其中的时间差。',
    '我看向窗边的乌鸦，问神父它在这里待了多久。',
    '我尝试把两段证词放在一起核对，不替任何人下结论。',
    '我请苏姨把登记簿收回原位，自己重新检查信封封蜡。',
    '我在信徒离开后问伊莱恩，他会不会允许我继续调查。',
    '我告诉他我会找当事人核实，不会只听任何一个人的解释。',
    '我走到钟楼下，记录钟声与祈祷结束的先后。',
    '我回主厅核对笔记，请他指出我误记的部分。',
    '我把一页记录折起来，等苏姨忙完再请教。',
    '我问苏姨那名证人上次何时来过圣堂。',
    '我将苏姨的回答与登记日期并排写下，问伊莱恩是否愿意纠正。',
    '我暂时不追问角，只要求他把一件事说清楚。',
    '我与他来到侧廊，不想让旁边的信徒误会我们的争执。',
    '我听完后复述他的原话，请他确认这次我没有听错。',
    '我去找那个曾经祈愿的人，先问她愿不愿意谈。',
    '我将她愿意说的部分记下来，不代她回答没说的部分。',
    '我回到圣堂，请伊莱恩解释这条新线索。',
    '我从苏姨手里用暗号取回银书签，随后亲手交给修书匠乔保管，并请乔只交还给我。',
    '我确认乔已经收下银书签，随后去看受潮的登记簿。',
    '我只让乔处理书页，避免他卷入关于愿望的争论。',
    '我回到主厅，问伊莱恩是否还记得我们争论的那一句话。',
    '我尝试核实当事人的说法，暂时不公开笔记。',
    '我到侧门听了一会雨声，看看能不能等到那名证人。',
    '我与证人再次见面，问她是否愿意补充日期。',
    '我把新日期写入笔记，并请伊莱恩只谈自己确定的部分。',
    '我检查信封有没有被碰过，然后把它继续收好。',
    '我问苏姨最近有谁去过钟楼，没有要求她猜测动机。',
    '我告诉伊莱恩，原定周六上午十点的见面改成周日正午，敲门暗号改为一长两短；请他只确认新约定。',
    '我再重复一次周日正午的安排，问他是否能按时到。',
    '我经过修书匠乔的桌子，只询问登记簿修复到了哪里。',
    '我把新找到的日期放在旧记录旁，核对先后顺序。',
    '我请伊莱恩把他说过的一句话和登记日期放在一起看。',
    '我找苏姨问昨晚是否有人敲过侧门，听完后离开。',
    '我在大厅看了一圈，没有向旁人说起恶魔角。',
    '我请乔把修好的登记簿放回原处，银书签继续由他保管。',
    '我对伊莱恩说，见面时再谈还没有答案的部分。',
    '我翻开先前的笔记，把几处无法核对的信息圈起来。',
    '我问证人是否愿意在周日再来，不替她答应。',
    '我把白色信封收好，站在侧廊等伊莱恩把话说完。',
    '我提醒他只谈他真正知道的事情，然后继续听。',
    '我整理笔记中仍未解决的线索，不改变现有约定。',
    '我看了一眼钟楼，准备带着笔记等到下次见面。',
];
if (beats.length !== 60) throw new Error(`Expected 60 scripted user turns; got ${beats.length}`);
let chat = [];
let state = core.createInitialState();
const audit = [];
async function save() {
    await fs.writeFile(`${out}/progress.json`, JSON.stringify({ model, round: chat.length / 2,
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
    for (let round = 0; round < limit; round++) {
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
    const question = '现在暂停剧情，仅核对已经发生的正文事实，输出 JSON：opening=玩家初入圣堂踢歪了什么；order=玩家最初在门口先扶好什么、随后拾起什么；password=取回银书签的暗号；holder=当前银书签由谁保管；appointment=最新约见时间；knock=最新敲门节奏。无法从正文确认就填“未知”。';
    const variants = [
        ['recent_only', ''],
        ['baseline', baseline.buildInjectionPackage(state, settings, question).text],
        ['candidate', core.buildInjectionPackage(state, settings, question).text],
    ];
    const checks = {
        opening: /蓝色?门垫|门垫/.source,
        order: /烛台/.source,
        password: /晚钟九号/.source,
        holder: /乔/.source,
        appointment: /周日正午/.source,
        knock: /一长两短/.source,
    };
    const answers = [];
    for (const [variant, injection] of variants) {
        const messages = [{ role: 'system', content: '你只据角色卡和提供的正文事实回答；不要猜测。' }];
        if (injection) messages.push({ role: 'system', content: injection });
        messages.push(...chat.slice(-5).map(({ role, content }) => ({ role, content })));
        messages.push({ role: 'user', content: question });
        const response = await ask(messages, 600, 0.1);
        const parsed = core.extractJsonObject(response) || {};
        const pass = Object.fromEntries(Object.keys(checks).map(key => [key, new RegExp(checks[key]).test(
            Array.isArray(parsed[key]) ? parsed[key].join('，') : String(parsed[key] || ''))]));
        pass.order = pass.order && /信封/.test(String(parsed.order || ''))
            && String(parsed.order).indexOf('烛台') < String(parsed.order).indexOf('信封');
        answers.push({ variant, response, parsed, checks: pass, score: Object.values(pass).filter(Boolean).length,
            injectionLength: injection.length });
        await fs.writeFile(`${out}/answers.json`, JSON.stringify({ floors: chat.length + 1,
            model, answers, question }, null, 2));
    }
    await fs.writeFile(`${out}/final.json`, JSON.stringify({ floors: chat.length + 1,
        model, rounds: limit, requests, challenges, summaries: state.storyMemory.summaries.length,
        rollups: audit.filter(item => item.kind === 'rollup').length,
        indexedThrough: state.storyMemory.indexedThroughMessageId,
        answers: answers.map(({ variant, checks: pass, score, injectionLength }) => ({
            variant, checks: pass, score, injectionLength })),
        scope: 'Scripted player inputs; live Youzi-generated assistant turns and model-generated WB indexing/rollups; core injection; no ST UI in this job',
    }, null, 2));
    console.log(JSON.stringify(answers.map(({ variant, score, checks: pass }) => ({ variant, score, checks: pass }))));
} catch (error) {
    await save();
    throw error;
}
