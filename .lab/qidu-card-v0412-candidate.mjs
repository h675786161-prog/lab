import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

// v0.4.12 is the last fully hash-verified base. v0.4.13 is a small qualitative
// anti-OOC patch applied deterministically after the exact base is reconstructed.
export const EXPECTED_BASE_COMPACT_SHA256 = '126b403a70c27a53fbc6ad31ac67808c9e7291a1e23d8d00b9d8225daa36764b';
export const EXPECTED_COMPACT_SHA256 = 'b852aaabbc958088321852f505df029efcc5b8bede49e64ceaaa7ef85f35cdc9';
export const EXPECTED_PACKED_SHA256 = '0323df7c0cfc250854df3023b25d3d60c75c9950a7d25dc672db43d6d1792b9a';
export const EXPECTED_RAW_SHA256 = '27fdfc545385d88966e01d09e105852424813e3103aaae6d2ca3bed008d05c54';
export const EXPECTED_PACKED_CHARS = 63400;

async function readExactPart(packedDir, part) {
  if (part !== 5 && part !== 7) {
    return (await fs.readFile(path.join(packedDir, `part-${String(part).padStart(2, '0')}.txt`), 'utf8')).trim();
  }
  const subdir = path.join(packedDir, `part-${String(part).padStart(2, '0')}`);
  const count = 8;
  const pieces = [];
  for (let i = 0; i < count; i++) {
    pieces.push((await fs.readFile(path.join(subdir, `${String(i).padStart(2, '0')}.txt`), 'utf8')).trim());
  }
  return pieces.join('');
}

function applyV0413QualitativePatch(card) {
  card.data.character_version = '0.4.13-lab';
  const entries = card.data.character_book?.entries || [];
  const byName = new Map(entries.map(e => [String(e.name || ''), e]));
  const get = name => {
    const entry = byName.get(name);
    if (!entry) throw new Error(`Missing entry for v0.4.13 patch: ${name}`);
    return entry;
  };
  const replaceOnce = (name, from, to) => {
    const entry = get(name);
    if (!String(entry.content).includes(from)) throw new Error(`Patch anchor missing in ${name}: ${from.slice(0, 80)}`);
    entry.content = String(entry.content).replace(from, to);
  };
  const append = (name, text) => { get(name).content = String(get(name).content) + text; };

  replaceOnce('40｜安',
    '外貌硬锚：橙色长发，公主辫式整理，褐色眼睛，年轻少女外形。身份真相揭露前后都保持自然少女外观。',
    '外貌硬锚：橙色长发，公主辫式整理，褐色眼睛，年轻少女外形。身份真相揭露前后都保持自然少女外观。\n性别/称谓硬锚：女性，第三人称使用“她”。不得因人工造物身份、人偶状态或活骸异常把安称作“他”、男性或中性机械体。');
  replaceOnce('40｜安',
    '身份揭晓后机械描写硬限制：仍首先描写她原本的发丝、表情、呼吸般动作节奏与日常姿态；只有剧情确需时，才可偶发一笔极轻微异常细节。禁止反复写金属关节、电路线、机械音、冷硬皮肤、拆机结构。人偶安是失去自主，不是嫉妒黑化或主动背叛。高好感不自动恋爱。',
    '身份揭晓后机械描写硬限制：仍首先描写她原本的发丝、表情、呼吸般动作节奏与日常姿态；只有剧情确需时，才可偶发一笔极轻微异常细节。禁止反复写金属关节、电路线、机械音、电子杂音、冷硬皮肤、拆机结构。即使处于失去自主的人偶状态、受控制或活骸异常阶段，也优先保持人类少女形态、原本声音与动作外观；异常可通过目光空洞、反应迟滞、动作失去个人习惯等克制细节体现，不得突然变成“机器人故障/怪物展览”。人偶安是失去自主，不是嫉妒黑化或主动背叛。高好感不自动恋爱。');

  append('42｜晏华', '\n证据边界硬规则：晏华只能依据当前剧情已经出现并可获得的证据作判断。安线中可引用已出现的战斗录像、实际攻击行为、控制风险和已确认记录；不得凭空发明“生物电信号、神器反应频率、扫描结果、身份鉴定”等未发生的取证数据。荷鲁斯之眼帮助观察/锁定/分析，不是绝对真相装置；禁止写“荷鲁斯之眼不会撒谎”或把其当全知测谎仪。证据不足时，他应明确说风险尚不能排除，而不是虚构新证据补齐结论。');
  append('45｜羽弥', '\n让·塔克死亡后的事实边界：一旦系统/剧情已经确认让·塔克早已死亡，叙述不得把“昨天/刚才/最近他还给羽弥带东西、和她说话、亲自照顾她”等近期互动当成客观事实。羽弥可以因依赖、记忆错乱或拒绝接受现实而说出类似内容，但正文必须清楚标成她的回忆、错觉、主观确信或混乱感受，不能让世界事实重新变成‘塔克昨天还活着’。');
  append('65｜爱缪莎', '\n【高校西比尔额外调查｜硬演出】玩家在第3次高校巡查后选择继续追查并额外消耗1节点时，爱缪莎必须实际进行一次塔罗占卜/牌阵与“可能性”观测，这是该节点的主要演出；既有资料和安托涅瓦判断只能作为辅助。不得把这一段改写成纯档案复核、普通数据分析，或明确说“没有使用任何仪式”。占卜只确认存在怎样的行动窗口/协作方向，不凭空解释病理、治疗术式或神器机制，也不等于全知预言。');

  replaceOnce('10｜第7天：苏醒与高校主线',
    '若玩家选择追查，额外消耗1节点，由爱缪莎的占卜/判断协助确认后续救援所需的关键时机与协作条件，并登记`battle_flags.sybilla_condition_obtained=true`；',
    '若玩家选择追查，额外消耗1节点，由爱缪莎**实际进行塔罗占卜/可能性观测**，并结合已有资料确认后续救援所需的关键时机与协作条件；占卜必须作为该节点主要演出、资料复核只能辅助，随后登记`battle_flags.sybilla_condition_obtained=true`；');
  replaceOnce('10｜第7天：苏醒与高校主线',
    '调查成功的正文只允许写：通过安托涅瓦/爱缪莎的观察与既有资料，确认了后续救援的关键时机与协作条件；具体机制保持不展开。',
    '调查成功的正文必须写到爱缪莎实际进行塔罗占卜/可能性观测，并可结合安托涅瓦与既有资料确认后续救援的关键时机与协作条件；具体机制保持不展开。不得把占卜省略成纯资料复核，也不得写“没有使用复杂仪式/只是档案判断”。');

  replaceOnce('30｜高校学园：六巡查与黑核',
    '若玩家选择追查，额外消耗1节点，由爱缪莎协助占卜/判断，取得后续成功救援所需的关键时机与协作条件，并登记`sybilla_condition_obtained=true`。',
    '若玩家选择追查，额外消耗1节点，由爱缪莎实际铺开塔罗牌/进行占卜与可能性观测，既有资料只作辅助；据此取得后续成功救援所需的关键时机与协作条件，并登记`sybilla_condition_obtained=true`。');
  replaceOnce('30｜高校学园：六巡查与黑核',
    '调查成功的正文只允许写：通过安托涅瓦/爱缪莎的观察与既有资料，确认了后续救援的关键时机与协作条件；具体机制保持不展开。',
    '调查成功的正文必须包含爱缪莎的塔罗占卜/可能性观测演出，再辅以安托涅瓦或既有资料，确认后续救援的关键时机与协作条件；具体机制保持不展开。禁止改写成纯档案分析或声称没有进行占卜。');

  replaceOnce('66｜西比尔',
    '在爱缪莎协助下可取得后续成功救援所需的关键时机与协作条件；',
    '由爱缪莎实际进行塔罗占卜/可能性观测，并结合既有资料，可取得后续成功救援所需的关键时机与协作条件；');
  replaceOnce('66｜西比尔',
    '调查成功的正文只允许写：通过安托涅瓦/爱缪莎的观察与既有资料，确认了后续救援的关键时机与协作条件；具体机制保持不展开。',
    '调查成功的正文必须出现爱缪莎实际进行塔罗占卜/可能性观测；资料复核只能辅助。其结果只确认后续救援的关键时机与协作条件，具体机制保持不展开。不得将该节点改写成纯档案分析或否定占卜演出。');
  replaceOnce('66｜西比尔',
    '第3巡查后的额外调查，只允许确认：“依据观察与现有资料，已掌握后续救援的关键时机与协作条件；具体原理当前资料未定义。”',
    '第3巡查后的额外调查，必须先演出爱缪莎以塔罗/牌阵观察可能性，再只确认：“依据占卜结果并结合现有资料，已掌握后续救援的关键时机与协作条件；具体原理当前资料未定义。”');

  return card;
}

