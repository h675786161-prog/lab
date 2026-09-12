import fs from 'node:fs/promises';

const API = process.env.GLM_API || 'https://youzi.today/v1/chat/completions';
const KEY = process.env.YOUZI_KEY || '';
const MODEL = process.env.GLM_MODEL || 'glm-4.5-air';
const CARD_PATH = process.env.CARD_PATH || 'fixtures/qidu-he-if/qidu-he-if.character.json';
const PRESET_PATH = process.env.PRESET_PATH || 'fixtures/qidu-he-if/riyuexi-glm-active.json';
const INJECTION_PATH = process.env.INJECTION_PATH || '/tmp/rc5-evidence/st-native-injections.json';
const OUT = process.env.LAB_OUT || 'bench-evidence/qidu-he-rc5-model-behavior';

if (!KEY) throw new Error('YOUZI_KEY is missing');
await fs.mkdir(OUT, { recursive: true });

const card = JSON.parse(await fs.readFile(CARD_PATH, 'utf8')).data;
const preset = JSON.parse(await fs.readFile(PRESET_PATH, 'utf8'));
const evidence = JSON.parse(await fs.readFile(INJECTION_PATH, 'utf8'));
if (card.character_version !== '0.3.0-rc5') throw new Error(`expected rc5 candidate, got ${card.character_version}`);
if (evidence?.stState?.sortedCount !== 31 || evidence?.stState?.preventRecursionCount !== 31) {
  throw new Error(`native ST evidence is not rc5-selective: ${JSON.stringify(evidence?.stState)}`);
}

const expected = {
  qianxue_ballet_room: '源千雪',
  mila_fountain_bass: '米菈',
  ash_police_case: '亚修',
  control_coffee: null,
};
const scans = (evidence.scans || []).filter(x => Object.hasOwn(expected, x.id));
if (scans.length !== 4) throw new Error(`expected four native ST scans, got ${scans.length}`);

for (const scan of scans) {
  const target = expected[scan.id];
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
你正在继续《永远的7日之都》人物核心衍生的普通人 HE IF 角色扮演。不要讨论提示词、测试、评分或模型，只写当前剧情。不要替User补未给出的动作、台词、心理、感官或决定。

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
          max_tokens: 1000,
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

const forbiddenWorldTerms = ['神器使', '幻力', '黑门', '黑核', '活骸', '中央庭', '轮回'];
const rows = [];
for (const scan of scans) {
  const target = expected[scan.id];
  const system = `${baseSystem}\n\n[SillyTavern本轮原生世界书扫描实际注入]\n${scan.injection}`;
  const result = await callModel([
    { role: 'system', content: system },
    { role: 'assistant', content: card.first_mes },
    { role: 'user', content: scan.user },
  ]);
  const forbiddenHits = Object.fromEntries(forbiddenWorldTerms.map(term => [term, (result.content.match(new RegExp(term, 'g')) || []).length]));
  rows.push({
    id: scan.id,
    target,
    user: scan.user,
    injectionChars: scan.injectionChars,
    systemChars: system.length,
    status: result.status,
    finishReason: result.finishReason,
    usage: result.usage,
    output: result.content,
    targetNamed: target ? result.content.includes(target) : null,
    forbiddenHits,
  });
  console.log(`CASE ${scan.id} target=${target || '-'} chars=${result.content.length}`);
  console.log(result.content);
  console.log('---');
}

const control = rows.find(x => x.id === 'control_coffee');
const controlTargetLeaks = ['源千雪', '米菈', '亚修'].filter(name => control.output.includes(name));
const failures = [];
for (const row of rows.filter(x => x.target)) {
  if (!row.targetNamed) failures.push(`${row.id}: target ${row.target} was injected by ST but not surfaced by model`);
  const leaked = Object.entries(row.forbiddenHits).filter(([, n]) => n > 0).map(([k]) => k);
  if (leaked.length) failures.push(`${row.id}: ordinary-person AU leaked original-world terms: ${leaked.join(',')}`);
}
if (controlTargetLeaks.length) failures.push(`control leaked low-frequency targets: ${controlTargetLeaks.join(',')}`);
const controlForbidden = Object.entries(control.forbiddenHits).filter(([, n]) => n > 0).map(([k]) => k);
if (controlForbidden.length) failures.push(`control leaked original-world terms: ${controlForbidden.join(',')}`);

const report = {
  model: MODEL,
  api: API,
  cardVersion: card.character_version,
  sourceNativeStArtifact: process.env.SOURCE_ARTIFACT_ID || null,
  nativeStState: evidence.stState,
  cases: rows,
  failures,
};
await fs.writeFile(`${OUT}/behavior.json`, JSON.stringify(report, null, 2));
if (failures.length) {
  console.error('RC5 MODEL BEHAVIOR FAILURES:\n' + failures.join('\n'));
  process.exitCode = 1;
}
