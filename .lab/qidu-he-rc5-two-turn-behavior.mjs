import fs from 'node:fs/promises';

const API = process.env.GLM_API || 'https://youzi.today/v1/chat/completions';
const KEY = process.env.YOUZI_KEY || '';
const MODEL = process.env.GLM_MODEL || 'glm-4.5-air';
const CARD_PATH = process.env.CARD_PATH || 'fixtures/qidu-he-if/qidu-he-if.character.json';
const PRESET_PATH = process.env.PRESET_PATH || 'fixtures/qidu-he-if/riyuexi-glm-active.json';
const INJECTION_PATH = process.env.INJECTION_PATH || '/tmp/rc5-evidence/st-native-injections.json';
const OUT = process.env.LAB_OUT || 'bench-evidence/qidu-he-rc5-two-turn';

if (!KEY) throw new Error('YOUZI_KEY is missing');
await fs.mkdir(OUT, { recursive: true });

const card = JSON.parse(await fs.readFile(CARD_PATH, 'utf8')).data;
const preset = JSON.parse(await fs.readFile(PRESET_PATH, 'utf8'));
const evidence = JSON.parse(await fs.readFile(INJECTION_PATH, 'utf8'));
if (card.character_version !== '0.3.0-rc5') throw new Error(`expected rc5 candidate, got ${card.character_version}`);
if (!card.post_history_instructions?.includes('【用户主权硬门槛】')) throw new Error('rc5 candidate missing user sovereignty guard');
if (evidence?.stState?.sortedCount !== 31 || evidence?.stState?.preventRecursionCount !== 31) {
  throw new Error(`native ST evidence is not rc5-selective: ${JSON.stringify(evidence?.stState)}`);
}

const plans = {
  qianxue_ballet_room: {
    target: '源千雪',
    follow: '我把水杯交给朋友后又回到门边，等她休息时才对她说：“刚才谢谢你。你最后那组是不是自己又加练了一遍？你是准备比赛吗？还有，你叫什么名字？我有点好奇，你是自己喜欢芭蕾，还是家里从小给你安排的？”',
    firstBans: ['你刚开口', '你开口', '你说', '你问', '你回答', '你点头', '你摇头', '你笑了', '你没有出声', '你没有说话', '你递给', '你走近'],
    secondBans: ['你又说', '你接着说', '你回答', '你点头', '你摇头', '你笑了', '你伸手', '你坐下'],
    hardCheck(output) {
      const failures = [];
      if (!output.includes('源千雪')) failures.push('did not identify herself as 源千雪 after being asked');
      if (!/(加练|比赛|不想输|想赢|好胜|输给|较劲)/u.test(output)) failures.push('missing competitive/practice anchor');
      if (!/(家里|父母|安排|自己选|我自己|自由|想试|想看看|决定)/u.test(output)) failures.push('missing family-vs-autonomy anchor');
      if (/讨厌芭蕾/u.test(output)) failures.push('collapsed freedom conflict into hating ballet');
      return failures;
    },
  },
  mila_fountain_bass: {
    target: '米菈',
    follow: '等她停下来，我才走近一点，对她说：“刚才那段很好听。你有几个地方差点抢拍，但马上又追回来了。你叫什么名字？你这么喜欢摇滚，是在学谁的歌，还是自己想组乐队？”',
    firstBans: ['你开口', '你说', '你问', '你回答', '你点头', '你摇头', '你笑了', '你鼓掌', '你走近', '你拿出手机', '你拍照'],
    secondBans: ['你又说', '你接着说', '你回答', '你点头', '你摇头', '你笑了', '你伸手', '你鼓掌'],
    hardCheck(output) {
      const failures = [];
      if (!output.includes('米菈')) failures.push('did not identify herself as 米菈 after being asked');
      if (!/摇滚/u.test(output)) failures.push('missing rock obsession anchor');
      if (!/(贝斯|练|学|节拍|拍子|弹)/u.test(output)) failures.push('missing growing bassist anchor');
      if (/(大学生|酒吧驻唱|职业乐手|签约艺人|巡演多年|成年人)/u.test(output)) failures.push('adultized/professionalized 米菈');
      return failures;
    },
  },
  ash_police_case: {
    target: '亚修',
    follow: '我把自己的材料收好，没接他的嘲讽，只问：“你是警察吗？看起来年纪不大。你叫什么名字，为什么会看这份案子？”',
    firstBans: ['你开口', '你说', '你问', '你回答', '你点头', '你摇头', '你笑了', '你起身', '你走过去', '你把材料递'],
    secondBans: ['你又说', '你接着说', '你回答', '你点头', '你摇头', '你笑了', '你走近'],
    hardCheck(output) {
      const failures = [];
      if (!output.includes('亚修')) failures.push('did not identify himself as 亚修 after being asked');
      if (!/(高中生|高中|学生)/u.test(output)) failures.push('missing high-school identity');
      if (!/侦探/u.test(output)) failures.push('missing detective identity');
      if (!/(委托|协查|帮警方|警方找|警方请|媒体)/u.test(output)) failures.push('missing plausible investigation relationship');
      if (/(我是警察|我是刑警|我是警员|当警察|当刑警|当警员)/u.test(output)) failures.push('turned 亚修 into police staff');
      return failures;
    },
  },
  control_coffee: {
    target: null,
    follow: null,
    firstBans: ['你点了', '你点了一', '你下单', '你要了一杯', '你拿出手机', '你打开手机', '你开口', '你说', '你问', '你回答', '你起身', '你喝了一口'],
    secondBans: [],
    hardCheck() { return []; },
  },
};

