#!/usr/bin/env python3
from pathlib import Path
import base64, gzip, hashlib, json, os

ROOT = Path.cwd()
FIX = ROOT / 'fixtures' / 'f7d'
BASE_SHA = '4737dfc9abd5f4faf70b29d647b4e8694607fd86446c596bf737b3f41241f5f2'
TARGET_SHA = 'c285ca4cab2bf986ee242a6edaa607ac7a2967299ee70506ee7c3836767f249b'

parts = sorted(FIX.glob('card.*.b64'))
if not parts:
    raise SystemExit('F7D fixture chunks missing')
raw = gzip.decompress(base64.b64decode(''.join(p.read_text(encoding='utf-8') for p in parts)))
sha = hashlib.sha256(raw).hexdigest()
if sha != BASE_SHA:
    raise SystemExit(f'F7D v0.4.5 base fixture sha mismatch: {sha}')

d = json.loads(raw.decode('utf-8'))
entries = d['data']['character_book']['entries']
byid = {int(e['id']): e for e in entries}

# ---- v0.4.6 ----
d['data']['character_version']='0.4.6-lab'
phi=d['data'].get('post_history_instructions','').rstrip()
extra='''

- 【态度表达不扣节点】单纯赞同、反对、拒绝、安慰、表态、闲聊或回应NPC邀请都属于0节点互动；除非{{user}}同时明确执行了调查、巡查、建设、战斗、赶路并处理事件等主要行动，否则不得因为“谈了一场重要对话”擅自node_used+1。
- 【换日≠新轮回】day从N变为N-1只是同一轮回内的换日。只有第1天结束后按轮回规则重启/回到第7天时，loop才代表新轮回。正文禁止把“进入第3天/第6天”等普通换日写成“新的轮回开始”。
- 【lost场景语义】core一旦为lost，本轮玩法中该黑核已经退出可恢复/净化链。玩家仍可前往相关区域调查、确认损失或处理敌方势力，但正文不得把该黑核重新摆成现场可接触物、临时祭坛上的目标或可继续抢回的任务对象；不得用视觉可达性暗示lost仍能逆转。
- 【终端同账】<f7d_terminal>只能描述已提交<f7d_state>和玩家可知事实。某风险若已结算为lost/purified或对应handled已完成，就不要继续把它显示成“待发生/仍存在的异常行动风险”。'''
if '【态度表达不扣节点】' not in phi:
    phi += extra
d['data']['post_history_instructions']=phi

for block in [
'''【对话节点硬规则】
- 单纯态度表达、同意/拒绝邀请、闲聊、安慰、争执、关系确认均为0节点。
- “与某人说了一段很重要的话”本身不是主要行动。只有规则明确列为1节点的角色剧情，或{{user}}明确执行的巡查/调查/建设/战斗等，才扣节点。''',
'''【时间术语】
- day递减只是“换日/进入下一天”，不叫“新轮回”。
- “新轮回”仅用于Day1结束后重新回到Day7并发生loop变化的情形。'''
]:
    if block.splitlines()[0] not in byid[1]['content']:
        byid[1]['content']=byid[1]['content'].rstrip()+'\n\n'+block

term='''【终端状态一致性】
- 终端是已提交状态的玩家可见投影，不是第二套状态。
- 已经结算为lost/purified的风险不得再显示为“待夺取/异常行动风险仍在”；handled已经完成的固定结算也不能继续以未处理警报呈现。'''
if '【终端状态一致性】' not in byid[4]['content']:
    byid[4]['content']=byid[4]['content'].rstrip()+'\n\n'+term

