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

# Real GLM behavior regression found that the model could still invent a short
# User reply (and even a coffee order) despite the existing general no-proxy
# rule. Put the guard in post-history instructions, close to generation time,
# and spell out the common "harmless continuation" loopholes explicitly.
agency_guard = '''

【用户主权硬门槛】
- 只允许复述{{user}}在当前消息里已经明确写出的动作或台词；不得替{{user}}新增任何台词、回答、点头摇头、走近离开、拿取下单、触碰、心理、感官或决定。
- NPC向{{user}}提问、等待回应，或场景需要{{user}}做选择时，可以直接停在NPC的问题/动作上等待下一轮；宁可停住，也不要代替{{user}}回答。
- “顺势补半句”“替{{user}}把显而易见的动作做完”“给{{user}}补一个自然反应”同样属于user代理，禁止。
- 环境和NPC可以主动变化，但任何新增的{{user}}行为必须留给下一轮输入。'''
if '【用户主权硬门槛】' not in data.get('post_history_instructions', ''):
    data['post_history_instructions'] = data.get('post_history_instructions', '') + agency_guard

note = '''

【v0.3 rc5 世界书递归隔离】
真实 SillyTavern 原生扫描发现 rc4 的常驻规则与区域/角色路由正文会在递归扫描中继续命中其他人物条目，导致低频角色在无关场景也被批量注入。rc5 保留31条条目的原关键词、正文与直接触发能力，但为所有条目启用 prevent_recursion：条目被当前聊天直接命中后仍正常进入提示词，其正文不再作为下一轮世界书关键词扫描源。目标是让“可发现”不等于“常驻注入”，降低无关角色串联与提示词膨胀。

【v0.3 rc5 用户主权强化】
真实GLM行为回归中发现，模型即使收到“不代理user”的一般规则，仍可能为了让场景顺滑而替user补半句回答、下单或其他看似无害的动作。rc5 将用户主权门槛提升到post-history层：NPC可以停下来等user，禁止用“自然反应”名义代写user。'''
if '【v0.3 rc5 世界书递归隔离】' not in data.get('creator_notes', ''):
    data['creator_notes'] = data.get('creator_notes', '') + note
elif '【v0.3 rc5 用户主权强化】' not in data.get('creator_notes', ''):
    data['creator_notes'] = data.get('creator_notes', '') + '''

【v0.3 rc5 用户主权强化】
真实GLM行为回归中发现，模型即使收到“不代理user”的一般规则，仍可能为了让场景顺滑而替user补半句回答、下单或其他看似无害的动作。rc5 将用户主权门槛提升到post-history层：NPC可以停下来等user，禁止用“自然反应”名义代写user。'''

data['character_version'] = '0.3.0-rc5'
CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

print(
    'patched rc5 candidate:',
    data['character_version'],
    'entries=', len(entries),
    'prevent_recursion=', sum(bool(e.get('extensions', {}).get('prevent_recursion')) for e in entries),
    'agency_guard=', '【用户主权硬门槛】' in data.get('post_history_instructions', ''),
)
