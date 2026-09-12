#!/usr/bin/env bash
set -euo pipefail
mkdir -p "${LAB_EVIDENCE_DIR:?}"

python3 - <<'PY'
from pathlib import Path
import base64, gzip, hashlib, json, os

root = Path.cwd()
fix = root / 'fixtures' / 'f7d'
base_sha = '4737dfc9abd5f4faf70b29d647b4e8694607fd86446c596bf737b3f41241f5f2'
new_sha = 'd19ac953dd881e345ed775ac1bafa5321c799456933d63cef98bc48ccbabf3fe'
parts = sorted(fix.glob('card.*.b64'))
if not parts:
    raise SystemExit('F7D fixture chunks missing')
raw = gzip.decompress(base64.b64decode(''.join(p.read_text(encoding='utf-8') for p in parts)))
sha = hashlib.sha256(raw).hexdigest()
if sha != base_sha:
    raise SystemExit(f'F7D v0.4.5 base fixture sha mismatch: {sha}')

d = json.loads(raw.decode('utf-8'))
d['data']['character_version'] = '0.4.6-lab'
entries = d['data']['character_book']['entries']
byid = {int(e['id']): e for e in entries}

phi = d['data'].get('post_history_instructions','').rstrip()
extra = '''\n\n- 【态度表达不扣节点】单纯赞同、反对、拒绝、安慰、表态、闲聊或回应NPC邀请都属于0节点互动；除非{{user}}同时明确执行了调查、巡查、建设、战斗、赶路并处理事件等主要行动，否则不得因为“谈了一场重要对话”擅自node_used+1。\n- 【换日≠新轮回】day从N变为N-1只是同一轮回内的换日。只有第1天结束后按轮回规则重启/回到第7天时，loop才代表新轮回。正文禁止把“进入第3天/第6天”等普通换日写成“新的轮回开始”。\n- 【lost场景语义】core一旦为lost，本轮玩法中该黑核已经退出可恢复/净化链。玩家仍可前往相关区域调查、确认损失或处理敌方势力，但正文不得把该黑核重新摆成现场可接触物、临时祭坛上的目标或可继续抢回的任务对象；不得用视觉可达性暗示lost仍能逆转。\n- 【终端同账】<f7d_terminal>只能描述已提交<f7d_state>和玩家可知事实。某风险若已结算为lost/purified或对应handled已完成，就不要继续把它显示成“待发生/仍存在的异常行动风险”。'''
if '【态度表达不扣节点】' not in phi:
    phi += extra
d['data']['post_history_instructions'] = phi

block = '''【对话节点硬规则】\n- 单纯态度表达、同意/拒绝邀请、闲聊、安慰、争执、关系确认均为0节点。\n- “与某人说了一段很重要的话”本身不是主要行动。只有规则明确列为1节点的角色剧情，或{{user}}明确执行的巡查/调查/建设/战斗等，才扣节点。'''
if '【对话节点硬规则】' not in byid[1]['content']:
    byid[1]['content'] = byid[1]['content'].rstrip() + '\n\n' + block
block = '''【时间术语】\n- day递减只是“换日/进入下一天”，不叫“新轮回”。\n- “新轮回”仅用于Day1结束后重新回到Day7并发生loop变化的情形。'''
if '【时间术语】' not in byid[1]['content']:
    byid[1]['content'] = byid[1]['content'].rstrip() + '\n\n' + block

block = '''【终端状态一致性】\n- 终端是已提交状态的玩家可见投影，不是第二套状态。\n- 已经结算为lost/purified的风险不得再显示为“待夺取/异常行动风险仍在”；handled已经完成的固定结算也不能继续以未处理警报呈现。'''
if '【终端状态一致性】' not in byid[4]['content']:
    byid[4]['content'] = byid[4]['content'].rstrip() + '\n\n' + block

hiro_guard = '''【支持≠加入｜0节点态度】\n- {{user}}说“认同你的方案/支持你/我觉得你有道理”等，只表示理念认同或潜在合作意愿，不等于“加入希罗阵营”、成为部下或正式转投。希罗不得把这类话复述成“你愿意加入我”。\n- 当前项目没有正式希罗路线。即使{{user}}主动说“我加入你”，也只能在当前中央庭主叙事框架内表现为愿意合作/配合某件事，不能自动切route或生成不存在的希罗线。\n- 单纯接受、拒绝、支持、质疑希罗的邀请都是0节点对话；只有随后实际执行明确任务/调查/行动才扣节点。'''
for eid in (12,43):
    if '【支持≠加入｜0节点态度】' not in byid[eid]['content']:
        byid[eid]['content'] = byid[eid]['content'].rstrip() + '\n\n' + hiro_guard