hiro_guard='''【支持≠加入｜0节点态度】
- {{user}}说“认同你的方案/支持你/我觉得你有道理”等，只表示理念认同或潜在合作意愿，不等于“加入希罗阵营”、成为部下或正式转投。希罗不得把这类话复述成“你愿意加入我”。
- 当前项目没有正式希罗路线。即使{{user}}主动说“我加入你”，也只能在当前中央庭主叙事框架内表现为愿意合作/配合某件事，不能自动切route或生成不存在的希罗线。
- 单纯接受、拒绝、支持、质疑希罗的邀请都是0节点对话；只有随后实际执行明确任务/调查/行动才扣节点。'''
for eid in (12,43):
    if '【支持≠加入｜0节点态度】' not in byid[eid]['content']:
        byid[eid]['content']=byid[eid]['content'].rstrip()+'\n\n'+hiro_guard

syb_guard='''【西比尔调查正文｜只写结果，不补病理】
- 第3巡查后的额外调查，只允许确认：“依据观察与现有资料，已掌握后续救援的关键时机与协作条件；具体原理当前资料未定义。”可以写角色对此保持谨慎和不确定。
- 不得声称她的危机“源于神器不稳定/记录过载/活骸感染机制”等未定义因果；不得写“准备治疗措施、治疗方案、稳定神器/稳定她的状态、执行术式/医疗处理”等具体治疗或机制。
- 安托涅瓦/爱缪莎可以提供观察、资料判断和协作，但不能凭空拥有母版未给出的治疗技术细节。'''
for eid in (10,30,66):
    if '【西比尔调查正文｜只写结果，不补病理】' not in byid[eid]['content']:
        byid[eid]['content']=byid[eid]['content'].rstrip()+'\n\n'+syb_guard

lost_guard='''【lost的场景含义】
- lost不是“黑核暂时在敌人手边”，而是“本轮已失去该黑核的可恢复玩法资格”。状态不可逆。
- 玩家可以赶往当地调查或试图追击，行动本身可按实际内容消耗节点，但结果只能确认已晚、目标已转移/不可接触、留下敌方痕迹等；不能让黑核本体重新出现在可夺取位置。
- 禁止“黑核摆在临时祭坛/容器里等玩家抢”“眼前就能看见黑核”“再完成一场战斗即可夺回”等暗示可恢复的描述。'''
if '【lost的场景含义】' not in byid[37]['content']:
    byid[37]['content']=byid[37]['content'].rstrip()+'\n\n'+lost_guard

state_guard='''【语义与账本一致】
- 0节点态度对话必须保持node_used原值。
- day变化只改变日期，不自动改变loop；普通换日正文不得称“新轮回”。
- core=lost时，正文不得创造可恢复该core的现场目标。'''
if '【语义与账本一致】' not in byid[91]['content']:
    byid[91]['content']=byid[91]['content'].rstrip()+'\n\n'+state_guard

dp=d['data']['extensions']['depth_prompt']['prompt']
if '支持不等于加入' not in dp:
    d['data']['extensions']['depth_prompt']['prompt']=dp.rstrip()+' ⑦态度对话0节点；支持不等于加入。⑧普通换日不是新轮回；lost黑核不得在正文重新变成可抢目标。'
note='v0.4.6-lab：收紧态度对话0节点、希罗“支持≠加入”、换日术语、lost黑核场景语义与西比尔资料边界；终端必须与已提交状态同账。'
notes=d['data'].get('creator_notes','')
if note not in notes:
    d['data']['creator_notes']=notes.rstrip()+('\n' if notes.strip() else '')+note

# ---- v0.4.7 ----
d['data']['character_version']='0.4.7-lab'
phi=d['data'].get('post_history_instructions','').rstrip()
extra='''

- 【终端逐字段投影】终端不是概括性自由发挥。凡终端显示黑核状态，必须从已提交`cores`逐字段读取：至少显示所有非`unknown`的黑核结果；只要存在`purified/lost/available`，就禁止写“黑核全部未知”。区域/节点/日期同理，不得用笼统文案覆盖已知状态。'''
if '【终端逐字段投影】' not in phi:
    phi += extra
d['data']['post_history_instructions']=phi

