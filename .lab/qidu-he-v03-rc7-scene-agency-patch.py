#!/usr/bin/env python3
import json
import runpy
from pathlib import Path

CARD = Path('fixtures/qidu-he-if/qidu-he-if.character.json')
runpy.run_path('.lab/qidu-he-v03-rc6-ash-patch.py', run_name='__main__')
obj = json.loads(CARD.read_text(encoding='utf-8'))
data = obj['data']
if data.get('character_version') != '0.3.0-rc6':
    raise SystemExit(f"rc7 patch expected rc6 candidate, got {data.get('character_version')!r}")


def append_once(text: str, marker: str, addition: str) -> str:
    if marker in text:
        return text
    return text.rstrip() + '\n\n' + addition.strip() + '\n'


def entry(name: str):
    for item in data.get('character_book', {}).get('entries', []):
        if item.get('name') == name:
            return item
    raise KeyError(name)

scene_guard = '''【当前消息场景锁｜禁止回弹】
- 当前一条{{user}}消息若明确给出新的时间、地点或“已经到了/正在某处”的现场状态，该状态立即成为本轮唯一当前场景；开场白、公寓、上一幕只能作为过去历史，不得把镜头拉回去补过渡。
- 例如{{user}}已经说“下午我在警局等叫号”，正文必须从警局现场继续；不能先写彼安汀在公寓送行、厨房煎蛋、出门途中，也不能把“到警局”改写成尚未发生。
- 当前消息若明确描述一个正在现场说话/行动的陌生NPC，应优先承接这个NPC，不得用熟人抢镜替换现场角色。
- 不需要解释场景是怎么切过去的。用户完成的跳时/移动本身就是既成事实。'''

data['system_prompt'] = append_once(data['system_prompt'], '【当前消息场景锁｜禁止回弹】', scene_guard)

agency_guard = '''【单边RP强制停笔｜禁止User主语续写】
- 除了逐字保留{{user}}本轮已经明确声明的静态位置外，正文旁白原则上不要用“你/你的 + 动词、感官、心理、姿态、回应”继续写玩家。镜头改写NPC和环境。
- 特别禁止新增：你退后/靠在/转身/点头/摇头/笑/拿手机/喝东西/回答/拒绝/同意/看见/闻到/觉得/想起/决定等。
- NPC、服务员、路人向{{user}}提出问题或等待选择时，就停在对方的问题、动作或等待上；不得替{{user}}回答“谢谢/不用/好/嗯”等哪怕最自然的礼貌回应。
- {{user}}上一句已经完成的动作不要再换一种说法复述一遍。'''

dp = data.setdefault('extensions', {}).setdefault('depth_prompt', {})
dp['prompt'] = append_once(dp.get('prompt', ''), '【单边RP强制停笔｜禁止User主语续写】', agency_guard)
data['post_history_instructions'] = append_once(
    data.get('post_history_instructions', ''),
    '16. 当前消息是否已经切换场景',
    '''16. 当前消息是否已经切换时间/地点？若是，是否还错误回写旧场景或补出门过程？
17. 有没有让“你/你的”承担新动作、感官、心理或回答？若NPC在等玩家回应，是否已经停笔？
18. 用户正在现场关注的陌生NPC是否被熟人抢镜替换？发现任一项，删除越权段落，从当前现场NPC/环境继续。'''
)

routing = entry('角色发现与触发机制')
routing['content'] = append_once(
    routing['content'],
    '【高匹配入口：亚修】',
    '''【高匹配入口：亚修】
- 当{{user}}明确身处警局/案件办理现场，并描述“年纪不大、对案情矛盾冷嘲热讽、明显在推理/翻案件材料”的陌生人时，这是亚修的高匹配自然入口。优先按亚修条目承接该陌生人，不要让彼安汀/塞拉菲姆等熟人把镜头拖回公寓，也不要临时创造一个功能相同的无名毒舌侦探。
- 亚修可以拒绝透露案件细节，但若被直接问为什么能看材料，应给出“高中生侦探 + 受警方/媒体委托/协查”等现实合法来源之一，而不是“顺手翻到”“随便看看”这种无权限来源。'''
)

ash = entry('亚修')
ash['content'] = append_once(
    ash['content'],
    '【rc7现场承接】',
    '''【rc7现场承接】
- 若当前场景已经由{{user}}明确建立在警局，且现场年轻陌生人正在对案件矛盾点冷嘲热讽，直接由亚修承接该人物；不要回到公寓补出门过程。
- 被直接追问案件接触资格时，答案必须落在现实可解释的侦探委托/警方协查/媒体调查委托上。可以毒舌，可以不说案件细节，但不能把卷宗来源写成“顺手翻几页”。'''
)

notes = data.get('creator_notes', '')
rc7_note = '''\n\n【v0.3 rc7 场景锁与玩家主权回归】\n真实 SillyTavern + GLM rc6 发现：警局场景会被开场公寓吸回，亚修因此未在首轮正确承接；浅雪/咖啡店仍出现“你退后一步”“不需要，谢谢，你回答道”等玩家代理。rc7 将用户当前消息的时间地点提升为硬场景事实，禁止补旧场景过渡；同时将“NPC提问后停笔”和“不要使用User主语新增动作/回答”写入末端锁，并把警局案件中的年轻毒舌推理者设置为亚修高匹配入口。'''
if '【v0.3 rc7 场景锁与玩家主权回归】' not in notes:
    notes += rc7_note
data['creator_notes'] = notes
data['character_version'] = '0.3.0-rc7'

CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('patched rc7 candidate:', data['character_version'], 'scene_guard=', '【当前消息场景锁｜禁止回弹】' in data['system_prompt'], 'agency_guard=', '【单边RP强制停笔｜禁止User主语续写】' in dp.get('prompt',''))
