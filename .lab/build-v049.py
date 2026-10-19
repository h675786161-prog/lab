#!/usr/bin/env python3
from pathlib import Path
import base64, gzip, hashlib, json, os

OUT = Path(os.environ['LAB_EVIDENCE_DIR'])
BASE = OUT / 'f7d-v048-card.json'
BASE_SHA = 'c285ca4cab2bf986ee242a6edaa607ac7a2967299ee70506ee7c3836767f249b'
TARGET_SHA = 'faa2bd4afd5d3d0bca4f6aa4a987d0e0cb75f1905ce653201e7257fbc4f7ae98'
raw = BASE.read_bytes()
sha = hashlib.sha256(raw).hexdigest()
if sha != BASE_SHA:
    raise SystemExit(f'v0.4.8 base sha mismatch: {sha}')

d = json.loads(raw.decode('utf-8'))
d['data']['character_version']='0.4.9-lab'
entries=d['data']['character_book']['entries']
byid={int(e['id']):e for e in entries}

phi=d['data'].get('post_history_instructions','').rstrip()
extra='''\n\n- 【叙事镜头锁｜NPC/环境优先】自然正文默认以NPC、环境、可观察事件和已发生结果为叙事主语，不以{{user}}为连续动作主语。{{user}}当前输入已经明确的动作只需承认“该行动发生/抵达/完成”这一最小外部事实，随后立刻把镜头交给NPC与世界反馈；不得替{{user}}设计动作步骤、战斗招式、解谜顺序、说话方式或新的选择。\n- 【玩家台词零生成】assistant正文不得为{{user}}生成任何新的引号台词，也不需要复述当前用户输入里的原话。用户说完后，直接从NPC/环境的反应继续。禁止“你对她说：……”“你安慰她：……”“你喊道：……”以及任何由assistant续写的玩家发言。\n- 【玩家主观零生成】不得写{{user}}的内心、感受、情绪、生理化主观反应或未声明意图，包括“心中想着/你感到/你觉得/你意识到/你不禁/你犹豫/你下定决心/你决定相信”等。若需要营造情绪，只写环境和NPC表现。\n- 【unknown认知锁】任何`cores.* == unknown`都表示当前账本尚未确认该黑核的确切结果。除非本轮有明确调查/结算使状态同步更新，否则正文与终端只能说“尚未确认/未知”，不得擅自说“暂时安全、已经失守、可净化、位于某处”等确定结论。其他未知后台事实同理。'''
if '【叙事镜头锁｜NPC/环境优先】' not in phi:
    phi += extra
d['data']['post_history_instructions']=phi

agency='''【Agency-safe叙事语法】\n- 叙事主语优先顺序：NPC/环境/事件结果 > 被动可见信息 > {{user}}最小已声明行动。\n- 当前输入已经写出的玩家行动，不需要由assistant再次“导演”。例如玩家说“去港湾查看”，正文可从“港湾区码头已经空了”开始；不要写“你心中想着必须夺回黑核，于是握紧拳头冲过去”。\n- 玩家说“和安拍照并聊记忆”，正文可从“快门声落下后，安看着照片……”开始；不得替玩家编“笑一个吧”“你的存在最真实”等台词。\n- 玩家说“完成巡查”，assistant负责NPC、敌人、环境和巡查结果；不要额外决定玩家采用何种招式、解谜顺序、合作方案或战术细节。\n- 若不写玩家动作也能让场景成立，优先不写。'''
if '【Agency-safe叙事语法】' not in byid[0]['content']:
    byid[0]['content']=byid[0]['content'].rstrip()+'\n\n'+agency

old='2. 自然正文：第二人称小说式互动，只写NPC、环境与{{user}}明确行动的外部结果；关键决定停在用户可继续行动的位置。'
new='2. 自然正文：NPC/环境主导的互动叙事。只写NPC、环境、可观察事件与{{user}}已明确行动的最小外部结果；不代演玩家，不续写玩家台词；关键决定停在用户可继续行动的位置。'
if old in byid[4]['content']:
    byid[4]['content']=byid[4]['content'].replace(old,new)
