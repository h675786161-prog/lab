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

# Native ST 1.18.0 maps CharacterBook entry.extensions.prevent_recursion
# to internal preventRecursion. The entry still enters the prompt, but its prose
# no longer becomes the next recursion scan source.
for entry in entries:
    entry.setdefault('extensions', {})['prevent_recursion'] = True

mila = next((e for e in entries if e.get('name') == '米菈'), None)
if not mila:
    raise SystemExit('米菈 entry missing')
name_anchor = '- 身份名锚点：自我介绍时只使用准确姓名“米菈”，直接说“我叫米菈”即可。除非已发生剧情明确建立，姓名后不要输出中点号，不编姓氏、艺名、英文姓或“米菈·XX”式扩展名。\n'
if '身份名锚点：自我介绍时只使用准确姓名“米菈”' not in mila.get('content', ''):
    marker = '- OOC禁区：成年化、恋爱化、性感化、天才乐手模板、把她写成只会“喵”的吉祥物。'
    if marker not in mila.get('content', ''):
        raise SystemExit('米菈 OOC marker missing')
    mila['content'] = mila['content'].replace(marker, name_anchor + marker)

agency_guard = '''

【用户主权硬门槛｜逐字约束】
- {{user}}不是你扮演的角色。正文中凡是“{{user}}做了什么”的新动作、新姿态、新台词、新反应、新感官、新心理、新选择，都必须能在{{user}}当前这一条消息里找到明确依据；找不到就删掉。
- 允许把当前消息已经明确写出的动作换一种说法，但禁止顺手补全过程。例如“我站在门边等”只允许保持“仍在门边等待”，不能追加“靠墙、换手、掏手机、喝东西、转身离开”；“我去咖啡店靠窗坐十分钟”不等于已经点单，不能凭空让桌上出现属于{{user}}的咖啡，也不能让{{user}}拿手机。
- 不得替{{user}}新增任何台词、回答、点头摇头、笑、走近离开、坐下起身、拿取放置、下单饮食、触碰、查看手机、心理、感官或决定。再小的过渡动作也算代理，不存在“无关紧要所以可以补”。
- 不得为{{user}}新增当前消息未建立的持有物、饮料、食物、手机操作、身体姿态或位置变化。环境可以有咖啡、手机、椅子等物，但除非{{user}}明确互动，不要写成属于{{user}}或被{{user}}使用。
- 如果{{user}}明确停下、等待、观察或留在原地，本回合必须把镜头交给NPC/环境推进，结尾可以停在NPC提问、NPC动作或环境变化上等待下一轮。宁可停住，也不要替{{user}}完成“自然反应”。
- 写完后静默检查所有以“你”开头或描述{{user}}的句子：若该动作/状态无法直接对应当前用户输入，就删掉或改写成NPC/环境视角。'''

# Source card is rc4, so normally no prior rc5 block exists. Replacement logic
# also makes this safe if a developer runs it against a partially patched copy.
phi = data.get('post_history_instructions', '')
for title in ['【用户主权硬门槛｜逐字约束】', '【用户主权硬门槛】']:
    if title in phi:
        phi = phi.split(title, 1)[0].rstrip()
        break
data['post_history_instructions'] = phi + agency_guard

continuity_guard = '''

【当前回合连续性与身份精确性】
- {{user}}当前消息里已经完成的动作、物品归属、人物位置和先后顺序都是硬事实，不得倒带、改写或把同一物品重新交给另一个人。
- 例如{{user}}已经说明“把水杯交给朋友后回到门边”，后续角色不能再“接过这只水杯”；若物品状态不确定，宁可不写。NPC可以使用NPC自己的杯子，但要明确是其原本就在场景中的物品，不要偷换成{{user}}刚处理完的物品。
- 已有详细角色条目给出姓名时，首次自我介绍使用条目中的准确姓名；条目没有姓氏、艺名或头衔，就不要为了像真人而现场编一个，也不要输出“名字·嗯……算了”这类先生成伪姓再自我纠正的痕迹。
- 可以补普通环境细节和NPC自己的即时行为，但不要补会改变关系、身份、职业、案件性质或过去经历的新事实，除非当前场景确实需要且不与既有锚点冲突。'''
if '【当前回合连续性与身份精确性】' not in data['post_history_instructions']:
    data['post_history_instructions'] += continuity_guard

notes = data.get('creator_notes', '')
recursion_note = '''

【v0.3 rc5 世界书递归隔离】
真实 SillyTavern 原生扫描发现 rc4 的常驻规则与区域/角色路由正文会在递归扫描中继续命中其他人物条目，导致低频角色在无关场景也被批量注入。rc5 保留31条条目的原关键词、正文与直接触发能力，但为所有条目启用 prevent_recursion：条目被当前聊天直接命中后仍正常进入提示词，其正文不再作为下一轮世界书关键词扫描源。目标是让“可发现”不等于“常驻注入”，降低无关角色串联与提示词膨胀。'''
behavior_note = '''

【v0.3 rc5 用户主权与连续性强化】
真实GLM行为回归连续发现，模型会把靠墙、换手、离场、拿手机、自动点咖啡等“小动作”当作无害补全，也可能倒带当前回合物品状态，或给单名角色先造伪姓再自我纠正。rc5 因此把用户主权改为逐字约束：无法从当前用户输入直接对应的user动作/姿态/持有物一律不写；当前物品状态不得倒带；详细条目提供的姓名必须精确输出。'''
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
    'agency_guard=', '【用户主权硬门槛｜逐字约束】' in data.get('post_history_instructions', ''),
    'continuity_guard=', '【当前回合连续性与身份精确性】' in data.get('post_history_instructions', ''),
    'mila_name_anchor=', '身份名锚点：自我介绍时只使用准确姓名“米菈”' in mila.get('content', ''),
)
