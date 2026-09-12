#!/usr/bin/env bash
set -euo pipefail
mkdir -p "${LAB_EVIDENCE_DIR:?}"

python3 - <<'PY'
from pathlib import Path
import base64, gzip, hashlib, json

root = Path.cwd()
fix = root / 'fixtures' / 'f7d'
base_sha = 'fb917134104909203d5a7652f43671f06e57a119f1e0d0ae7d9109cb2140e548'
new_sha = '3db2e5951017f308903784cef7d82a96a027b83b5bf9f1643a0590466b1550bb'
parts = sorted(fix.glob('card.*.b64'))
if not parts:
    raise SystemExit('F7D base fixture chunks missing')
raw = gzip.decompress(base64.b64decode(''.join(p.read_text(encoding='utf-8') for p in parts)))
actual = hashlib.sha256(raw).hexdigest()
if actual != base_sha:
    raise SystemExit(f'unexpected base card sha: {actual}')

d = json.loads(raw.decode('utf-8'))
d['data']['character_version'] = '0.4.1-lab'
extra = '''
- 【状态差分守恒】上一轮最后一个有效<f7d_state>是本轮唯一状态基线。除非{{user}}本轮明确行动、已满足的固定晨间/夜间结算、或世界书明确写出的不可避免后果直接改变某字段，否则该字段必须原样继承。禁止为了让剧情“更完整”顺手改动无关字段。
- 纯聊天/态度表达/查看/OOC不得自行改变camera、core_events、region.patrol、cores、route、任务完成度或其他未被本轮直接触发的字段；纯购买只改变与该购买直接相关的物品/标记，不扣节点。ann.camera只有玩家实际取得相机时才能从false变true。
- 若自动结算需要改变状态，只修改该截止规则直接涉及的字段，并在正文/终端中给出玩家可感知的原因；不得借结算补写此前不存在的行动、巡查或物品。'''
phi = d['data'].get('post_history_instructions', '')
if '【状态差分守恒】' not in phi:
    d['data']['post_history_instructions'] = phi.rstrip() + extra

entries = d['data']['character_book']['entries']
byid = {int(e['id']): e for e in entries}
se = byid[91]
se['constant'] = True
se['priority'] = 110
se['content'] = se['content'].rstrip() + '''

【差分守恒｜最高优先】
- 每一轮都先复制上一轮最后一个有效<f7d_state>作为新状态，再只对“本轮明确发生的事件”做最小差分。
- 没有直接因果关系的字段必须逐字义保持原值。不能因叙事需要、角色态度变化或模型想补全背景而顺手改状态。
- 纯聊天/安慰/争执/查看终端/查看日志不会自动获得物品、完成角色剧情、推进巡查、净化黑核或切换路线。
- ann.camera仅在玩家明确购买/取得相机后置true；没有取得相机时，谈论照片、记忆或亲近安都不能把camera改成true。
- region.patrol仅在玩家明确执行并完成该区域的一次巡查时+1；“刚才失败/讨论战斗/评价某人”不是新的成功巡查。
- 自动晨间/夜间结算只能修改对应截止条目明确涉及的字段；不得借结算创造未登记的前置行动。'''

boundary = '''

【西比尔资料边界】当前母版只确定“二周目起，第3次巡查后可额外花1节点调查，并取得后续成功救援条件”，没有给出神器机理、仪式步骤或具体医学/术式原理。调查成功时只登记 `battle_flags.sybilla_condition_obtained=true`（或等价任务标记）并说明“已取得可执行的时机/协作条件”；后续第5/6巡查依据该标记给出救援窗口与结果。除非聊天中另有可靠资料，不得自行发明‘封存书页、承载记录、神器承认终结’之类具体机制。'''
for eid in (10, 30):
    if '【西比尔资料边界】' not in byid[eid]['content']:
        byid[eid]['content'] = byid[eid]['content'].rstrip() + boundary

note = 'v0.4.1-lab：加强状态差分守恒；限制西比尔救援链在现有资料边界内，不擅自补写未定义机制。'
notes = d['data'].get('creator_notes', '')
if note not in notes:
    d['data']['creator_notes'] = notes.rstrip() + ('\n' if notes.strip() else '') + note

