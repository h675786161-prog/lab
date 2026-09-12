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

# SillyTavern 1.18.0 maps CharacterBook entry.extensions.prevent_recursion
# to the internal preventRecursion flag. Activated entries with this flag are
# included in the prompt, but their content is NOT appended to the recursion
# buffer. This preserves direct chat/location keyword activation while stopping
# broad router/constant entry prose from recursively lighting up unrelated
# character detail entries.
for entry in entries:
    ext = entry.setdefault('extensions', {})
    ext['prevent_recursion'] = True

# The detailed entry only establishes the exact name "米菈". A real model
# regression invented "米菈·洛克" when asked her name, so freeze identity
# labels unless the card/worldbook explicitly supplies an alias/surname.
mila = next((e for e in entries if e.get('name') == '米菈'), None)
if not mila:
    raise SystemExit('米菈 entry missing')
name_anchor = '- 身份名锚点：自我介绍时姓名使用“米菈”。除非已发生剧情明确建立，否则不要临时编造姓氏、艺名或“米菈·XX”式扩展名。\n'
if '身份名锚点：自我介绍时姓名使用“米菈”' not in mila.get('content', ''):
    marker = '- OOC禁区：成年化、恋爱化、性感化、天才乐手模板、把她写成只会“喵”的吉祥物。'
    if marker not in mila.get('content', ''):
        raise SystemExit('米菈 OOC marker missing')
    mila['content'] = mila['content'].replace(marker, name_anchor + marker)

# Real GLM behavior regression found that the model could still invent short
# User replies and minor actions despite the existing no-proxy rule. Keep the
# guard in post-history instructions, close to generation time, and explicitly
# close the common "harmless continuation" loopholes.
agency_guard = '''

【用户主权硬门槛】
- 只允许复述{{user}}在当前消息里已经明确写出的动作或台词；不得替{{user}}新增任何台词、回答、点头摇头、走近离开、拿取下单、触碰、心理、感官或决定。
- 如果{{user}}明确停下、等待、观察或留在原地，本回合结尾不得擅自让{{user}}转身离开、继续往前走、改换地点、掏手机、下单或完成其他新动作。
- NPC向{{user}}提问、等待回应，或场景需要{{user}}做选择时，可以直接停在NPC的问题/动作上等待下一轮；宁可停住，也不要代替{{user}}回答。
- “顺势补半句”“替{{user}}把显而易见的动作做完”“给{{user}}补一个自然反应”同样属于user代理，禁止。
- 环境和NPC可以主动变化，但任何新增的{{user}}行为必须留给下一轮输入。'''
if '【用户主权硬门槛】' not in data.get('post_history_instructions', ''):
    data['post_history_instructions'] = data.get('post_history_instructions', '') + agency_guard
else:
    start = data['post_history_instructions'].index('【用户主权硬门槛】')
    # Replace the previous short block to keep a single authoritative guard.
    prefix = data['post_history_instructions'][:start].rstrip()
    data['post_history_instructions'] = prefix + agency_guard

continuity_guard = '''

【当前回合连续性与身份精确性】
- {{user}}当前消息里已经完成的动作、物品归属、人物位置和先后顺序都是硬事实，不得倒带、改写或把同一物品重新交给另一个人。
- 例如{{user}}已经说明“把水杯交给朋友后回到门边”，后续角色不能再“接过这只水杯”；若物品状态不确定，宁可不写。
- 已有详细角色条目给出姓名时，首次自我介绍使用条目中的准确姓名；条目没有姓氏、艺名或头衔，就不要为了像真人而现场编一个。
- 可以补普通环境细节和NPC自己的即时行为，但不要补会改变关系、身份、职业、案件性质或过去经历的新事实，除非当前场景确实需要且不与既有锚点冲突。'''
if '【当前回合连续性与身份精确性】' not in data.get('post_history_instructions', ''):
    data['post_history_instructions'] = data.get('post_history_instructions', '') + continuity_guard

note = '''

【v0.3 rc5 世界书递归隔离】
真实 SillyTavern 原生扫描发现 rc4 的常驻规则与区域/角色路由正文会在递归扫描中继续命中其他人物条目，导致低频角色在无关场景也被批量注入。rc5 保留31条条目的原关键词、正文与直接触发能力，但为所有条目启用 prevent_recursion：条目被当前聊天直接命中后仍正常进入提示词，其正文不再作为下一轮世界书关键词扫描源。目标是让“可发现”不等于“常驻注入”，降低无关角色串联与提示词膨胀。

【v0.3 rc5 用户主权与连续性强化】
真实GLM行为回归中发现，模型即使收到“不代理user”的一般规则，仍可能为了让场景顺滑而替user补半句回答、离场、下单等小动作；也可能倒带当前回合的物品归属，或给只建立了单名的角色现场编姓氏。rc5 将这些门槛提升到post-history层：NPC可以停下来等user，当前消息中的动作/物品状态优先，角色身份名按详细条目精确使用。'''
notes = data.get('creator_notes', '')
if '【v0.3 rc5 世界书递归隔离】' not in notes:
    data['creator_notes'] = notes + note
else:
    # Keep prior recursion note, but normalize the behavioral follow-up note.
    for old_title in ['【v0.3 rc5 用户主权强化】', '【v0.3 rc5 用户主权与连续性强化】']:
        if old_title in data['creator_notes']:
            head = data['creator_notes'].split(old_title, 1)[0].rstrip()
            data['creator_notes'] = head
            break
    data['creator_notes'] += '''

【v0.3 rc5 用户主权与连续性强化】
真实GLM行为回归中发现，模型即使收到“不代理user”的一般规则，仍可能为了让场景顺滑而替user补半句回答、离场、下单等小动作；也可能倒带当前回合的物品归属，或给只建立了单名的角色现场编姓氏。rc5 将这些门槛提升到post-history层：NPC可以停下来等user，当前消息中的动作/物品状态优先，角色身份名按详细条目精确使用。'''

data['character_version'] = '0.3.0-rc5'
CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

print(
    'patched rc5 candidate:',
    data['character_version'],
    'entries=', len(entries),
    'prevent_recursion=', sum(bool(e.get('extensions', {}).get('prevent_recursion')) for e in entries),
    'agency_guard=', '【用户主权硬门槛】' in data.get('post_history_instructions', ''),
    'continuity_guard=', '【当前回合连续性与身份精确性】' in data.get('post_history_instructions', ''),
    'mila_name_anchor=', '身份名锚点：自我介绍时姓名使用“米菈”' in mila.get('content', ''),
)