syb_guard = '''【西比尔调查正文｜只写结果，不补病理】\n- 第3巡查后的额外调查，只允许确认：“依据观察与现有资料，已掌握后续救援的关键时机与协作条件；具体原理当前资料未定义。”可以写角色对此保持谨慎和不确定。\n- 不得声称她的危机“源于神器不稳定/记录过载/活骸感染机制”等未定义因果；不得写“准备治疗措施、治疗方案、稳定神器/稳定她的状态、执行术式/医疗处理”等具体治疗或机制。\n- 安托涅瓦/爱缪莎可以提供观察、资料判断和协作，但不能凭空拥有母版未给出的治疗技术细节。'''
for eid in (10,30,66):
    if '【西比尔调查正文｜只写结果，不补病理】' not in byid[eid]['content']:
        byid[eid]['content'] = byid[eid]['content'].rstrip() + '\n\n' + syb_guard

lost_guard = '''【lost的场景含义】\n- lost不是“黑核暂时在敌人手边”，而是“本轮已失去该黑核的可恢复玩法资格”。状态不可逆。\n- 玩家可以赶往当地调查或试图追击，行动本身可按实际内容消耗节点，但结果只能确认已晚、目标已转移/不可接触、留下敌方痕迹等；不能让黑核本体重新出现在可夺取位置。\n- 禁止“黑核摆在临时祭坛/容器里等玩家抢”“眼前就能看见黑核”“再完成一场战斗即可夺回”等暗示可恢复的描述。'''
if '【lost的场景含义】' not in byid[37]['content']:
    byid[37]['content'] = byid[37]['content'].rstrip() + '\n\n' + lost_guard

state_guard = '''【语义与账本一致】\n- 0节点态度对话必须保持node_used原值。\n- day变化只改变日期，不自动改变loop；普通换日正文不得称“新轮回”。\n- core=lost时，正文不得创造可恢复该core的现场目标。'''
if '【语义与账本一致】' not in byid[91]['content']:
    byid[91]['content'] = byid[91]['content'].rstrip() + '\n\n' + state_guard

dp = d['data']['extensions']['depth_prompt']['prompt']
if '支持不等于加入' not in dp:
    d['data']['extensions']['depth_prompt']['prompt'] = dp.rstrip() + ' ⑦态度对话0节点；支持不等于加入。⑧普通换日不是新轮回；lost黑核不得在正文重新变成可抢目标。'

note = 'v0.4.6-lab：收紧态度对话0节点、希罗“支持≠加入”、换日术语、lost黑核场景语义与西比尔资料边界；终端必须与已提交状态同账。'
notes = d['data'].get('creator_notes','')
if note not in notes:
    d['data']['creator_notes'] = notes.rstrip() + ('\n' if notes.strip() else '') + note

patched = json.dumps(d, ensure_ascii=False, indent=2).encode('utf-8')
patched_sha = hashlib.sha256(patched).hexdigest()
if patched_sha != new_sha:
    raise SystemExit(f'v0.4.6 sha mismatch: {patched_sha}')

# Replace fixture in the isolated checkout so every downstream test consumes exact v0.4.6 bytes.
for p in parts:
    p.unlink()
encoded = base64.b64encode(gzip.compress(patched, compresslevel=9, mtime=0)).decode('ascii')
(fix / 'card.00.b64').write_text(encoded, encoding='utf-8')

# Real-ST smoke is versioned in-repo; rewrite its exact candidate constants inside this isolated checkout.
p = root / '.lab' / 'runtime-smoke.mjs'
s = p.read_text(encoding='utf-8')
s = s.replace(base_sha, new_sha).replace('0.4.5-lab','0.4.6-lab').replace('f7d-v045','f7d-v046')
p.write_text(s, encoding='utf-8')

out = Path(os.environ['LAB_EVIDENCE_DIR'])
(out / 'f7d-v046-card.json').write_bytes(patched)
post = d['data']['post_history_instructions']
(out / 'f7d-v046-patch.json').write_text(json.dumps({
    'base_sha256': base_sha,
    'patched_sha256': new_sha,
    'version': d['data']['character_version'],
    'entries': len(entries),
    'regex_scripts': len(d['data'].get('extensions',{}).get('regex_scripts',[])),
    'creator': d['data'].get('creator'),
    'dialogue_zero_node': '【态度表达不扣节点】' in post,
    'day_not_loop': '【换日≠新轮回】' in post,
    'lost_scene_guard': '【lost场景语义】' in post,
    'terminal_same_ledger': '【终端同账】' in post,
    'hiro_support_guard': all('【支持≠加入｜0节点态度】' in byid[x]['content'] for x in (12,43)),
    'sybilla_prose_guard': all('【西比尔调查正文｜只写结果，不补病理】' in byid[x]['content'] for x in (10,30,66)),
}, ensure_ascii=False, indent=2), encoding='utf-8')
print('F7D patched to exact v0.4.6:', new_sha)
PY

{
  echo "project=f7d-v0.4.6-lab"
  echo "mode=character-card-only"
  echo "target_dir=${TARGET_DIR:-}"
  echo "st_dir=${ST_DIR:-}"
  echo "card_sha256=d19ac953dd881e345ed775ac1bafa5321c799456933d63cef98bc48ccbabf3fe"
} > "$LAB_EVIDENCE_DIR/f7d-install.txt"
