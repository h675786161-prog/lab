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

note = '''\n\n【v0.3 rc5 世界书递归隔离】\n真实 SillyTavern 原生扫描发现 rc4 的常驻规则与区域/角色路由正文会在递归扫描中继续命中其他人物条目，导致低频角色在无关场景也被批量注入。rc5 保留31条条目的原关键词、正文与直接触发能力，但为所有条目启用 prevent_recursion：条目被当前聊天直接命中后仍正常进入提示词，其正文不再作为下一轮世界书关键词扫描源。目标是让“可发现”不等于“常驻注入”，降低无关角色串联与提示词膨胀。'''
if '【v0.3 rc5 世界书递归隔离】' not in data.get('creator_notes', ''):
    data['creator_notes'] = data.get('creator_notes', '') + note

data['character_version'] = '0.3.0-rc5'
CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

print('patched rc5 candidate:', data['character_version'], 'entries=', len(entries), 'prevent_recursion=', sum(bool(e.get('extensions', {}).get('prevent_recursion')) for e in entries))
