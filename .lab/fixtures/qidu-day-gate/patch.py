import json,re,uuid
from pathlib import Path
root=Path('.lab/fixtures/qidu-day-gate')
src=Path('.lab/fixtures/f7d-terminal-v1-formal/Qidu-v0.4.41-terminal-v1.json')
card=json.loads(src.read_text())
data=card['data'];data['character_version']='0.4.45-morning-lore-correct'
entries=data['character_book']['entries'];by={e['id']:e for e in entries}
def gate(e,r):
 e['comment']='[F7D_GATE:'+json.dumps(r,ensure_ascii=False,separators=(',',':'))+'] '+e.get('comment','')
 e['enabled']=False;e['constant']=False
 e.setdefault('extensions',{}).update({'sticky':0,'cooldown':0,'delay':0})
for i,d in {10:7,11:6,12:5,13:4,14:3,15:2,16:1,17:1}.items():gate(by[i],{'day':d})
gate(by[18],{'route':'ann','unlock':3})
for i,d in {30:7,31:7,32:7,33:5,34:4,35:3,36:4,90:7}.items():gate(by[i],{'unlock':d})
gate(by[64],{'saiham':True})
by[1]['content']='''【每日时间】一天从08:00开始，拥有16小时，主要行动以80分钟为一节点，共12节点。由实际移动、巡查、战斗、救援等事件确定耗时；同一行动分多轮描写只结算一次。短交谈、询问、观察与固定晨间剧情不计时。00:00强制睡觉并跨入下一天，时钟回到08:00。固定剧情未实际结束前，先完成当前剧情，不接受普通行动结算。当前日程由已提交存档的day决定，不由玩家措辞或聊天中的日期关键词决定。'''
by[2]['content']='''【事实与知情】只依据当前已加载日程、已发生事件和当前存档推进。未来日程未开放时，不推测下一天固定事件、人物命运或黑核后果。世界已经发生、玩家亲眼所见、人物实际知情分别判断；不在场人物无信息来源不得自动得知。已完成的固定事件只保留后果，不重复演出。玩家态度不等于实际行动，上一轮未选的选项不自动执行。'''
by[37]['content']='''【黑核状态】unknown代表未确认，available代表已确认且仍可按当前已开放条件处理，purified与lost是本轮不可逆终态。区域解放不等于黑核净化。正文不写变量枚举与隐藏结局条件；未知时只说尚未确认。只有当前日程或区域中已经开放且实际发生的证据能改变黑核状态。'''
by[91]['content']='''【变量更新】以stat_data为唯一变量树。按实际事件用_.set('已有路径',旧值,新值)更新；不得将说明文字写入数字、布尔值或枚举字段。tasks、relationships和npc_intel可在其extensible范围内新增，其他未知路径不得新建。正文不写完整快照、节点进度、后台枚举或更新代码。晨间完成标记仅在整段事件及其必要交谈实际结束、行动权交回玩家后登记；停在邀请、要求保密或等待回答时不算结束。时钟只在实际普通行动后变化。倒计时只在初醒出现一两次，此后仅在数字发生变化且玩家实际感知时进入正文。短交谈不计时；单次行动分轮叙述不重复结算。'''
style='''\n【叙述方式】外貌信息融入人物动作、视线与现场描写，不用“姓名（发色、服饰）”或括号式人物资料。首次见面可写清发型、服装、配饰；后续只写当前有意义的细节，不重复整套介绍。小神对指挥使通常直接称“你”；不称“这名新人”“这个指挥使”来代指正在听她说话的玩家，不替玩家写心理或选择。'''
by[4]['content']+=style
by[4]['content']+='''【玩家决策边界】当NPC正在向{{user}}提出必须由玩家决定的邀请、保密要求、路线选择、是否同行、是否接受物品或其他明确取舍时，本轮必须停在问题与选项处。{{user}}尚未明确回答前，不得代替其作答，也不得越过该决定继续演出“NPC离场、伤势结算、路线切换、后续会议”等只有答复后才成立的结果。{{user}}说“先听”“观察”“问清楚”“再看看”只允许继续补充当下信息，不能视为默认拒绝、默认同意或默认沉默选项。'''
by[70]['content']+='\n说话对象：晨间低语面向正在经历轮回的你，以第二人称与你说话；其身份尚未知时只给声音与意象，不主动自报身份，不预告未开放日程的具体事件。'
by[11]['content']+='\n【带走后的场景边界】本段结束时希罗已带走赛哈姆。此后普通主视角、中央庭会议、战斗同伴、手机和常规角色心声都没有赛哈姆；不得在后续日程重复演“希罗带走赛哈姆”。只有明确切到希罗实验场景，才可描写被带走后的赛哈姆，且实验室内容不自动成为指挥使或其他人物的知识。'
by[12]['content']+='\n【既成事实】赛哈姆已在此前被希罗带走，本日不会再次在中央庭被带走，也不出现其普通角色视角。安托涅瓦可追问希罗此前带走她的事，但不得喊“不能带走赛哈姆”来制造她仍在现场的错觉。分裂完成须希罗实际离开、安托涅瓦病情变化与交谈收束；邀请等待玩家回答时day5_split仍为false。'
by[64]['content']+='\n限制：被希罗带走后，不再进入普通人物视角、日常通讯、主视角同伴或中央庭现场。仅明确的希罗实验视角允许描写其后续状态，不能通过心声把实验内容泄露给玩家。'
# 尚未揭露的身世、轮回真相与未来命运离开人物常驻档案。
reveals=[]
for ident,flag,pattern in [
 (40,'intel_flags.ann_origin_known',r'机器人|希罗造物|希罗.*创造|希罗.*制造|玩偶'),
 (43,'intel_flags.loop_truth_known',r'轮回.*真相|打破.*轮回|最终.*结局'),
 (70,'intel_flags.zero_identity_known',r'零.*真实身份|真实身份.*零')]:
 e=by[ident];parts=re.split(r'(?<=[。\n])',e['content']);keep=[];hidden=[]
 for p in parts:
  (hidden if re.search(pattern,p) else keep).append(p)
 e['content']=''.join(keep)
 if hidden:
  n={'id':max(z['id'] for z in entries)+1,'keys':[],'secondary_keys':[],'comment':'人物已揭露事实','content':''.join(hidden),'enabled':False,'constant':False,'insertion_order':e.get('insertion_order',100),'position':e.get('position','before_char'),'extensions':{}}
  gate(n,{'flag':flag});entries.append(n);reveals.append(n['id'])
