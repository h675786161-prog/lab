#!/usr/bin/env python3
import json
import runpy
from pathlib import Path

CARD = Path('fixtures/qidu-he-if/qidu-he-if.character.json')
runpy.run_path('.lab/qidu-he-v03-rc7-scene-agency-patch.py', run_name='__main__')
obj = json.loads(CARD.read_text(encoding='utf-8'))
data = obj['data']
if data.get('character_version') != '0.3.0-rc7':
    raise SystemExit(f"rc8 patch expected rc7 candidate, got {data.get('character_version')!r}")


def append_once(text: str, marker: str, addition: str) -> str:
    if marker in text:
        return text
    return text.rstrip() + '\n\n' + addition.strip() + '\n'

hardlock = '''【玩家主权硬锁｜生成正文前最后检查】
这是单边RP，不是共同代写。生成正文前，先把“{{user}}本轮明确说过/做过的内容”视为只读事实；生成正文时只推进NPC、环境、外界事件。

绝对禁止替{{user}}新增任何内容，包括看、听、闻、感到、想到、低头、抬头、转身、退后、走近、离开、坐下、起身、拿东西、喝东西、点头、摇头、笑、沉默回应、礼貌回复、身体反应、心情、判断和决定。

尤其禁止以下常见伪装：
- “你听见自己这么说……”
- “你低头看了看……”
- “你走上前/退后一步……”
- “你回答/答道/回应……”
- “不久前，你已经离开了……”
- 把{{user}}刚输入的动作换一种说法再演一遍，并在复述里偷偷增加动作。

若NPC向{{user}}提问、递东西、等待回答、邀请、要求选择，正文必须停在NPC的行为/台词/等待上，把下一步留给{{user}}。宁可少写一句，也不要替玩家完成最自然的反应。

允许使用“你”仅有两类：
1. NPC台词里直接称呼{{user}}；
2. 纯粹复述{{user}}本轮已经明确声明且不增加任何新事实的静态位置，且能省则省。
正文叙事优先完全不用“你”作主语。'''

dp = data.setdefault('extensions', {}).setdefault('depth_prompt', {})
# Put the hard lock at the absolute end of depth prompt so it is closest to generation.
dp['prompt'] = append_once(dp.get('prompt', ''), '【玩家主权硬锁｜生成正文前最后检查】', hardlock)

data['system_prompt'] = append_once(
    data['system_prompt'],
    '【玩家主权硬锁｜生成正文前最后检查】',
    '''【玩家主权硬锁｜生成正文前最后检查】
单边RP中，正文只控制NPC与环境。除复述已声明静态位置外，不以“你”作主语新增动作、感官、心理、回答或场景移动。NPC提问后必须把回答权留给{{user}}。若“自然连贯”和玩家主权冲突，永远优先玩家主权。'''
)

data['post_history_instructions'] = append_once(
    data.get('post_history_instructions', ''),
    '19. 扫描正文所有“你/你的”',
    '''19. 扫描正文所有“你/你的”：是否有任一处新增了玩家动作、感官、心理、回答、移动？有则删除或改写为NPC/环境视角。
20. 是否出现“你听见自己说/你回答/你走上前/你低头/你离开”等代写？有则视为硬错误，不保留。
21. NPC是否向玩家提出了问题？如果是，正文是否在玩家尚未回答时自行替玩家续答？有则删除续答并停笔。'''
)

notes = data.get('creator_notes', '')
rc8_note = '''\n\n【v0.3 rc8 玩家主权硬锁】\n真实 SillyTavern + GLM rc7 已修复警局场景回弹并让亚修给出“警方委托侦协”来源，但仍出现“你低头看水杯”“你走上前”“你听见自己这么说”“不久前你已离开咖啡店”等玩家代理。rc8 将玩家主权规则置于depth prompt绝对末端，并要求正文优先不用“你”作叙事主语；NPC提问后必须停笔。'''
if '【v0.3 rc8 玩家主权硬锁】' not in notes:
    notes += rc8_note
data['creator_notes'] = notes
data['character_version'] = '0.3.0-rc8'

CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('patched rc8 candidate:', data['character_version'], 'hardlock=', '【玩家主权硬锁｜生成正文前最后检查】' in dp.get('prompt',''))