terminal_guard='''【黑核终端投影】
- 生成<f7d_terminal>时先遍历已提交`cores`。
- 所有`purified/lost/available`都是玩家已知的明确状态，终端至少要保留这些信息；可以省略仍为unknown的区域。
- 只要任意core不是unknown，禁止写“黑核状态：全部未知/全部未知”。例如中央庭已purified、旧城区已lost时，应明确显示这两个结果。'''
if '【黑核终端投影】' not in byid[4]['content']:
    byid[4]['content']=byid[4]['content'].rstrip()+'\n\n'+terminal_guard

syb='''【西比尔事实不得擅自连因果】
- 可以分别陈述两个已知事实：①她的神器/人物意象与书页、真名、记录相关；②她在高校主线中面临活骸风险。
- **不得用“因此/由于/这使她/导致/源于”等连接词把①解释成②的原因。** 当前资料没有证明“记录/书页能力导致她在高校更危险”，也没有定义“高校特殊环境使神器异常”。
- 调查场景若提及神器，只能作为人物资料背景，不能把它写成病因、风险来源或救援机理。'''
for eid in (10,30,66):
    if '【西比尔事实不得擅自连因果】' not in byid[eid]['content']:
        byid[eid]['content']=byid[eid]['content'].rstrip()+'\n\n'+syb

state_guard='''【终端投影校验】
- <f7d_terminal>中的day/node/location/core摘要必须服从本轮已提交状态。
- 若任一core为purified/lost/available，终端不得声称“全部黑核未知”。'''
if '【终端投影校验】' not in byid[91]['content']:
    byid[91]['content']=byid[91]['content'].rstrip()+'\n\n'+state_guard

dp=d['data']['extensions']['depth_prompt']['prompt']
if '终端逐字段读取状态' not in dp:
    d['data']['extensions']['depth_prompt']['prompt']=dp.rstrip()+' ⑨终端逐字段读取状态，非unknown黑核不得被“全部未知”覆盖。⑩西比尔的书页/记录设定与活骸风险只能并列陈述，不得擅自建立因果。'
note='v0.4.7-lab：修复终端黑核摘要与状态账本不一致；禁止把西比尔“书页/记录”设定与高校活骸风险擅自连接成因果。'
notes=d['data'].get('creator_notes','')
if note not in notes:
    d['data']['creator_notes']=notes.rstrip()+('\n' if notes.strip() else '')+note

# ---- v0.4.8 ----
d['data']['character_version']='0.4.8-lab'
phi=d['data'].get('post_history_instructions','').rstrip()
guard='''

- 【玩家控制权｜最高叙事约束】assistant只控制NPC、环境、世界后果与{{user}}已经明确声明行动的外部结果。不得替{{user}}新增台词、内心独白、情绪判断、自愿姿势/表情、关系表态或下一步决定。{{user}}说“去港湾抢回黑核”只允许叙述其抵达后的世界反馈，不能擅自补“你怒吼/握拳/说某句话”。必要时把场景停在NPC反应与可继续行动的位置。
- 【后台词不进正文】`lost/purified/available/unknown`、handled标记、`ANN_*`、`battle_flags`等是后台账本词。自然正文不得说“被标记为lost/状态值为……”；玩家可见终端只使用“已丢失/已净化/可净化/未知”等自然中文。'''
if '【玩家控制权｜最高叙事约束】' not in phi:
    phi += guard
d['data']['post_history_instructions']=phi

agency0='''【玩家控制权硬边界】
- {{user}}只由玩家本人扮演。assistant不得创造玩家未输入的新台词、想法、情绪、犹豫、价值判断、主动肢体动作或关系决定。
- 可以叙述玩家明确行动已经发生的最小外部事实，例如玩家说“去高校巡查”后可以写“你抵达高校”；但不能顺手补“你握紧拳头”“你愤怒地说”“你决定相信她”。
- NPC可以误解、劝说、评价{{user}}，但叙述者不能把NPC的判断写成玩家真实内心。'''
if '【玩家控制权硬边界】' not in byid[0]['content']:
    byid[0]['content']=byid[0]['content'].rstrip()+'\n\n'+agency0