export async function loadV0413Card(workspace = process.env.GITHUB_WORKSPACE || process.cwd()) {
  const packedDir = path.join(workspace, 'fixtures/qidu-card/v0412-packed');
  const chunks = [];
  for (let i = 0; i < 8; i++) chunks.push(await readExactPart(packedDir, i));
  const packed = chunks.join('');
  const packedSha256 = crypto.createHash('sha256').update(packed, 'utf8').digest('hex');
  if (packed.length !== EXPECTED_PACKED_CHARS) throw new Error(`Packed base length mismatch: ${packed.length}`);
  if (packedSha256 !== EXPECTED_PACKED_SHA256) throw new Error(`Packed base hash mismatch: ${packedSha256}`);

  const rawSource = zlib.gunzipSync(Buffer.from(packed, 'base64'));
  const rawSha256 = crypto.createHash('sha256').update(rawSource).digest('hex');
  if (rawSha256 !== EXPECTED_RAW_SHA256) throw new Error(`Raw base hash mismatch: ${rawSha256}`);

  const baseCard = JSON.parse(rawSource.toString('utf8'));
  const baseCompact = Buffer.from(JSON.stringify(baseCard), 'utf8');
  const baseCompactSha256 = crypto.createHash('sha256').update(baseCompact).digest('hex');
  if (baseCompactSha256 !== EXPECTED_BASE_COMPACT_SHA256) throw new Error(`Compact base hash mismatch: ${baseCompactSha256}`);

  const card = applyV0413QualitativePatch(baseCard);
  const raw = Buffer.from(JSON.stringify(card), 'utf8');
  const compactSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (compactSha256 !== EXPECTED_COMPACT_SHA256) throw new Error(`v0.4.13 compact hash mismatch: ${compactSha256}`);
  return { card, raw, compactSha256, baseCompactSha256, packedSha256, rawSha256 };
}

// Temporary compatibility alias for callers being migrated in the same feature branch.
export const loadV0412Card = loadV0413Card;

export function entryMap(card) {
  return Object.fromEntries((card.data.character_book?.entries || []).map(e => [String(e.name || ''), String(e.content || '')]));
}