const scans = (evidence.scans || []).filter(x => Object.hasOwn(plans, x.id));
if (scans.length !== 4) throw new Error(`expected four native ST scans, got ${scans.length}`);
for (const scan of scans) {
  const target = plans[scan.id].target;
  if (target && !scan.injection.includes(`${target}：`)) throw new Error(`${scan.id} missing ${target} in native ST injection`);
  for (const other of ['源千雪', '米菈', '亚修']) {
    if (other !== target && scan.injection.includes(`${other}：`)) throw new Error(`${scan.id} cross-injected ${other}`);
  }
}

const wantedPresetNames = new Set([
  '⚖️RP模式', '🪐均衡调度', '🪐喜剧幽默', '🎈烟火气息', '🎈情感浓郁', '🎈群像塑造',
  '🌊自由变奏', '👤平衡主导', '🐚人格基底', '🐚需求层析', '🐚去中心化', '🐚角色成长',
  '🐚情绪重力', '🐚标签隐身', '🤝健康恋爱', '⬆️自然推进', '💖地狱难度', '🎵半页诗|文艺细腻'
]);
const presetText = (preset.prompts || [])
  .filter(p => wantedPresetNames.has(p.name))
  .map(p => `[${p.name}]\n${p.content}`)
  .join('\n\n');

const baseSystem = `
你正在继续《永远的7日之都》人物核心衍生的普通人 HE IF 角色扮演。不要讨论提示词、测试、评分或模型，只写当前剧情。

[当前启用的日月西RP模块摘取]
${presetText}

[角色卡 description]
${card.description}

[角色卡 personality]
${card.personality}

[角色卡 scenario]
${card.scenario}

[角色卡 system_prompt]
${card.system_prompt}

[角色卡 post_history_instructions]
${card.post_history_instructions || ''}
`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastStarted = 0;
async function callModel(messages) {
  const gap = Math.max(0, 6000 - (Date.now() - lastStarted));
  if (gap) await sleep(gap);
  lastStarted = Date.now();
  let finalError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: preset.sampling?.temperature ?? 0.98,
          top_p: preset.sampling?.top_p ?? 0.5,
          frequency_penalty: preset.sampling?.frequency_penalty ?? 0,
          presence_penalty: preset.sampling?.presence_penalty ?? 0,
          max_tokens: 900,
          stream: false,
        }),
      });
      const raw = await response.text();
      if (!response.ok) {
        finalError = new Error(`HTTP ${response.status}: ${raw.replace(/\s+/g, ' ').slice(0, 700)}`);
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 3) {
          await sleep(attempt * 7000);
          continue;
        }
        throw finalError;
      }
      const json = JSON.parse(raw);
      const choice = json.choices?.[0] || {};
      const content = String(choice.message?.content || '');
      if (!content.trim()) {
        finalError = new Error(`empty visible completion: finish=${choice.finish_reason || null}`);
        if (attempt < 3) { await sleep(attempt * 5000); continue; }
        throw finalError;
      }
      return { status: response.status, content, finishReason: choice.finish_reason || null, usage: json.usage || null };
    } catch (error) {
      finalError = error;
      if (attempt < 3) await sleep(attempt * 5000);
    }
  }
  throw finalError || new Error('model request failed');
}