# 其他常驻说明中不加载完整逐日安排；当前日程由独立条目承担。
for field in ['system_prompt','post_history_instructions','scenario','personality','description']:
 value=data.get(field)
 if isinstance(value,str):
  lines=value.splitlines()
  data[field]='\n'.join(l for l in lines if not re.search(r'第[一二三四五六1-6]天.*(?:希罗|安托涅瓦|离开|分裂|活骸|黑核|结局)',l))
for e in entries:
 if e['id']<10 and e['id']!=4:
  e['content']='\n'.join(l for l in e['content'].splitlines() if not re.search(r'第[一二三四五六1-6]天.*(?:希罗|安托涅瓦|离开|分裂|活骸|黑核|结局)',l))

# 将人物档案中的后续事实一并移出常驻上下文。
def secret(text,rule):
 if not text.strip():return
 n={'id':max(z['id'] for z in entries)+1,'keys':[],'secondary_keys':[],'comment':'已开放剧情事实','content':text,'enabled':False,'constant':False,'insertion_order':100,'position':'before_char','extensions':{}}
 gate(n,rule);entries.append(n);reveals.append(n['id'])
def cut(ident,start,end=None):
 text=by[ident]['content'];a=text.find(start)
 if a<0:return ''
 b=text.find(end,a) if end else len(text)
 if b<0:b=len(text)
 out=text[a:b];by[ident]['content']=text[:a]+text[b:];return out
