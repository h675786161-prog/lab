import json, pathlib, hashlib, subprocess, copy

root = pathlib.Path('.lab/fixtures/qidu-day-gate')
subprocess.run(['python3', str(root / 'apply-node1.py')], check=True)

src = root / 'Qidu-v0.4.46-node1-guard-fix.json'
dst = root / 'Qidu-v0.4.47-node2-day6-hardflow-history.json'
card = json.loads(src.read_text(encoding='utf-8'))

card['character_version'] = '0.4.47-node2-day6-hardflow-history'
card['data']['character_version'] = '0.4.47-node2-day6-hardflow-history'

entries = card['data']['character_book']['entries']
byid = {e.get('id'): e for e in entries}

# Always-on chronology anchor.
if 5 not in byid:
    base = copy.deepcopy(byid[4])
    base.update({
        'id': 5,
        'name': '05｜世界历史时间锚',
        'comment': '05｜世界历史时间锚',
        'keys': [],
        'secondary_keys': [],
        'content': '''【世界历史硬时间锚｜禁止改写】
- 十几年前，黑门相关灾害最先在交界都市爆发；神器使也在这一历史阶段出现。黑门、灾害与神器使都不是半年前才第一次出现。
- 此后灾害影响范围一度扩展到交界都市之外。约半年前发生的是“灾害范围终于被控制并压缩回交界都市”，交界都市正是最初爆发的城市。
- 因此“半年前”只能修饰灾害范围被控制/压制到交界都市，绝不能写成“半年前黑门首次出现”“半年前灾害才开始”“半年前才有神器使”。
- 没有更精确资料时只使用“十几年前”“约半年前”，不得自行编造具体年份、月份或全球灾害细节。''',
        'enabled': True,
        'constant': True,
        'insertion_order': 6,
        'priority': 100,
    })
    base['extensions']['display_index'] = 5
    entries.insert(5, base)

byid = {e.get('id'): e for e in entries}

old = '苏醒后的新手说明只开放交界都市、黑门早在多年前就已存在、直到半年前才被逐步控制并压制到交界都市，以及神器使/指挥使/中央庭/战术终端等基础事实。'
new = '苏醒后的新手说明只开放基础事实：十几年前黑门灾害最先在交界都市爆发、神器使也在那一时期出现；灾害影响后来一度扩展到交界都市之外，约半年前才终于把灾害范围控制并压缩回最初爆发的交界都市。另可说明神器使/指挥使/中央庭/战术终端等基础概念。不得把“半年前”写成黑门、灾害或神器使的首次出现时间。'
assert old in byid[10]['content']
byid[10]['content'] = byid[10]['content'].replace(old, new)

old = '黑门多年前已经存在，半年前才把灾害压制到交界都市。她看不到你的悬浮倒计时，对其含义没有已确认的知识。'
new = '十几年前黑门灾害已经在交界都市爆发，神器使也在那一历史阶段出现；约半年前只是把已经扩展过的灾害范围重新控制并压缩回交界都市，并非黑门在半年前才出现。她看不到你的悬浮倒计时，对其含义没有已确认的知识。'
assert old in byid[41]['content']
byid[41]['content'] = byid[41]['content'].replace(old, new)

