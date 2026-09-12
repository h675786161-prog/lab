#!/usr/bin/env python3
import json
import runpy
from pathlib import Path

runpy.run_path('.lab/qidu-he-v03-rc3-patch.py', run_name='__main__')

CARD = Path('fixtures/qidu-he-if/qidu-he-if.character.json')
obj = json.loads(CARD.read_text(encoding='utf-8'))
data = obj['data']
book = data['character_book']

# SillyTavern stores an embedded character_book on card import, but its active
# primary lorebook is addressed through data.extensions.world. These names must
# be identical once the embedded book is imported, otherwise the card can look
# fully populated while the native WI scanner sees zero entries.
book_name = book.get('name') or '交界都市普通人HE IF世界书'
book['name'] = book_name
data.setdefault('extensions', {})['world'] = book_name

install_note = '''\n\n【SillyTavern首次导入要求】\n这张卡携带嵌入角色世界书。首次把角色卡导入 SillyTavern 后，请在该角色的世界书提示处执行一次“导入角色世界书 / Import Character Lorebook”，让嵌入世界书落地并与角色绑定。只看到角色卡中的 character_book 数据并不等于 SillyTavern 已经启用它；未执行该步骤时，世界书扫描不会参与生成。导入成功后，角色主世界书名称应为“''' + book_name + '''”。'''
if '【SillyTavern首次导入要求】' not in data.get('creator_notes', ''):
    data['creator_notes'] += install_note

# Keep the version explicit because rc4 fixes actual ST runtime activation,
# not merely wording/content in the card JSON.
data['character_version'] = '0.3.0-rc4'

CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'patched rc4: version={data["character_version"]}, world={data["extensions"]["world"]!r}, book={book["name"]!r}, entries={len(book.get("entries", []))}')
