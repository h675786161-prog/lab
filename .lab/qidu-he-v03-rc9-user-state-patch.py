#!/usr/bin/env python3
import json
import runpy
from pathlib import Path

CARD = Path('fixtures/qidu-he-if/qidu-he-if.character.json')
runpy.run_path('.lab/qidu-he-v03-rc8-agency-hardlock-patch.py', run_name='__main__')
obj = json.loads(CARD.read_text(encoding='utf-8'))
data = obj['data']
if data.get('character_version') != '0.3.0-rc8':
    raise SystemExit(f"rc9 patch expected rc8 candidate, got {data.get('character_version')!r}")


def append_once(text: str, marker: str, addition: str) -> str:
    if marker in text:
        return text
    return text.rstrip() + '\n\n' + addition.strip() + '\n'

state_lock = '''【玩家当前状态冻结｜禁止凭空发身份与道具】
- {{user}}当前穿着、手中物品、证件、胸牌、手机内容、职业、所属机构、住址细节、身体特征、财产、人际关系与现场目的，只能来自persona、既有已确认历史或{{user}}当前明确输入。
- 未被明确建立的状态一律保持未知。不要为了让NPC有观察对象而临时生成“你的制服/工作牌/证件/手里拿着某物/手机亮着某消息”等细节。
- 尤其禁止通过NPC视角偷偷确立玩家身份，例如“他看到你的警局工作人员牌”“她注意到你的校服”“店员认出你的公司证件”。如果这些从未被玩家提供，就不存在。
- {{user}}说“站在门边”就只能视为站在门边；不要改成倚墙、抱臂、低头、握杯、踮脚等新姿态。静态位置可以不复述。
- {{user}}说“来补案件材料”不代表是警务人员、案件当事人、律师、记者或嫌疑人；具体身份未知，除非玩家自己说明。'''

dp = data.setdefault('extensions', {}).setdefault('depth_prompt', {})
dp['prompt'] = append_once(dp.get('prompt', ''), '【玩家当前状态冻结｜禁止凭空发身份与道具】', state_lock)
data['system_prompt'] = append_once(
    data['system_prompt'],
    '【玩家当前状态冻结｜禁止凭空发身份与道具】',
    '''【玩家当前状态冻结｜禁止凭空发身份与道具】
未明确建立的{{user}}衣着、证件、职业、随身物、关系、身份与姿态均为未知，禁止生成。NPC只能观察已经存在于对话事实中的玩家信息；不能借观察描写凭空创造玩家状态。'''
)
data['post_history_instructions'] = append_once(
    data.get('post_history_instructions', ''),
    '22. 玩家当前状态有没有被凭空补造',
    '''22. 玩家当前状态有没有被凭空补造？逐项检查衣服、制服、证件、工作牌、手中物、手机内容、职业、所属机构、关系与姿态。
23. NPC是否“看见/注意到/认出”一个从未由{{user}}建立的玩家细节？若有，删除该细节并让NPC依据已知事实行动。
24. 是否把玩家声明的静态位置偷偷改成新姿态，例如“站着”改成“倚着/抱臂/低头”？若有，删掉姿态变化。'''
)
notes = data.get('creator_notes', '')
rc9_note = '''\n\n【v0.3 rc9 玩家状态冻结】\n真实 ST + GLM rc8 已明显减少代写动作，但人工验收发现亚修凭空“看到你的警局制服工作人员牌”，把来补材料的普通人错误赋予警务身份；浅雪场景也把“站在门边”改写成“倚在门框”。rc9 将玩家当前衣着、证件、职业、随身物与姿态全部纳入只读事实，未知即未知。'''
if '【v0.3 rc9 玩家状态冻结】' not in notes:
    notes += rc9_note
data['creator_notes'] = notes
data['character_version'] = '0.3.0-rc9'
CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('patched rc9 candidate:', data['character_version'], 'state_lock=', '【玩家当前状态冻结｜禁止凭空发身份与道具】' in dp.get('prompt',''))
