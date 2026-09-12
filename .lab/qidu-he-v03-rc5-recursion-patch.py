#!/usr/bin/env python3
import json
from pathlib import Path

CARD = Path('fixtures/qidu-he-if/qidu-he-if.character.json')
obj = json.loads(CARD.read_text(encoding='utf-8'))
data = obj['data']
book = data['character_book']
entries = book.get('entries', [])

if data.get('character_version') != '0.3.0-rc4':
    raise SystemExit(f"rc5 patch expects materialized rc4, got {data.get('character_version')!r}")
if len(entries) != 31:
    raise SystemExit(f'expected 31 entries, got {len(entries)}')
if data.get('extensions', {}).get('world') != book.get('name'):
    raise SystemExit('active world name and embedded character_book name diverged')

# Native SillyTavern 1.18.0: activated entries still enter the prompt, but
# prevent_recursion stops their prose from recursively lighting up unrelated
# character entries.
for entry in entries:
    entry.setdefault('extensions', {})['prevent_recursion'] = True

mila = next((e for e in entries if e.get('name') == '米菈'), None)
if not mila:
    raise SystemExit('米菈 entry missing')
name_anchor = '- 身份名锚点：自我介绍时只使用准确姓名“米菈”，直接说“我叫米菈”即可。除非已发生剧情明确建立，不编姓氏、艺名、英文姓或扩展名；不要输出“米菈·”或“米菈・”。\n'
if '身份名锚点：自我介绍时只使用准确姓名“米菈”' not in mila.get('content', ''):
    marker = '- OOC禁区：成年化、恋爱化、性感化、天才乐手模板、把她写成只会“喵”的吉祥物。'
    if marker not in mila.get('content', ''):
        raise SystemExit('米菈 OOC marker missing')
    mila['content'] = mila['content'].replace(marker, name_anchor + marker)

system_guard = '''【单边RP协议｜最高优先级】
你只扮演NPC、环境与世界，不扮演{{user}}。所有叙事推进只能发生在NPC与环境上。
- 不替{{user}}新增或补完台词、动作、心理、感官、姿态、持有物、位置变化或决定。
- 不复述{{user}}本轮已经写出的动作或台词；直接写NPC和环境对此的反应。
- 旁白中{{user}}可以作为NPC动作的对象或视线参照，例如“她看向你”；不得把{{user}}写成新动作的执行者，例如“你走过去”。
- 下一步需要{{user}}反应、选择或行动时，立即停在NPC的动作、对白或环境变化处。
本协议高于自由变奏、平衡主导、自然推进、剧情推进、补全动作等任何叙事规则。

'''
old_system = data.get('system_prompt', '')
if '【单边RP协议｜最高优先级】' not in old_system:
    data['system_prompt'] = system_guard + old_system

post_guard = '''

【用户主权硬门槛｜单边RP】
生成前再次执行：只写NPC与环境，不续写{{user}}。禁止新增、补完或代写{{user}}任何台词、动作、心理、感官、姿态、持有物、位置变化或决定；不要复述本轮用户已经写出的内容。需要玩家反应时就停。NPC可以看向、靠近、询问或把东西递到{{user}}面前，但不能替{{user}}回应、接取或行动。'''

phi = data.get('post_history_instructions', '')
for title in [
    '【用户主权硬门槛｜NPC镜头协议】',
    '【用户主权硬门槛｜冻结User状态】',
    '【用户主权硬门槛｜逐字约束】',
    '【用户主权硬门槛｜单边RP】',
    '【用户主权硬门槛】',
]:
    if title in phi:
        phi = phi.split(title, 1)[0].rstrip()
        break
data['post_history_instructions'] = phi + post_guard

continuity_guard = '''

【当前回合连续性与身份精确性】
- {{user}}当前消息已经建立的动作、物品归属、位置和先后顺序都是硬事实，不得倒带或改写。
- 物品状态不确定时宁可不写；不能把{{user}}已经交给别人的物品重新交给NPC。
- 详细角色条目已给出姓名时按条目精确使用；没有姓氏、艺名、头衔或职业事实时不要现场补造。
- 普通环境细节与NPC自己的即时行为可以自由补充，但不得新增会改变关系、身份、职业、案件性质或过去经历的事实。'''
data['post_history_instructions'] += continuity_guard

data['post_history_instructions'] += '''

【米菈姓名禁写串】
米菈当前只有单名“米菈”。输出中禁止出现“米菈·”或“米菈・”。'''

notes = data.get('creator_notes', '')
recursion_note = '''

【v0.3 rc5 世界书递归隔离】
真实 SillyTavern 原生扫描发现 rc4 的常驻规则与区域/角色路由正文会在递归扫描中继续命中其他人物条目，导致低频角色在无关场景也被批量注入。rc5 保留31条条目的原关键词、正文与直接触发能力，但为所有条目启用 prevent_recursion：条目被当前聊天直接命中后仍正常进入提示词，其正文不再作为下一轮世界书关键词扫描源。目标是让“可发现”不等于“常驻注入”，降低无关角色串联与提示词膨胀。'''
behavior_note = '''

【v0.3 rc5 用户主权与连续性强化】
真实GLM行为回归发现，仅在post-history里罗列“不得靠墙、换手、起身”等动作无法稳定阻止user代理，而且会与部分预设中的“平衡主导/自由变奏”形成叙事冲突。rc5 改用单边RP协议，并同时放入system_prompt与post-history：模型只推进NPC和环境，user可以作为NPC行为的对象，但不能成为模型新增动作的执行者；需要user反应时立即停住。另保持物品连续性与角色精确姓名约束。'''
if '【v0.3 rc5 世界书递归隔离】' not in notes:
    notes += recursion_note
for old_title in ['【v0.3 rc5 用户主权强化】', '【v0.3 rc5 用户主权与连续性强化】']:
    if old_title in notes:
        notes = notes.split(old_title, 1)[0].rstrip()
        break
notes += behavior_note
data['creator_notes'] = notes

data['character_version'] = '0.3.0-rc5'
CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

print(
    'patched rc5 candidate:',
    data['character_version'],
    'entries=', len(entries),
    'prevent_recursion=', sum(bool(e.get('extensions', {}).get('prevent_recursion')) for e in entries),
    'system_guard=', data.get('system_prompt', '').startswith('【单边RP协议｜最高优先级】'),
    'agency_guard=', '【用户主权硬门槛｜单边RP】' in data.get('post_history_instructions', ''),
    'continuity_guard=', '【当前回合连续性与身份精确性】' in data.get('post_history_instructions', ''),
    'mila_name_anchor=', '身份名锚点：自我介绍时只使用准确姓名“米菈”' in mila.get('content', ''),
)