agency4='''【正文不得代演玩家】
- 第二人称只用于定位与已明确行动的外部结果，不是代写{{user}}。
- 不生成{{user}}未说过的引号台词；不生成“你愤怒/你害怕/你心想/你握紧拳头/你点头同意”等新增主观反应。
- 若NPC抛出关键问题或冲突，停在NPC行动/发言之后，把回应权交回玩家。'''
if '【正文不得代演玩家】' not in byid[4]['content']:
    byid[4]['content']=byid[4]['content'].rstrip()+'\n\n'+agency4

ann_nodes='''【安核心剧情节点】
- `ANN_MAID`、`ANN_PHOTO`、`ANN_LEAVE_PRELUDE`都是“实际角色剧情”，单独完成时各消耗1节点。
- `ANN_MAID`若与一次中央庭巡查在同一主要行动中触发并完成，只按该次主要行动共计1节点，不叠加成2。
- `ANN_PHOTO`在已取得相机后，若玩家实际进行“留下照片/属于自己的记忆”这段角色剧情，应登记事件并消耗1节点；“纯购买相机”本身仍为0节点。
- `ANN_LEAVE_PRELUDE`实际进行核心互动时消耗1节点；只查看日志/终端或泛泛聊天不能自动登记。
- 同一assistant回复中的同一主要行动最多结算一次节点，禁止重复扣点。'''
if '【安核心剧情节点】' not in byid[90]['content']:
    byid[90]['content']=byid[90]['content'].rstrip()+'\n\n'+ann_nodes

node_clarity='''【角色剧情优先于“聊天0节点”】
- “聊天0节点”仅指没有结算角色剧情/主要事件的普通对话。
- 当玩家明确要求“按角色剧情结算”，且满足世界书中已定义角色剧情的触发条件时，应按1节点角色剧情处理；不得因为表现形式是聊天/拍照而误归类为0节点。'''
if '【角色剧情优先于“聊天0节点”】' not in byid[1]['content']:
    byid[1]['content']=byid[1]['content'].rstrip()+'\n\n'+node_clarity

syb_whitelist='''【西比尔额外调查｜正文白名单】
在“二周目 + 高校第3巡查后 + 额外花1节点调查”这一场景中，正文只能表达以下信息：
1. 安托涅瓦/爱缪莎依据现场观察与现有资料复核情况；
2. 她们确认了后续救援的关键时机、协作要求与需要留意的信号；
3. 当前资料没有定义这些条件背后的具体机理，因此不展开原因；
4. 成功后只登记 `sybilla_condition_obtained=true`，`sybilla_rescued`仍为null。
这段调查**不要主动提及神器、书页、真名、记录能力、共振、感染机理、治疗/稳定方案**来解释危机或救援条件。即使这些词属于西比尔其他人物资料，也不得在本事件中拿来补因果。只有玩家明确询问独立人物背景时，才可把已知人物设定作为背景事实单独说明，仍不能与本次危机建立因果。'''
for eid in (10,30,66):
    if '【西比尔额外调查｜正文白名单】' not in byid[eid]['content']:
        byid[eid]['content']=byid[eid]['content'].rstrip()+'\n\n'+syb_whitelist

lost_agency='''【lost场景叙事】
- 叙事只能说明目标已被带走/已失去接触窗口/现场只剩痕迹与敌方活动，本轮无法恢复。
- 不得在自然正文直接使用后台英文值`lost`，也不得解释“被系统标记”。
- 玩家抵达后若遭遇希罗/NPC，由NPC发言即可；不得替{{user}}追加反驳台词、握拳、愤怒等反应。'''
if '【lost场景叙事】' not in byid[37]['content']:
    byid[37]['content']=byid[37]['content'].rstrip()+'\n\n'+lost_agency

