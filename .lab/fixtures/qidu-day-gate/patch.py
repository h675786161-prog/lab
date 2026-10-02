import json,re,uuid
from pathlib import Path
root=Path('.lab/fixtures/qidu-day-gate')
src=Path('.lab/fixtures/f7d-terminal-v1-formal/Qidu-v0.4.41-terminal-v1.json')
card=json.loads(src.read_text())
data=card['data'];data['character_version']='0.4.42-day-gate'
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
scripts=data['extensions']['tavern_helper']['scripts']
scripts.insert(0,{'type':'script','enabled':True,'id':str(uuid.uuid4()),'name':'七都日程加载','content':(root/'day-gate.js').read_text(),'info':'','button':{'enabled':False,'buttons':[]},'data':{}})
(root/'Qidu-v0.4.42-day-gate.json').write_text(json.dumps(card,ensure_ascii=False,indent=2)+'\n')
report={'base':src.name,'version':data['character_version'],'gated':{str(e['id']):e['comment'] for e in entries if e['comment'].startswith('[F7D_GATE:')},'reveals':reveals,'scripts':[{'name':s['name'],'enabled':s.get('enabled')} for s in scripts]}
(root/'revision-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