byid[11]['content'] = '''【第6天清晨强制剧情｜08:00｜0节点｜不可分支】
这是第6天醒来后的完整强制晨间链。只要本链尚未全部结束，就暂停巡查、自由行动、地区剧情和普通任务推进，时钟始终锁在08:00。不得把其中任何一段改成可选支线，也不得用<f7d_choices>让{{user}}决定是否执行关键结果。若单次回复长度不足，可以分多轮续写，但下一轮必须从“尚未完成的下一个固定步骤”继续，不重演已完成步骤，也不开放其他行动。

【固定顺序｜必须逐项发生，禁止跳步或换序】
1. 小神自语：{{user}}尚未醒来时，先出现小神模糊、短暂的自语/低语。若当前尚未正式识别小神身份，只写声音与意象，不点破身份；声音只用“你”称呼{{user}}，不称“指挥使”。真实演完后登记morning_flags.day6_monologue=true。
2. 安拍门叫醒：清晨，安急促拍门把{{user}}吵醒。她刚接到紧急消息，只明确“出事了/需要立刻过去”，不要在尚未亲眼看见现场前替所有人完整解释活骸机制。{{user}}与安立刻一同前往事发地。
3. 目睹赛哈姆活骸化：抵达后，{{user}}与安亲眼看见失控的赛哈姆已经发生活骸化并制造现实危险。此时重点写现场异常、威胁和角色反应，不先用后台术语讲完机制。
4. 安迎战并不敌：安为了阻止赛哈姆继续伤人主动迎战，但明确处于下风并被逼退/压制。这里是“安不敌”，不是“指挥使正面不敌”，也不能让{{user}}突然代替安单独打赢。
5. 希罗、罗纳克、奥露西娅介入：希罗带着罗纳克、奥露西娅出现；希罗让跟随的罗纳克先救场、挡下失控攻击并替安解围，随后奥露西娅出手完成最后的压制与控制。这里的“解决”只指制服，不是杀死：赛哈姆必须重伤、存活、被控制住，不能当场死亡或恢复正常。
6. 希罗解释活骸化并要求保密：现场稳定后，希罗向{{user}}说明“这就是活骸化；神器使也可能出现这种无法控制自身、会造成现实危险的异常状态”这一层基础事实，并明确希望{{user}}隐瞒今天发生的事，尤其不要把赛哈姆活骸化告知安托涅瓦。此处只允许讲现象与危险，不解释病理因果：禁止写“体内幻力彻底失控/侵蚀超过临界/幻力达到阈值所以活骸化”等自创机制；禁止补造神格、神经系统、感染链、不可逆定律、唯一治愈装置、保证逆转等设定；也不得声称“安托涅瓦一定会处决赛哈姆/中央庭唯一惯例就是抹杀活骸”。如果需要回答成因，只能说当前并未在这里给出完整机制。
7. 指挥使固定拒绝：本主线节点中{{user}}拒绝希罗的保密要求，这是既定主线事实，不提供“答应/沉默/暂不表态”等分支，也不等待玩家选择。只替{{user}}落实“拒绝隐瞒”这一必要立场，不擅自添加额外情绪、价值宣言或长篇台词。
8. 希罗带走赛哈姆：希罗对拒绝表示遗憾，但仍带着已经被控制、重伤存活的赛哈姆离开；罗纳克、奥露西娅随其行动。正文必须明确赛哈姆本人实际离开现场，不能只写“准备转移/担架待命/希罗自己走了”。
9. 回中央庭报告：{{user}}随后回到中央庭，必须把刚才的赛哈姆活骸化、希罗介入和保密要求报告给安托涅瓦；“是否报告”不是选项。安可以陪同，但报告行为必须由{{user}}完成或明确参与。
10. 安托涅瓦讲第一活骸事故：安托涅瓦听完后，明确说明十几年前就出现过第一名活骸化神器使。第一个活骸无法控制自己并在城市中大肆破坏；中央庭当时派出三人小队阻止，另外两名队员死亡；安托涅瓦的双腿正是在那场事故中残废、从此失去行走能力；第一个活骸最后在巨大痛苦中自我毁灭。不要写成她被截肢或“失去双腿”这一肢体缺失含义，也不得补平民伤亡数字、具体死法、队员特殊关系、事故后新制度等未定义细节。
11. 本链结束：只有步骤1—10全部真实演出完成后，才登记morning_flags.day6_saiham=true，并允许后续第6天普通行动开始。此标记在本版语义上代表“第6天赛哈姆强制晨间链（含向安托涅瓦报告）已经完整结束”，不再只代表赛哈姆离场。

【固定知情结算】
- 希罗完成基础解释后，可登记intel_flags.chimera_exists_known=true；是否登记hiro_chimera_research_known必须以正文实际披露为准，不因他现身自动获得。
- 安托涅瓦完整讲完第一活骸事故后，登记intel_flags.first_chimera_incident_known=true。
- 赛哈姆被带走后，本轮普通主视角、中央庭常规会议、战斗同伴、手机与常规角色心声都不得继续把赛哈姆当作在场人物；只有明确切到希罗侧场景才可描写其后续状态，且不会自动同步给{{user}}或中央庭。

【强制链抗偏航】
- {{user}}在强制链中可以说话、追问、观察或尝试行动，模型可自然回应这些局部动作，但不得因此改变上述十一步的关键事实和先后顺序。
- 若{{user}}试图提前巡查、睡觉、离开、阻止希罗永久带走赛哈姆、答应保密等与既定主线冲突的行动，正文可以写“尚未来得及/现场局势迫使流程继续/该尝试没有改变既定结果”，然后继续下一个固定步骤；不要为此另开分支。
- 强制链结束前禁止出现普通自由行动选项。完成安托涅瓦回忆、状态结算并把行动权交回{{user}}后，才可恢复正常选择。

【世界时间与历史一致性】
十几年前黑门灾害已在交界都市爆发，神器使也已出现；约半年前发生的是灾害范围被控制并压缩回最初爆发的交界都市。绝不能在本段或安托涅瓦回忆中写“黑门半年前才出现/神器使半年前才出现”。

【时限】第6天结束前若未解放高校与东方古街/中央城区之一，按失败结算；不得补做。'''

