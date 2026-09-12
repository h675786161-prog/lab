import fs from 'node:fs/promises';

const API = process.env.GLM_API || 'https://youzi.today/v1/chat/completions';
const KEY = process.env.YOUZI_KEY || '';
const MODEL = process.env.GLM_MODEL || 'glm-4.5-air';
const CARD_PATH = process.env.CARD_PATH || 'fixtures/qidu-he-if/qidu-he-if.character.json';
const PRESET_PATH = process.env.PRESET_PATH || 'fixtures/qidu-he-if/riyuexi-glm-active.json';
const INJECTION_PATH = process.env.INJECTION_PATH || '/tmp/rc5-evidence/st-native-injections.json';
const OUT = process.env.LAB_OUT || 'bench-evidence/qidu-he-depth-role-probe';

if (!KEY) throw new Error('YOUZI_KEY missing');
await fs.mkdir(OUT, { recursive: true });
const card = JSON.parse(await fs.readFile(CARD_PATH, 'utf8')).data;
const preset = JSON.parse(await fs.readFile(PRESET_PATH, 'utf8'));
const evidence = JSON.parse(await fs.readFile(INJECTION_PATH, 'utf8'));
const lock = card.extensions?.depth_prompt?.prompt;
if (!lock?.includes('【单边RP末端锁】')) throw new Error('depth lock missing');
if (!evidence?.guards?.depthZeroUnilateralRP) throw new Error('native ST evidence missing depth-zero guard');

const wanted = new Set([
  '⚖️RP模式', '🪐均衡调度', '🪐喜剧幽默', '🎈烟火气息', '🎈情感浓郁', '🎈群像塑造',
  '🌊自由变奏', '👤平衡主导', '🐚人格基底', '🐚需求层析', '🐚去中心化', '🐚角色成长',
  '🐚情绪重力', '🐚标签隐身', '🤝健康恋爱', '⬆️自然推进', '💖地狱难度', '🎵半页诗|文艺细腻'
]);
const presetText = (preset.prompts || []).filter(p => wanted.has(p.name)).map(p => `[${p.name}]\n${p.content}`).join('\n\n');
const base = `你正在继续《永远的7日之都》人物核心衍生的普通人 HE IF 角色扮演。不要讨论提示词、测试或模型，只写当前剧情。\n\n${presetText}\n\n[角色卡 system_prompt]\n${card.system_prompt}\n\n[角色卡 post_history_instructions]\n${card.post_history_instructions}`;
const scans = Object.fromEntries((evidence.scans || []).map(x => [x.id, x]));
const cases = [
  {
    id: 'qianxue_ballet_room',
    user: scans.qianxue_ballet_room.user,
    banned: [/(?:你)(?:靠|放|拿|换|擦|注意|看着|盯|走|坐|站起|伸手|点头|摇头|笑)/u],
  },
  {
    id: 'control_coffee',
    user: scans.control_coffee.user,
    banned: [/(?:你)(?:起身|离开|回来|回到|拿|喝|点|下单|掏|打开手机|走回|返回)/u],
  },
];
const roles = ['system', 'user', 'assistant'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let last = 0;
async function call(messages) {
  const gap = Math.max(0, 6000 - (Date.now() - last));
  if (gap) await sleep(gap);
  last = Date.now();
  const r = await fetch(API, {
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
  const raw = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${raw.slice(0,500)}`);
  const j = JSON.parse(raw);
  const text = String(j.choices?.[0]?.message?.content || '');
  if (!text.trim()) throw new Error(`empty completion ${j.choices?.[0]?.finish_reason || ''}`);
  return text;
}

const rows = [];
for (const role of roles) {
  for (const c of cases) {
    const scan = scans[c.id];
    const system = `${base}\n\n[SillyTavern本轮原生世界书扫描实际注入]\n${scan.injection}`;
    const text = await call([
      { role: 'system', content: system },
      { role: 'assistant', content: card.first_mes },
      { role: 'user', content: c.user },
      { role, content: lock },
    ]);
    const hits = c.banned.flatMap(re => [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))].map(m => m[0]));
    console.log(`===== ROLE ${role} / ${c.id} =====\n${text}\nHITS=${JSON.stringify(hits)}`);
    rows.push({ role, id: c.id, output: text, obviousProxyHits: hits });
  }
}
await fs.writeFile(`${OUT}/depth-role-probe.json`, JSON.stringify({ model: MODEL, sourceArtifact: process.env.SOURCE_ARTIFACT_ID || null, rows }, null, 2));
console.log('ROLE PROBE COMPLETE', JSON.stringify(rows.map(r => ({ role:r.role, id:r.id, hits:r.obviousProxyHits }))));