grammar='''【正文镜头范式】\n- 用户刚刚说过一句话：不要重复/扩写那句话，直接写NPC听见后的反应。\n- 用户明确移动：可用“抵达X后/来到X时”作为过渡，之后写场景；不要补动机、心境或动作姿态。\n- 用户明确完成一项行动：可以写行动造成的客观结果和NPC配合，但不替玩家补具体操作过程。\n- 避免以“你决定/你想/你感到/你发现/你不禁/你意识到/你安慰/你邀请/你调整……”开启新的玩家行为。\n- 不为{{user}}写任何引号台词。'''
if '【正文镜头范式】' not in byid[4]['content']:
    byid[4]['content']=byid[4]['content'].rstrip()+'\n\n'+grammar

unknown_guard='''【unknown＝未确认】\n- `cores`中为unknown的区域，正文不得断言该黑核“安全/暂时安全/已经被夺/正在某地点/已经可以净化”。\n- 若当前事件没有产生足以更新core的可靠结果，就维持unknown，并让NPC用“尚未确认/没有足够情报”表达。\n- 世界气氛、敌方活动或风险提示不能自动升级为对黑核结果的确证。'''
for eid in (4,13,14,37,91):
    if '【unknown＝未确认】' not in byid[eid]['content']:
        byid[eid]['content']=byid[eid]['content'].rstrip()+'\n\n'+unknown_guard

syb='''【西比尔调查｜条件内容不展开】\n- “取得完整救援条件”是一个状态结果，不代表当前母版提供了那些条件的具体条目。\n- 在额外调查正文中，不得枚举“第一/第二/第三条件”，不得发明人员分工、屏障、诱敌、精准干预、能量波动、具体信号、时间秒数、治疗步骤等可执行细节。\n- 安托涅瓦/爱缪莎只需要确认：“现有观察与资料已经整理出后续救援需要把握的时机和协作条件，完整条件已掌握；具体条目当前资料未展开。”\n- 允许表现角色谨慎、严肃、继续记录资料；不允许为了让场景显得专业而现场创造救援方案。\n- 成功后只结算节点和`sybilla_condition_obtained=true`，正文不宣称“成功率提高多少”。'''
for eid in (10,30,66):
    if '【西比尔调查｜条件内容不展开】' not in byid[eid]['content']:
        byid[eid]['content']=byid[eid]['content'].rstrip()+'\n\n'+syb

ann='''【ANN_PHOTO叙事控制权】\n- 玩家明确进行拍照/记忆角色剧情后，1节点与事件登记照常结算。\n- 正文从快门、照片、安的反应或她自己的表达展开；不得替{{user}}写拍照口令、安慰话、承诺或关系表态。\n- 安可以主动谈她对“留下记忆/拥有自己的过去与未来”的感受，玩家如何回应由玩家自己决定。'''
if '【ANN_PHOTO叙事控制权】' not in byid[90]['content']:
    byid[90]['content']=byid[90]['content'].rstrip()+'\n\n'+ann

state='''【正文认知守恒】\n- 后台unknown不仅是状态值，也是叙事认知边界；没有本轮新证据就不得在正文把unknown解释成安全/失守/可净化。\n- 状态可以正确但正文仍可能违规；输出前必须同时检查“正文有没有多知道、替玩家多做、多说、多想”。'''
if '【正文认知守恒】' not in byid[91]['content']:
    byid[91]['content']=byid[91]['content'].rstrip()+'\n\n'+state

dp=d['data']['extensions']['depth_prompt']['prompt']
if 'NPC/环境优先叙事' not in dp:
    d['data']['extensions']['depth_prompt']['prompt']=dp.rstrip()+' ⑭NPC/环境优先叙事，不生成玩家引号台词、内心、情绪或额外动作步骤。⑮unknown是正文认知锁，未确认就不能说安全/失守/可净化。⑯西比尔调查只确认“完整条件已掌握”，不展开任何具体条件条目。'