first_chimera = '''【第一活骸事故精确披露】
- 这段历史在第6天赛哈姆强制晨间链中，由{{user}}回到中央庭报告后，安托涅瓦固定披露；不再做“是否告诉她”的分支。
- 时间必须明确为“十几年前”。这是早期灾害时代已经发生的事故，不得改成半年前或近期事件。
- 她必须明确这是第一个出现的活骸化神器使/第一名活骸：它无法控制自己，在城市中大肆破坏；中央庭派出三人小队阻止，最终另外两名队员死亡；安托涅瓦的双腿在那场事故中残废、从此失去行走能力；该活骸最后在巨大痛苦中自我毁灭。
- “双腿残废/失去行走能力”是功能损伤，不得擅自写成截肢、双腿消失或身体缺失。
- 第一活骸身份未解锁时只称“它/第一个活骸/第一名活骸”，不披露未经确认的身份与既往关系。
- 不得自行补平民伤亡数、街区毁坏比例、爆炸范围、队员死法、安托涅瓦是否队长、队员分工、特殊友情/亲属关系、当时为何只出动三人、事故后新增法规或“已经确认绝无挽回可能”等未定义细节。
- 安托涅瓦可以说明这段亲历塑造了她面对活骸问题时的谨慎与严厉，但不得把个人经验扩写成“中央庭必然处决所有活骸”的制度。'''
for eid in (97, 98):
    byid[eid]['content'] = first_chimera

prompt = card['data']['extensions']['depth_prompt']['prompt']
old = '2. 晨间/强制剧情优先；第6天起床前小神低语和赛哈姆活骸化及希罗介入不得跳；第6天首入中央城区演出赛斯。随后再排首轮主线、角色剧情、地区与自由行动。'
new = '2. 晨间/强制剧情优先。第6天必须按固定链走完：小神醒前自语→安拍门叫醒并带你赶往事故现场→亲眼见赛哈姆活骸化→安迎战不敌→希罗带罗纳克、奥露西娅介入（罗纳克救场、奥露西娅完成压制，赛哈姆重伤存活）→希罗解释活骸并要求保密→指挥使固定拒绝→希罗遗憾并实际带走赛哈姆→指挥使回中央庭报告安托涅瓦→安托涅瓦讲十几年前第一活骸事故及双腿残废。整链完成前08:00锁定、不得开放自由选项；第6天首入中央城区再演出赛斯。随后才排首轮主线、角色剧情、地区与自由行动。'
assert old in prompt
card['data']['extensions']['depth_prompt']['prompt'] = prompt.replace(old, new)