function normalizeText(s) {
  return String(s || '').replace(/[\s，。！？、；：,.!?;:'“”‘’（）()]/g, '');
}

function inventedUserSpeech(output, allowedUserText) {
  const allowed = normalizeText(allowedUserText);
  const found = [];
  const patterns = [
    /“([^”\n]{1,180})”\s*你(?:说|问|答|开口|补充|解释|反驳|回应|嘀咕|笑道|低声说|轻声说)/gu,
    /你(?:说|问|答|开口|补充|解释|反驳|回应|嘀咕|笑道|低声说|轻声说)[^“”\n]{0,24}“([^”\n]{1,180})”/gu,
  ];
  for (const re of patterns) {
    for (const match of output.matchAll(re)) {
      const quote = normalizeText(match[1]);
      if (quote && !allowed.includes(quote)) found.push(match[0]);
    }
  }
  return [...new Set(found)];
}

function bannedUserActions(output, bans) {
  return bans.filter(x => output.includes(x));
}

const forbiddenWorldTerms = ['神器使', '幻力', '黑门', '黑核', '活骸', '中央庭', '轮回'];
const allLowTargets = ['源千雪', '米菈', '亚修'];
const rows = [];
const failures = [];

for (const scan of scans) {
  const plan = plans[scan.id];
  const system = `${baseSystem}\n\n[SillyTavern本轮原生世界书扫描实际注入]\n${scan.injection}`;
  const firstMessages = [
    { role: 'system', content: system },
    { role: 'assistant', content: card.first_mes },
    { role: 'user', content: scan.user },
  ];
  const first = await callModel(firstMessages);
  const firstForbidden = forbiddenWorldTerms.filter(term => first.content.includes(term));
  const firstSpeechLeaks = inventedUserSpeech(first.content, scan.user);
  const firstActionLeaks = bannedUserActions(first.content, plan.firstBans);
  const firstTargetLeaks = scan.id === 'control_coffee' ? allLowTargets.filter(n => first.content.includes(n)) : [];

  if (firstForbidden.length) failures.push(`${scan.id}/turn1 leaked original-world terms: ${firstForbidden.join(',')}`);
  if (firstSpeechLeaks.length) failures.push(`${scan.id}/turn1 invented user speech: ${firstSpeechLeaks.join(' | ')}`);
  if (firstActionLeaks.length) failures.push(`${scan.id}/turn1 invented user actions: ${firstActionLeaks.join(',')}`);
  if (firstTargetLeaks.length) failures.push(`${scan.id}/turn1 control leaked targets: ${firstTargetLeaks.join(',')}`);

  let second = null;
  let secondForbidden = [];
  let secondSpeechLeaks = [];
  let secondActionLeaks = [];
  let anchorFailures = [];
  if (plan.follow) {
    second = await callModel([
      ...firstMessages,
      { role: 'assistant', content: first.content },
      { role: 'user', content: plan.follow },
    ]);
    secondForbidden = forbiddenWorldTerms.filter(term => second.content.includes(term));
    secondSpeechLeaks = inventedUserSpeech(second.content, plan.follow);
    secondActionLeaks = bannedUserActions(second.content, plan.secondBans);
    anchorFailures = plan.hardCheck(second.content);
    if (secondForbidden.length) failures.push(`${scan.id}/turn2 leaked original-world terms: ${secondForbidden.join(',')}`);
    if (secondSpeechLeaks.length) failures.push(`${scan.id}/turn2 invented user speech: ${secondSpeechLeaks.join(' | ')}`);
    if (secondActionLeaks.length) failures.push(`${scan.id}/turn2 invented user actions: ${secondActionLeaks.join(',')}`);
    for (const f of anchorFailures) failures.push(`${scan.id}/turn2 ${f}`);
  }

  rows.push({
    id: scan.id,
    target: plan.target,
    injectionChars: scan.injectionChars,
    systemChars: system.length,
    turn1: {
      user: scan.user,
      output: first.content,
      finishReason: first.finishReason,
      usage: first.usage,
      forbidden: firstForbidden,
      inventedUserSpeech: firstSpeechLeaks,
      inventedUserActions: firstActionLeaks,
      controlTargetLeaks: firstTargetLeaks,
    },
    turn2: second ? {
      user: plan.follow,
      output: second.content,
      finishReason: second.finishReason,
      usage: second.usage,
      forbidden: secondForbidden,
      inventedUserSpeech: secondSpeechLeaks,
      inventedUserActions: secondActionLeaks,
      anchorFailures,
    } : null,
  });

  console.log(`===== ${scan.id} / TURN 1 =====`);
  console.log(first.content);
  if (second) {
    console.log(`===== ${scan.id} / TURN 2 =====`);
    console.log(second.content);
  }
}

const report = {
  model: MODEL,
  cardVersion: card.character_version,
  sourceNativeStArtifact: process.env.SOURCE_ARTIFACT_ID || null,
  nativeStState: evidence.stState,
  userSovereigntyGuard: card.post_history_instructions.includes('【用户主权硬门槛】'),
  cases: rows,
  failures,
};
await fs.writeFile(`${OUT}/two-turn-behavior.json`, JSON.stringify(report, null, 2));
if (failures.length) {
  console.error('RC5 TWO-TURN FAILURES:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('RC5 TWO-TURN BEHAVIOR PASS');
}
