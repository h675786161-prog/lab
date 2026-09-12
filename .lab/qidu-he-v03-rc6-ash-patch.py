#!/usr/bin/env python3
import json
import runpy
from pathlib import Path

CARD = Path('fixtures/qidu-he-if/qidu-he-if.character.json')

# Build the already-tested rc5 candidate first. Keep the rc5 evidence immutable.
runpy.run_path('.lab/qidu-he-v03-rc5-recursion-patch.py', run_name='__main__')
obj = json.loads(CARD.read_text(encoding='utf-8'))
data = obj['data']
if data.get('character_version') != '0.3.0-rc5':
    raise SystemExit(f"rc6 patch expected rc5 candidate, got {data.get('character_version')!r}")

entries = data['character_book']['entries']
ash = next((e for e in entries if e.get('name') == '亚修'), None)
if not ash:
    raise SystemExit('亚修 entry missing')

anchor = '''\n- 身份显性锚点：亚修是高中生侦探，不是警察编制。已经在场景中建立过“高中生/学生”身份后，不需要每回合像报简历一样重复。\n- 案件资格回答：当别人直接问“你是警察吗 / 你为什么能看这份案子 / 你是什么人”时，他可以毒舌、嫌烦、拒绝透露案件细节，但应以符合情境的简短方式交代自己的合法接触来源，例如“侦探”“受警方或媒体委托”“协查”。不能只说“不是警察”后把自己为什么接触材料写成无来源谜团。\n'''
marker = '身份显性锚点：亚修是高中生侦探'
if marker not in ash.get('content', ''):
    ooc = '- OOC禁区：英伦绅士侦探、温柔导师、只会讲福尔摩斯梗、见{{user}}就免费全天候破案。'
    if ooc not in ash.get('content', ''):
        raise SystemExit('亚修 OOC marker missing')
    ash['content'] = ash['content'].replace(ooc, anchor + ooc)

notes = data.get('creator_notes', '')
rc6_note = '''\n\n【v0.3 rc6 亚修身份显性化】\n真实 SillyTavern + GLM rc5 两轮实测中，亚修首轮已被正确识别为高中生，次轮也正确否认警察身份并保留毒舌，但在被直接追问“为什么会看这份案子”时回避了侦探/委托来源。rc6 不要求人物每回合复读“高中生侦探”，而是在直接被问案件资格时要求以侦探、警方/媒体委托或协查等符合设定的方式简短交代来源；案件细节仍可保密。'''
if '【v0.3 rc6 亚修身份显性化】' not in notes:
    notes += rc6_note
data['creator_notes'] = notes
data['character_version'] = '0.3.0-rc6'

CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('patched rc6 candidate:', data['character_version'], 'ash_anchor=', marker in ash.get('content', ''))