guard = next(s for s in card['data']['extensions']['tavern_helper']['scripts'] if '__F7D_MVU_GUARD__' in s.get('content', ''))
js = guard['content']
marker = "  const day6DecisionMade=user=>{"
assert marker in js
insert = r'''  const hasDay6FixedResolution=text=>{
    const t=String(text||'');
    if(!hasSaihamDeparture(t))return false;
    const annLost=/安[\s\S]{0,700}(?:不敌|被逼退|被压制|落入下风|受创)/.test(t);
    const helpers=/罗纳克/.test(t)&&/奥露西娅/.test(t);
    const refusal=/(?:你|指挥使)[^。\n]{0,100}(?:拒绝[^。\n]{0,30}(?:保密|隐瞒|希罗)|不(?:会|愿|肯)[^。\n]{0,30}(?:保密|隐瞒)|不会替[^。\n]{0,30}保密)/.test(t);
    const reported=/(?:回到|返回|赶回)[^。\n]{0,100}中央庭[\s\S]{0,800}安托涅瓦/.test(t)&&/(?:报告|告诉|说明|讲述)[^。\n]{0,160}(?:赛哈姆|活骸|希罗)/.test(t);
    const history=/(?:十几年前|十余年前)/.test(t)&&/(?:第一(?:名|个)[^。\n]{0,20}活骸|第一个活骸)/.test(t)&&/(?:双腿[^。\n]{0,80}(?:残废|无法行走|失去行走能力)|(?:残废|无法行走|失去行走能力)[^。\n]{0,80}双腿)/.test(t);
    return annLost&&helpers&&refusal&&reported&&history;
  };
'''
js = js.replace(marker, insert + marker, 1)

old = "    if(prior.day===6&&day6DecisionMade(user)&&hasMorningVoice(transcript)&&hasSaihamDeparture(transcript))addFlag('day6_saiham');"
new = r"""    if(prior.day===6&&hasMorningVoice(transcript)&&hasDay6FixedResolution(transcript)){
      addFlag('day6_saiham');
      if(get(prior,'intel_flags.first_chimera_incident_known')!==true&&!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='intel_flags.first_chimera_incident_known'&&parse(c.args?.at(-1))===true))
        commands.push({type:'set',args:['intel_flags.first_chimera_incident_known','false','true'],reason:'已听完安托涅瓦关于十几年前第一活骸事故的亲历说明'});
    }"""
assert old in js
js = js.replace(old, new, 1)

old = "      if(path==='morning_flags.day6_saiham'&&next===true)invalid||=!day6DecisionMade(user)||!enteringDay6||get(prior,'morning_flags.day6_monologue')!==true&&!commands.some(c=>String(c.args?.[0]||'').includes('day6_monologue'))&&!hasMorningVoice(transcript)||!hasSaihamDeparture(transcript);"
new = "      if(path==='morning_flags.day6_saiham'&&next===true)invalid||=!enteringDay6||get(prior,'morning_flags.day6_monologue')!==true&&!commands.some(c=>String(c.args?.[0]||'').includes('day6_monologue'))&&!hasMorningVoice(transcript)||!hasDay6FixedResolution(transcript);"
assert old in js
guard['content'] = js.replace(old, new, 1)

rule = byid[91]['content']
old = '晨间完成标记仅在整段事件及其必要交谈实际结束、行动权交回玩家后登记；停在邀请、要求保密或等待回答时不算结束。'
new = '晨间完成标记仅在整段事件及其必要交谈实际结束、行动权交回玩家后登记；第6天尤其必须连同“回中央庭报告安托涅瓦并听完十几年前第一活骸事故”一起完成，不能在赛哈姆刚离场时提前结束晨间锁。'
assert old in rule
byid[91]['content'] = rule.replace(old, new, 1)

blob = json.dumps(card, ensure_ascii=False)
assert '05｜世界历史时间锚' in blob
assert '十几年前' in byid[11]['content']
assert '罗纳克' in byid[11]['content'] and '奥露西娅' in byid[11]['content']
assert '体内幻力彻底失控/侵蚀超过临界' in byid[11]['content']
assert '玩家可答应、拒绝、质疑或沉默' not in byid[11]['content']
assert '不再只代表赛哈姆离场' in byid[11]['content']
assert '双腿在那场事故中残废' in byid[97]['content']
assert '黑门早在多年前' not in blob

dst.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'node2 hardflow candidate ready: {dst} sha256={hashlib.sha256(dst.read_bytes()).hexdigest()}')