secret(cut(40,'身份揭晓后机械描写硬限制：','【前期信息权限】'),{'flag':'intel_flags.ann_origin_known'})
cut(40,'【前期信息权限】')
by[40]['content']=re.sub(r'性别/称谓硬锚：[^\n]*','性别/称谓硬锚：女性，第三人称使用“她”。',by[40]['content'])
by[40]['content']=by[40]['content'].replace('身份真相揭露前后都保持自然少女外观。','保持自然少女外观。')
by[40]['content']+='\n信息权限：只知道公开历史与实际被告知的事情，未揭露的秘密不主动提及。'
history=cut(41,'【第一活骸事故精确披露】')
history=re.sub(r'[^\n]*零[^\n]*','- 本段不披露未经确认的身份。',history)
secret(history,{'day':6})
secret(history,{'flag':'intel_flags.first_chimera_incident_known'})
cut(41,'对活骸问题')
by[41]['content']=by[41]['content'].replace('因过去严重异化/战斗损伤失去正常步行能力。','常坐轮椅。')
by[41]['content']+='\n黑门多年前已经存在，半年前才把灾害压制到交界都市。她看不到你的悬浮倒计时，对其含义没有已确认的知识。'
by[43]['content']=by[43]['content'].replace('前中央庭核心人物','中央庭建立者与核心人物')
cut(43,'【指挥使身份与信息权限】')
by[43]['content']+='\n希罗是资深指挥使，也是你到来前中央庭主要的指挥使。当前是否代表中央庭依据实际发生的事件判断，不能提前自称前成员。'
by[10]['content']+='\n初见希罗时，他以资深前辈身份自然确认新任指挥使，并递来一颗草莓糖；是否接下由你决定。'
secret('希罗正式离开中央庭后不再代表中央庭行动，但仍有指挥使能力身份；此前不能预演分裂。',{'flag':'morning_flags.day5_split'})
secret(cut(44,'【活骸知识边界】','【高校剧情阶段二姓名来源顺序】'),{'flag':'intel_flags.chimera_exists_known'})
secret(cut(44,'【珈儿来源追问必须直接否认】'),{'flag':'intel_flags.chimera_exists_known'})
secret(cut(45,'让·塔克死亡后的事实边界：'),{'unlock':5})
gate(by[45],{'unlock':5})
cut(64,'第6天固定活骸事件中','不能把她写成')
by[64]['content']=by[64]['content'].replace('活骸化前后外观变化必须随剧情发生。','外观变化必须随当前实际发生的剧情。')
block=cut(32,'【第6天赛斯必演】','【地区结算】')
secret(block,{'day':6})
for ident in [30,66]:
 by[ident]['content']=by[ident]['content'].replace('活骸风险','幻力失控风险')


# 保留实机确认的修正；生成候选卡时同样应用，避免从旧底稿覆盖。
by[1]['content']+='\n【正文边界】行动节点、剩余次数、已用时间、变量名、英文状态和巡查进度仅写变量并由界面展示，正文和人物台词不报这些计数。研究所开启前的4次自由行动只是解锁门槛，不是每日行动总数；全日仍为16小时、12个80分钟节点。'
for ident in [10,11,12,13,14,15,16,17]:
 by[ident]['content']+='\n【醒前声音称呼】这段声音只用“你”指代玩家，不称呼“指挥使”，不透露声音的身份。实际自语结束后必须登记本日monologue标记；已登记就不重复演。'