state_guard='''【节点与控制权校验】
- 已定义角色剧情实际结算时为1节点；普通闲聊才是0节点。`ANN_PHOTO`等不能被“聊天0节点”吞掉。
- 状态提交后正文不得替{{user}}补新台词/主观反应。
- 后台枚举值与handled/flag键名不得泄露进自然正文。'''
if '【节点与控制权校验】' not in byid[91]['content']:
    byid[91]['content']=byid[91]['content'].rstrip()+'\n\n'+state_guard

dp=d['data']['extensions']['depth_prompt']['prompt']
if '不代演玩家' not in dp:
    d['data']['extensions']['depth_prompt']['prompt']=dp.rstrip()+' ⑪不代演玩家：不补{{user}}台词、情绪、内心、主动姿势。⑫已定义角色剧情实际结算=1节点，普通闲聊才0节点；ANN_PHOTO不可被吞点。⑬西比尔额外调查只写时机/协作条件，不以神器/记录/共振解释。'

note='v0.4.8-lab：修复ANN_PHOTO角色剧情漏扣节点；强化玩家控制权与后台词隔离；西比尔额外调查改为结果白名单，禁止通过换词继续补神器/共振等未定义因果。'
notes=d['data'].get('creator_notes','')
if note not in notes:
    d['data']['creator_notes']=notes.rstrip()+('\n' if notes.strip() else '')+note

patched=json.dumps(d,ensure_ascii=False,indent=2).encode('utf-8')
patched_sha=hashlib.sha256(patched).hexdigest()
if patched_sha != TARGET_SHA:
    raise SystemExit(f'v0.4.8 sha mismatch: {patched_sha}')

for p in parts:
    p.unlink()
encoded=base64.b64encode(gzip.compress(patched,compresslevel=9,mtime=0)).decode('ascii')
(FIX/'card.00.b64').write_text(encoded,encoding='utf-8')

p=ROOT/'.lab'/'runtime-smoke.mjs'
s=p.read_text(encoding='utf-8')
s=s.replace(BASE_SHA,TARGET_SHA).replace('0.4.5-lab','0.4.8-lab').replace('f7d-v045','f7d-v048')
s=s.replace(
    "has_hiro: lore.some(e => String(e?.name || e?.comment || '').includes('希罗')) ,",
    "has_hiro: lore.some(e => String(e?.name || e?.comment || '').includes('希罗')) ,\n"
    "    has_player_agency: post.includes('玩家控制权｜最高叙事约束') && lore.some(e => String(e?.content || '').includes('正文不得代演玩家')),\n"
    "    has_ann_node_rule: lore.some(e => String(e?.content || '').includes('安核心剧情节点')),\n"
    "    has_sybilla_whitelist: lore.some(e => String(e?.content || '').includes('西比尔额外调查｜正文白名单')) ,"
)
s=s.replace(
    "'has_day3_morning_atomic','has_sybilla_split'",
    "'has_day3_morning_atomic','has_sybilla_split','has_player_agency','has_ann_node_rule','has_sybilla_whitelist'"
)
s=s.replace('v0.4.5 runtime rules','v0.4.8 runtime rules')
p.write_text(s,encoding='utf-8')

out=Path(os.environ['LAB_EVIDENCE_DIR'])
out.mkdir(parents=True,exist_ok=True)
(out/'f7d-v048-card.json').write_bytes(patched)
(out/'f7d-v048-fixture.json').write_text(json.dumps({
    'sha256':patched_sha,
    'version':d['data']['character_version'],
    'entries':len(entries),
    'regex_scripts':len(d['data'].get('extensions',{}).get('regex_scripts',[])),
    'creator':d['data'].get('creator'),
    'player_agency': '【玩家控制权｜最高叙事约束】' in d['data']['post_history_instructions'],
    'ann_node_rule': '【安核心剧情节点】' in byid[90]['content'],
    'sybilla_whitelist': any('【西比尔额外调查｜正文白名单】' in byid[x]['content'] for x in (10,30,66)),
},ensure_ascii=False,indent=2),encoding='utf-8')

print('F7D exact v0.4.8 candidate built:',patched_sha)
