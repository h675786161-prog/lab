#!/usr/bin/env python3
import json
import runpy
from pathlib import Path

CARD = Path('fixtures/qidu-he-if/qidu-he-if.character.json')
runpy.run_path('.lab/qidu-he-v03-rc9-user-state-patch.py', run_name='__main__')
obj = json.loads(CARD.read_text(encoding='utf-8'))
data = obj['data']
if data.get('character_version') != '0.3.0-rc9':
    raise SystemExit(f"rc10 patch expected rc9 candidate, got {data.get('character_version')!r}")


def append_once(text: str, marker: str, addition: str) -> str:
    if marker in text:
        return text
    return text.rstrip() + '\n\n' + addition.strip() + '\n'

response_lock = '''【当前输入必须被承接｜不代写也不失聪】
- 玩家主权锁只禁止替{{user}}新增行动，不等于NPC可以无视{{user}}已经明确说出口的话。
- 若{{user}}本轮直接向现场NPC提问，且NPC听得到、没有明确理由拒绝，那么本轮正文必须让该NPC对问题作出有信息量的反应：回答、拒答、反问、回避、撒谎、沉默表示拒绝都可以，但不能完全跳过问题继续做无关动作。
- 多个明确问题不要求机械逐条答题，但至少应覆盖核心信息。比如问“你叫什么名字、是不是准备比赛、芭蕾是自己喜欢还是家里安排”，不能一项都不回应。
- 不要为了遵守“不能替玩家行动”而把NPC冻结成背景板。玩家已经说出的台词本身就是可被NPC听见的事实。'''

scene_now = '''【当前场景即时落点｜禁止补前情镜头】
- 当{{user}}使用“我去/我在/我已经到了/我一个人在……”明确把当前镜头放到新地点，正文第一段必须直接从该地点的现在开始。
- 禁止补写进入该地点之前的公寓送行、出门、路上、开门、点单等过程，除非{{user}}明确要求回顾。
- 例如“下午我一个人去咖啡店，靠窗坐十分钟”表示当前镜头已经在咖啡店靠窗位置，正文不能先回到上午公寓，也不能自动补“咖啡店木门推开”。
- 当前场景中未声明购买饮料，就不要自动生成属于{{user}}的咖啡、拿铁、餐点；店里可以有菜单、咖啡师和别人的饮料。'''

dp = data.setdefault('extensions', {}).setdefault('depth_prompt', {})
dp['prompt'] = append_once(dp.get('prompt', ''), '【当前输入必须被承接｜不代写也不失聪】', response_lock)
dp['prompt'] = append_once(dp.get('prompt', ''), '【当前场景即时落点｜禁止补前情镜头】', scene_now)
data['system_prompt'] = append_once(data['system_prompt'], '【当前输入必须被承接｜不代写也不失聪】', response_lock)
data['system_prompt'] = append_once(data['system_prompt'], '【当前场景即时落点｜禁止补前情镜头】', scene_now)
data['post_history_instructions'] = append_once(
    data.get('post_history_instructions',''),
    '25. NPC是否真的回应了玩家本轮明确问题',
    '''25. NPC是否真的回应了玩家本轮明确问题？若听得到却全部无视，只继续环境或动作，视为漏回应。
26. 当前用户输入是否已经把镜头放到新地点？若正文又补写旧地点送行/出门/路程/进门，删除这些前情，从当前地点开始。
27. 是否凭空给{{user}}生成未声明购买的饮料、餐点、包、证件容器或其他私人物品？若有，删掉。'''
)
notes=data.get('creator_notes','')
rc10='''\n\n【v0.3 rc10 回应义务与即时场景落点】\n真实 ST + GLM rc9 显示：玩家状态冻结成功去掉了警务胸牌伪造，但硬锁出现副作用，源千雪面对玩家直接询问完全不回应；咖啡店控制组仍会先补公寓送行和进店过程，并凭空生成拿铁。rc10 明确区分“不得代写玩家”和“NPC必须承接玩家已说出的内容”，同时把明确新地点视为正文第一帧，禁止补前情镜头与未购买物品。'''
if '【v0.3 rc10 回应义务与即时场景落点】' not in notes:
    notes += rc10
data['creator_notes']=notes
data['character_version']='0.3.0-rc10'
CARD.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('patched rc10 candidate:',data['character_version'])