by[11]['content']+='\n【跨轮登记】本日小神自语已经在前一回复演完时，本轮无需重复正文，可按既成事实补记day6_monologue。day6_saiham只在赛哈姆实际被抬走、离开中央庭后登记；希罗声称要带走、正在压制、担架仍在现场都不算结束。已演出的现场以既有回复为准，不在后续回复重演。变量命令只用_.set(路径,旧值,新值)，不传state对象。'
by[11]['content']+='\n【处置事实边界】不得新增“中央庭唯一处置惯例是彻底抹杀、必定处决赛哈姆”等制度。希罗可表达自己的立场或要求保密，但不能凭空援引不存在的处置条例。活骸机理只按已加载资料解释，不补造神格、神经系统不可逆崩坏等专业机制。'\nby[11]['content']+='''【保密决定边界】希罗提出“是否对安托涅瓦保密”后，若{{user}}只是观察、追问活骸化或要求解释，赛哈姆仍处于收容/待转移现场，不得把“准备撤离、将送往研究所”写成已经离开。只有{{user}}对保密要求作出明确态度，或明确表示不作承诺并允许现场继续后，才可演出希罗一行实际带着赛哈姆离开；day6_saiham也只能在完成离场的正文之后登记。'''
by[12]['content']=by[12]['content'].replace('【研究所开启】第5天开始后，玩家先拥有4次自由主要行动。累计完成第4次后，研究所主线开放。','【研究所开启】第5天完成晨间固定剧情后，前4个主要行动为研究所解锁前的自由行动。完成第4个后研究所主线开放；这不是每日总行动数，之后还有当天剩余时间。正文只通过新的调查消息呈现开放事件，不报行动次数。')
by[12]['content']+='''【拉拢决定边界】希罗向{{user}}提出拉拢后必须等待玩家明确态度。“先听他们说”“先观察”“继续听争论”不是选择，希罗可以继续与安托涅瓦交锋或补充理由，但不能因此自行离开中央庭，安托涅瓦也不能提前进入分裂后的倒下结算，day5_split必须保持false。只有{{user}}明确拒绝、支持/认同、愿意合作，或明确选择保持沉默/不表态作为回应后，才继续演出希罗离开、安托涅瓦力竭与晏华接手，并在整段收束后登记day5_split。'''
by[91]['content']+='''【未决选择与状态】任何等待{{user}}明确回应的决定都不是“已发生事件”。模型即使在正文中误写了后续结果，也不得据此提前提交晨间完成标记；优先保持未决状态，并在下一轮按玩家真实输入承接，不重复演已经明确发生过的同一离场/倒下片段。'''
data['post_history_instructions']+='''7. 遇到直接要求{{user}}表态的邀请、保密、路线、同行或接受/拒绝事项时，把它当作硬停止点：本轮写到问题与可选行动即停。{{user}}说“先听/观察/追问/再看看”只补当前信息，不得自动执行同意、拒绝、沉默或后续离场；只有{{user}}明确给出态度后才结算由该态度触发的后果。'''
by[91]['content']+='''【位置同步】location记录玩家当前实际所在场景，不等同于计时。短距离移动可以0分钟，但只要正文已经写明“你来到/进入/抵达”另一处地点，就必须在同一回复同步location；不能让正文人在会议室而存档仍停在寝室。'''
by[12]['content']+='''【分裂争论事实边界】本日争论可引用此前已经发生的赛哈姆事件，但在未有实际证据或此前剧情明确建立之前，不得把“赛哈姆自愿接受改造/调适”“她主动要求实验”“某个具体B区、C区、D区被切断”“某份精确权限日志证明某事”写成既定事实。需要体现希罗与晏华的分歧时，用已知行为、立场和可核实异常，不凭空补造研究记录。'''
data['post_history_instructions']+='''8. location随正文实际位移同步：0分钟移动也要改位置。人物争论只引用已建立事实，不得凭空添加赛哈姆自愿实验或不存在的研究所精确分区、权限记录；未开放的后续证据继续受日程与知情门控约束。'''

scripts=data['extensions']['tavern_helper']['scripts']
for script in scripts:
 if 'const signature =' in script['content']:
  script['content']=script['content'].replace("String(m.mes || '').replace(/<StatusPlaceHolderImpl\\/>/g, '')", "String(m.mes || '').replace(/<StatusPlaceHolderImpl\\/>/g, '').trimEnd()")
 if '不可逆' in script['name']:
  script['content']=(root/'morning-guard.js').read_text()

scripts.insert(0,{'type':'script','enabled':True,'id':str(uuid.uuid5(uuid.NAMESPACE_URL,'f7d/day-gate/0.4.42')),'name':'七都日程加载','content':(root/'day-gate.js').read_text(),'info':'','button':{'enabled':False,'buttons':[]},'data':{}})
(root/'Qidu-v0.4.45-morning-lore-correct.json').write_text(json.dumps(card,ensure_ascii=False,indent=2)+'\n')
report={'base':src.name,'version':data['character_version'],'gated':{str(e['id']):e['comment'] for e in entries if e['comment'].startswith('[F7D_GATE:')},'reveals':reveals,'scripts':[{'name':s['name'],'enabled':s.get('enabled')} for s in scripts]}
(root/'revision-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))

(root/'lore-audit.json').write_text(json.dumps({str(e['id']):e['content'] for e in entries},ensure_ascii=False,indent=2))