d['data']['character_version'] = '0.4.2-lab'
source_guard = '''
- 【资料空白不补机制】世界书/母版若只给出“结果、条件、窗口、成功/失败”而没有给出为什么、如何运作、具体术式/医学/神器机理，则把这些细节视为“当前资料未定义”。可以写角色确认“条件已掌握/窗口已确认”，但不得为了让剧情更像完整设定而自行补出因果机制。已知角色能力也不能自动充当未定义事件机制。'''
phi = d['data'].get('post_history_instructions', '')
if '【资料空白不补机制】' not in phi:
    d['data']['post_history_instructions'] = phi.rstrip() + source_guard

hard_boundary = '''

【西比尔救援机制｜严格空白】
- 已知事实仅到这里：西比尔的神器/人物意象与书页、真名、记录相关；她在高校主线中面临活骸风险；二周目且第3次巡查后额外调查，可得到“后续成功救援所需的完整条件”。
- **这不代表**“书页/记录能力导致她异化”，也不代表“记忆承载过量、自我被稀释、神器需要认出她、必须由特定关系者接触本体”等机制。母版没有这些因果。
- 调查成功的正文只允许写：通过安托涅瓦/爱缪莎的观察与既有资料，确认了后续救援的关键时机与协作条件；具体机制保持不展开。终端登记 `battle_flags.sybilla_condition_obtained=true`。
- 禁止自行补写任何未给出的神器原理、治疗原理、仪式步骤、心理钥匙、书页封存、记录承载、自我稀释、神器识别身份等解释。即使这些解释“听起来很合理”也不能写。
- 第5/6巡查只依据该布尔条件决定“是否存在救援窗口/能否成功执行”，不要倒推出一套原理。'''
for eid in (10, 30, 66):
    if '【西比尔救援机制｜严格空白】' not in byid[eid]['content']:
        byid[eid]['content'] = byid[eid]['content'].rstrip() + hard_boundary

if 'sybilla_condition_obtained' not in se['content']:
    se['content'] = se['content'].rstrip() + '''
- `battle_flags.sybilla_condition_obtained`：仅二周目高校第3次巡查后，玩家实际额外花1节点完成调查时才可置true；它只表示“完整救援条件已取得”，不承载/暗示任何未定义救援机理。'''

note2 = 'v0.4.2-lab：进一步封死资料空白处的机制幻觉；西比尔救援只登记条件结果，不从书页/记录能力反推未定义因果。'
notes = d['data'].get('creator_notes', '')
if note2 not in notes:
    d['data']['creator_notes'] = notes.rstrip() + ('\n' if notes.strip() else '') + note2

patched = json.dumps(d, ensure_ascii=False, indent=2).encode('utf-8')
patched_sha = hashlib.sha256(patched).hexdigest()
if patched_sha != new_sha:
    raise SystemExit(f'v0.4.2 sha mismatch: {patched_sha}')

for p in parts:
    p.unlink()
encoded = base64.b64encode(gzip.compress(patched, compresslevel=9, mtime=0)).decode('ascii')
(fix / 'card.00.b64').write_text(encoded, encoding='utf-8')

for rel in ('.lab/runtime-smoke.mjs', '.lab/f7d-live-bench.mjs'):
    p = root / rel
    s = p.read_text(encoding='utf-8')
    s = s.replace(base_sha, new_sha)
    p.write_text(s, encoding='utf-8')

out = Path(__import__('os').environ['LAB_EVIDENCE_DIR'])
(out / 'f7d-v042-card.json').write_bytes(patched)
(out / 'f7d-v042-patch.json').write_text(json.dumps({
    'base_sha256': base_sha,
    'patched_sha256': new_sha,
    'version': d['data']['character_version'],
    'entries': len(entries),
    'state_entry_constant': byid[91]['constant'],
    'state_diff_guard': '差分守恒' in byid[91]['content'],
    'source_blank_guard': '资料空白不补机制' in d['data']['post_history_instructions'],
    'sybilla_hard_boundary': all('【西比尔救援机制｜严格空白】' in byid[x]['content'] for x in (10,30,66)),
}, ensure_ascii=False, indent=2), encoding='utf-8')
print('F7D patched to', new_sha)
PY

{
  echo "project=f7d-v0.4.2-lab"
  echo "mode=character-card-only"
  echo "target_dir=${TARGET_DIR:-}"
  echo "st_dir=${ST_DIR:-}"
  echo "card_sha256=3db2e5951017f308903784cef7d82a96a027b83b5bf9f1643a0590466b1550bb"
} > "$LAB_EVIDENCE_DIR/f7d-install.txt"
