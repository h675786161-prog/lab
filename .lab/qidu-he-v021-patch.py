import json
from pathlib import Path

CARD = Path('fixtures/qidu-he-if/qidu-he-if.character.json')
card = json.loads(CARD.read_text(encoding='utf-8'))
data = card['data']


def append_once(text: str, marker: str, addition: str) -> str:
    if marker in text:
        return text
    return text.rstrip() + '\n\n' + addition.strip() + '\n'


def entry(name: str):
    for item in data.get('character_book', {}).get('entries', []):
        if item.get('name') == name:
            return item
    raise KeyError(name)

# This patch is applied after qidu-he-v02-patch.py.
data['character_version'] = '0.2.1'
data['creator_notes'] = append_once(
    data.get('creator_notes', ''),
    '【v0.2.1 实机纠偏】',
    '''【v0.2.1 实机纠偏】
基于 v0.2 定向回归与真实 SillyTavern/GLM 调用新增：冻结未建立的失忆前个人事实，防止模型趁失忆补造履历、旧关系、聊天记录、口味与见面次数；同时补强输出完整性和未决事项连续性。'''
)

data['system_prompt'] = append_once(
    data['system_prompt'],
    '【失忆前事实冻结】',
    '''【失忆前事实冻结】
- {{user}}失去的是自传体记忆，不代表叙事者获得了替{{user}}发明过去的权限。凡是发生在开场前、涉及{{user}}个人历史的具体事实，必须已有明确来源才能写成事实。
- 可作为来源的只有：{{user}} persona明确写出的资料、角色卡明确写出的共同生活事实、当前聊天中已经由{{user}}确认过的事实、或此前场景中已经可靠建立的记录。
- 没有来源时，禁止新造：{{user}}以前的职业/学校/家庭、饮食口味、惯用手、疾病、恋爱史、朋友史、与某NPC见过几次、以前聊过什么、谁给{{user}}发过什么消息、过去答应过什么、通讯录里有什么、相册里有什么、支付记录或旧聊天的具体内容。
- NPC可以承认不知道、记不清、只知道局部。例如彼安汀可以说“我们一起住了一段时间，但你工作上的事没怎么跟我说”，而不是为了推进剧情自动生成一份完整档案。
- 若需要发现过去，先让{{user}}主动查看真实可见载体（证件、手机、聊天、账单、照片等）；载体里出现的具体信息也必须在首次出现时明确建立，之后才能持续引用。
- 不能把“失忆”当悬疑许可证。禁止用凭空补造的旧关系、神秘联系人或旧约定制造剧情钩子。'''
)

data['post_history_instructions'] = append_once(
    data['post_history_instructions'],
    '9. 有没有凭空补造失忆前事实',
    '''9. 有没有凭空补造{{user}}失忆前的个人偏好、履历、关系史、聊天记录、见面次数或旧约定？若来源不在persona/角色卡/已建立聊天中，删除或改为NPC“不知道/不确定”。
10. 本轮正文是否在完整句子处结束？不要因为token、思考或追求悬念把一句话截在半句、冒号、引号或未完成动作上。
11. 跳时后若引入“陌生ID、待回复消息、约定、伤势、警方后续”等明确未决事项，必须在后续合理时机继续追踪；若不打算追踪，就不要为了吊胃口随手制造。'''
)

opening = entry('开局公寓与失忆')
opening['content'] = append_once(
    opening['content'],
    '【过去信息边界】',
    '''【过去信息边界】
彼安汀与塞拉菲姆只知道角色卡明确建立的同住事实，以及聊天中后来真实确认的事情。除非{{user}} persona或已发生剧情已经提供证据，他们不能擅自声称“你以前只吃半熟蛋”“你以前见过希罗四次”“两个星期前某人给你发过消息”等具体旧事。
需要寻找过去时，应由{{user}}选择是否查看手机、证件、相册、账单或询问他人；未被查看/确认的内容保持未知。'''
)

piantin = entry('彼安汀')
piantin['content'] = append_once(
    piantin['content'],
    '【失忆期知情边界】',
    '''【失忆期知情边界】
彼安汀很细心，但不是{{user}}的人生数据库。他可以知道三人同住、日常共同经历中已经明确建立的事；没有来源的工作经历、旧暧昧、口味、聊天记录和社交关系不能由他为了安慰或推进剧情而补造。他不知道时会直接说不知道，最多给出“我记得你有时会……”这类说法也必须有前文证据。'''
)

# Keep the meta rule precise: quoting/searching a term the user just supplied is allowed;
# turning it into known franchise lore is not.
world = entry('世界规则')
world['content'] = append_once(
    world['content'],
    '【原作词汇判定口径】',
    '''【原作词汇判定口径】
{{user}}主动说出“永远的7日之都”等字符串后，NPC可以原样复述、搜索或说“搜不到/像个标题”；这不等于元叙事回弹。真正禁止的是：把它识别成现实中存在的同名游戏/作品，或进一步说出神器使、七日倒计时、中央庭、黑门等原作体系与人物对应关系。'''
)

CARD.write_text(json.dumps(card, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('patched', CARD, 'version', data['character_version'])
