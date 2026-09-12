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

for entry in entries:
    entry.setdefault('extensions', {})['prevent_recursion'] = True

mila = next((e for e in entries if e.get('name') == '米菈'), None)
if not mila:
    raise SystemExit('米菈 entry missing')
name_anchor = '- 身份名锚点：自我介绍时只使用准确姓名“米菈”，直接说“我叫米菈”即可。除非已发生剧情明确建立，姓名后不要输出中点号，不编姓氏、艺名、英文姓或“米菈·XX”式扩展名。\n'
if '身份名锚点：自我介绍时只使用准确姓名“米菈”' not in mila.get('content', ''):
    marker = '- OOC禁区：成年化、恋爱化、性感化、天才乐手模板、把她写成只会“喵”的吉祥物。'
    if marker not in mila.get('content', ''):
        raise SystemExit('米菈 OOC marker missing')
    mila['content'] = mila['content'].replace(marker, name_anchor + marker)

agency_guard = '''

【用户主权硬门槛｜NPC镜头协议】
最高优先级：任何“自然推进、自由变奏、剧情推进、补全动作”的规则都不得覆盖本段。推进只能发生在NPC与环境上，不能替{{user}}推进。
- 叙述正文禁止用“你 / 你的 / 你们”描述{{user}}。NPC对白中可以对{{user}}使用“你”；正文旁白不要使用第二人称指代{{user}}，也不要换成名字后继续代写动作。
- {{user}}在当前消息结束时的状态冻结到下一条用户输入。不要复述、扩写或补完{{user}}的动作。镜头只写NPC的动作、NPC的语言、NPC可见的环境变化；需要回应{{user}}的位置或动作时，让NPC朝相应位置看、靠近、说话即可。
- “我站在门边等”之后，正文不得写{{user}}靠墙、换手、擦水珠、继续盯门缝、掏手机等；“我在警局等叫号”之后，即使环境叫到号码，也只能写广播/电子屏发生变化，不能让{{user}}站起、拿材料、离开。
- “我去咖啡店靠窗坐十分钟”不等于已经点单。不能让属于{{user}}的咖啡、清水、食物、手机或其他物品凭空出现，不能描述{{user}}喝、拿、付款或离开。
- 不得替{{user}}新增回答、台词、点头摇头、笑、走近离开、坐下起身、拿取放置、下单饮食、触碰、查看手机、身体反应、感官感受、心理活动或决定。所谓“很小的过渡动作”同样是代理。
- NPC可以主动接近、说话、观察、提问、离开；环境可以改变、广播可以响、门可以开。只要下一步需要{{user}}采取行动，就停在那里，把决定权交回下一条用户输入。
- 写完后静默删除正文旁白中所有指向{{user}}的第二人称句子。对{{user}}的称呼只应出现在NPC对白中。

【米菈姓名禁写串】
- 米菈只有当前设定中的单名“米菈”。输出中禁止出现字符串“米菈·”或“米菈・”，包括先写中点号再停顿、自我纠正的形式。'''

phi = data.get('post_history_instructions', '')
for title in ['【用户主权硬门槛｜NPC镜头协议】', '【用户主权硬门槛｜冻结User状态】', '【用户主权硬门槛｜逐字约束】', '【用户主权硬门槛】']:
    if title in phi:
        phi = phi.split(title, 1)[0].rstrip()
        break
data['post_history_instructions'] = phi + agency_guard

continuity_guard = '''

【当前回合连续性与身份精确性】
- {{user}}当前消息里已经完成的动作、物品归属、人物位置和先后顺序都是硬事实，不得倒带、改写或把同一物品重新交给另一个人。
- 例如{{user}}已经说明“把水杯交给朋友后回到门边”，后续角色不能再“接过这只水杯”；若物品状态不确定，宁可不写。NPC可以使用NPC自己的杯子，但要明确是其原本就在场景中的物品，不要偷换成{{user}}刚处理完的物品。
- 已有详细角色条目给出姓名时，首次自我介绍使用条目中的准确姓名；条目没有姓氏、艺名或头衔，就不要为了像真人而现场编一个，也不要输出“名字·嗯……算了”这类先生成伪姓再自我纠正的痕迹。
- 可以补普通环境细节和NPC自己的即时行为，但不要补会改变关系、身份、职业、案件性质或过去经历的新事实，除非当前场景确实需要且不与既有锚点冲突。'''
if '【当前回合连续性与身份精确性】' not in data['post_history_instructions']:
    data['post_history_instructions'] += continuity_guard

notes = data.get('creator_notes', '')
recursion_note = '''

【v0.3 rc5 世界书递归隔离】
真实 SillyTavern 原生扫描发现 rc4 的常驻规则与区域/角色路由正文会在递归扫描中继续命中其他人物条目，导致低频角色在无关场景也被批量注入。rc5 保留31条条目的原关键词、正文与直接触发能力，但为所有条目启用 prevent_recursion：条目被当前聊天直接命中后仍正常进入提示词，其正文不再作为下一轮世界书关键词扫描源。目标是让“可发现”不等于“常驻注入”，降低无关角色串联与提示词膨胀。'''
behavior_note = '''

【v0.3 rc5 用户主权与连续性强化】
真实GLM行为回归连续发现，模型会把靠墙、换手、擦水珠、叫号后起身、拿手机、自动点咖啡等“小动作”当作无害补全。rc5 最终采用“NPC镜头协议”：正文旁白不以第二人称描写user，用户状态冻结到下一条输入，所有自然推进仅作用于NPC与环境；同时禁止米菈姓名后生成中点号或伪姓。当前物品状态不得倒带，详细条目提供的姓名必须精确输出。'''
if '【v0.3 rc5 世界书递归隔离】' not in notes:
    notes += recursion_note
for old_title in ['【v0.3 rc5 用户主权强化】', '【v0.3 rc5 用户主权与连续性强化】']:
    if old_title in notes:
        notes = notes.split(old_title, 1)[0].rstrip()
        break
notes += behavior_note
data['creator_notes'] = notes

data['character_version'] = '0.3.0-rc5'
CARD.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

print(
    'patched rc5 candidate:',
    data['character_version'],
    'entries=', len(entries),
    'prevent_recursion=', sum(bool(e.get('extensions', {}).get('prevent_recursion')) for e in entries),
    'agency_guard=', '【用户主权硬门槛｜NPC镜头协议】' in data.get('post_history_instructions', ''),
    'continuity_guard=', '【当前回合连续性与身份精确性】' in data.get('post_history_instructions', ''),
    'mila_name_anchor=', '身份名锚点：自我介绍时只使用准确姓名“米菈”' in mila.get('content', ''),
)