note='v0.4.9-lab：加入NPC/环境优先的叙事镜头锁与玩家台词/主观零生成；unknown升级为正文认知锁；西比尔救援条件只登记“已掌握”而不枚举具体条目。'
notes=d['data'].get('creator_notes','')
if note not in notes:
    d['data']['creator_notes']=notes.rstrip()+('\n' if notes.strip() else '')+note

patched=json.dumps(d,ensure_ascii=False,indent=2).encode('utf-8')
sha2=hashlib.sha256(patched).hexdigest()
if sha2 != TARGET_SHA:
    raise SystemExit(f'v0.4.9 sha mismatch: {sha2}')

fix=Path.cwd()/'fixtures'/'f7d'
for p in fix.glob('card.*.b64'):
    p.unlink()
encoded=base64.b64encode(gzip.compress(patched,compresslevel=9,mtime=0)).decode('ascii')
(fix/'card.00.b64').write_text(encoded,encoding='utf-8')

# runtime smoke has already been rewritten to v0.4.8 by build-v048.py
p=Path.cwd()/'.lab'/'runtime-smoke.mjs'
s=p.read_text(encoding='utf-8')
s=s.replace(BASE_SHA,TARGET_SHA).replace('0.4.8-lab','0.4.9-lab').replace('f7d-v048','f7d-v049')
needle="    has_sybilla_whitelist: lore.some(e => String(e?.content || '').includes('西比尔额外调查｜正文白名单')) ,"
# tolerate the install.sh workaround's no-space form as well
if needle not in s:
    needle="    has_sybilla_whitelist: lore.some(e => String(e?.content || '').includes('西比尔额外调查｜正文白名单'))," 
extra_fields=(
    "\n    has_narrative_camera_lock: post.includes('叙事镜头锁｜NPC/环境优先'),"
    "\n    has_unknown_lock: post.includes('unknown认知锁') && lore.some(e => String(e?.content || '').includes('unknown＝未确认')),"
    "\n    has_sybilla_condition_opaque: lore.some(e => String(e?.content || '').includes('西比尔调查｜条件内容不展开')) ,"
)
if 'has_narrative_camera_lock:' not in s:
    if needle not in s:
        raise SystemExit('runtime-smoke v0.4.8 whitelist anchor missing')
    s=s.replace(needle,needle+''.join(extra_fields))
oldreq="'has_player_agency','has_ann_node_rule','has_sybilla_whitelist'"
newreq="'has_player_agency','has_ann_node_rule','has_sybilla_whitelist','has_narrative_camera_lock','has_unknown_lock','has_sybilla_condition_opaque'"
if oldreq in s:
    s=s.replace(oldreq,newreq)
if newreq not in s:
    raise SystemExit('runtime-smoke v0.4.9 required anchors missing')
p.write_text(s,encoding='utf-8')

(OUT/'f7d-v049-card.json').write_bytes(patched)
(OUT/'f7d-v049-fixture.json').write_text(json.dumps({
    'sha256':sha2,'version':d['data']['character_version'],'entries':len(entries),
    'regex_scripts':len(d['data'].get('extensions',{}).get('regex_scripts',[])),
    'creator':d['data'].get('creator'),
    'narrative_camera_lock':'【叙事镜头锁｜NPC/环境优先】' in d['data']['post_history_instructions'],
    'unknown_lock':'【unknown认知锁】' in d['data']['post_history_instructions'],
    'sybilla_condition_opaque':all('【西比尔调查｜条件内容不展开】' in byid[x]['content'] for x in (10,30,66)),
},ensure_ascii=False,indent=2),encoding='utf-8')
print('F7D exact v0.4.9 candidate built:',sha2)
