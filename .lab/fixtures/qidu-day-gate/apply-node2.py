import json, pathlib, hashlib, subprocess, copy

root = pathlib.Path('.lab/fixtures/qidu-day-gate')
subprocess.run(['python3', str(root / 'apply-node1.py')], check=True)

src = root / 'Qidu-v0.4.46-node1-guard-fix.json'
dst = root / 'Qidu-v0.4.48-node2-day6-canon-timing.json'
card = json.loads(src.read_text(encoding='utf-8'))

card['character_version'] = '0.4.48-node2-day6-canon-timing'
card['data']['character_version'] = '0.4.48-node2-day6-canon-timing'

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

byid[11]['content'] = '''【第6天清晨强制剧情｜08:00｜0节点锁定段 + 后续计时主线】
第6天清晨分成两个连续阶段。阶段A从小神醒前自语开始，到希罗实际带着赛哈姆离开现场为止，是0节点强制剧情，时钟始终锁在08:00；阶段B从希罗离场后开始，解除时间锁，之后{{user}}每执行一个行动都按常规消耗1节点（80分钟）。阶段B的第一个必做主线行动是回中央庭报告安托涅瓦，此行动本身消耗1节点。不得把阶段A拖到报告结束才解锁，也不得让阶段A中的战斗、对话或移动偷扣行动时间。

【阶段A｜08:00锁定｜固定顺序】
1. 小神自语：{{user}}尚未醒来时，先出现小神模糊、短暂的自语/低语。若当前尚未正式识别小神身份，只写声音与意象，不点破身份；声音只用“你”称呼{{user}}，不称“指挥使”。真实演完后登记morning_flags.day6_monologue=true。
2. 安拍门叫醒：安急促拍门把{{user}}吵醒。她刚接到紧急消息，只明确“出事了/需要立刻过去”。{{user}}与安立即赶往事发地。
3. 目睹赛哈姆活骸化：{{user}}与安亲眼看见赛哈姆已经失控并发生活骸化，正在造成现实危险。
4. 安迎战并不敌：安先上前阻止赛哈姆，但处于明显下风，被逼退或压制；不得让{{user}}替代安独自取胜。
5. 希罗、罗纳克、奥露西娅介入：希罗带着罗纳克和奥露西娅出现。罗纳克先救场，挡下赛哈姆的攻击并替安解围；随后奥露西娅完成最后压制。这里的“解决”只指制服和控制，赛哈姆必须重伤、存活，不能当场死亡，也不能恢复正常。

【活骸化｜原作第六天信息口径】
6. 现场稳定后，希罗向{{user}}解释活骸化。按原作口径：神器使与普通人不同，体内存在“幻力”，幻力使人获得超常能力；但幻力本身也像埋在体内的定时炸弹，幻力过高或过低都可能让神器使暴走并成为“活骸”。这就是当前主线在此处允许明确说明的成因。原作没有在这段对话中解释“为什么会过低/过高”的具体病理，因此不得自行补成“幻力被过度抽取耗竭”“体内平衡被打破”“某个阈值/临界点被突破”等机制。
7. 安补充中央庭掌握的结论：活骸化一旦开始，是不能恢复的。中央庭对待活骸的处理方法，是在其丧失神志、更加恶化并造成更大伤亡之前将其消灭。这个规则是原作第六天明确给出的既定事实；不得再写成资料未定义，也不得自行添加“净化只会延长痛苦”“时间回溯只能短暂恢复”等这段对话里没有出现的治疗实验细节，更不得扩写额外法律条文或处决流程。
8. 希罗的立场与中央庭不同。他明确表示自己不想失去任何一个伙伴，更不想亲手消灭他们；赛哈姆的活骸化才刚刚开始，如果研究继续推进，说不定能找到治疗她的方法。因此他想把赛哈姆藏起来继续抢救、研究，并要求{{user}}对安托涅瓦保密。原作同时明确：极力主张必须立刻消灭活骸的人就是安托涅瓦。这里只允许表达“研究推进后说不定能找到治疗方法”这一希望，不得创造“更深层幻力探索”“组织稳定度”“身体组织尚未完全崩溃”“神经系统尚未坏死”等研究理论或病理阶段，也不要改写成希罗嘲讽中央庭“无能”、评价中央庭结论“太过武断/不近人情/冷血”；只保持“希罗不愿失去同伴，因此选择继续研究治疗”的立场分歧。
9. 指挥使固定拒绝：本主线节点中{{user}}拒绝希罗的保密要求，不提供答应、沉默或暂不表态的分支，也不等待玩家选择。
10. 希罗带走赛哈姆：希罗对拒绝表示遗憾，但仍坚持带走赛哈姆。正文必须明确赛哈姆本人被希罗一方实际带离现场，罗纳克、奥露西娅随其行动；不能只写“准备转移”“担架待命”或“希罗自己离开”。

【阶段A结束与解锁】
- 只要步骤1—10已经真实演完，尤其是“赛哈姆本人实际被希罗一方带离现场”成立，就立即登记morning_flags.day6_saiham=true。
- morning_flags.day6_saiham=true即代表第6天清晨0节点锁定段结束。此刻仍是08:00，但从下一次{{user}}行动开始恢复正常计时。
- 到这里必须把行动权交回{{user}}。可以给出下一步唯一主线方向“回中央庭报告安托涅瓦”，但不得在同一条0节点回复里自动替{{user}}完成报告，更不得提前演出安托涅瓦的回忆。

【阶段B｜解除时间锁后的第一个必做行动｜1节点】
11. {{user}}下一次行动必须回中央庭向安托涅瓦报告赛哈姆活骸化、希罗介入、要求保密以及带走赛哈姆的全过程。这个“返回并报告”是一个正常行动，消耗1节点：08:00→09:20。
12. 安托涅瓦听完报告后，明确说明十几年前就出现过第一名活骸化神器使。第一个活骸无法控制自己并在城市中大肆破坏；中央庭当时派出三人小队阻止，另外两名队员死亡；安托涅瓦的双腿正是在那场事故中残废，从此失去行走能力；第一个活骸最后在巨大痛苦中自我毁灭。不要写成截肢或“失去双腿”这种肢体缺失，也不得补平民死亡数字、队员死法、特殊关系或额外制度细节。
13. 安托涅瓦完整讲完后登记intel_flags.first_chimera_incident_known=true。至此第6天后续自由行动恢复；以后每个普通行动继续按常规每次1节点（80分钟）计时。

【固定知情结算】
- 希罗完整解释活骸化后可登记intel_flags.chimera_exists_known=true。
- 是否登记hiro_chimera_research_known必须以正文是否实际披露“希罗正在研究/抢救活骸化”这一事实为准，不能只因他现身自动获得。
- 安托涅瓦完整讲完第一活骸事故后登记intel_flags.first_chimera_incident_known=true。
- 赛哈姆被带走后，本轮普通主视角、中央庭常规会议、战斗同伴、手机与常规角色心声都不得继续把赛哈姆当作在场人物；只有明确切到希罗侧场景才可描写其后续状态，且不会自动同步给{{user}}或中央庭。

【强制链抗偏航】
- 阶段A中{{user}}可以说话、追问、观察或尝试行动，模型可自然回应局部动作，但不得改变步骤1—10的关键事实和先后顺序。
- 阶段A结束前禁止普通自由行动选项；希罗实际带走赛哈姆后立即解除时间锁。
- 阶段B虽然已经开始计时，但“回中央庭报告安托涅瓦”仍是紧接着的必做主线动作；若{{user}}尝试先去别处，叙事应把行动导回报告，不得跳过该主线，同时这个返回与报告照常消耗1节点。
- 报告完成后才恢复真正的第6天普通巡查/地区行动。

【世界时间与历史一致性】
十几年前黑门灾害已在交界都市爆发，神器使也已出现；约半年前发生的是灾害范围被控制并压缩回最初爆发的交界都市。不得写“黑门半年前才出现/神器使半年前才出现”。

【时限】第6天结束前若未解放高校与东方古街/中央城区之一，按失败结算；不得补做。'''

first_chimera = '''【第一活骸事故精确披露】
- 这段历史在第6天赛哈姆被希罗实际带离、08:00时间锁解除之后，由{{user}}执行“回中央庭报告安托涅瓦”这一计时行动时固定披露。
- “返回中央庭并报告”消耗1节点：若从08:00开始，则报告完成后应为09:20；不得把这段报告继续算作0节点晨间锁定剧情。
- 时间必须明确为“十几年前”。这是早期灾害时代已经发生的事故，不得改成半年前或近期事件。
- 她必须明确这是第一个出现的活骸化神器使/第一名活骸：它无法控制自己，在城市中大肆破坏；中央庭派出三人小队阻止，最终另外两名队员死亡；安托涅瓦的双腿在那场事故中残废、从此失去行走能力；该活骸最后在巨大痛苦中自我毁灭。
- “双腿残废/失去行走能力”是功能损伤，不得擅自写成截肢、双腿消失或身体缺失。
- 第一活骸身份未解锁时只称“它/第一个活骸/第一名活骸”，不披露未经确认的身份与既往关系。
- 不得自行补平民伤亡数、街区毁坏比例、爆炸范围、队员死法、安托涅瓦是否队长、队员分工、特殊友情/亲属关系、当时为何只出动三人等未定义细节。
- 安托涅瓦可以把自己的亲历与她“极力主张必须立刻消灭活骸”的立场联系起来；原作第六天已明确中央庭会在活骸丧失神志、更加恶化前将其消灭，也明确希罗称安托涅瓦是这一主张的强硬推动者。不得继续扩写未定义的法律程序或治疗实验史。'''
for eid in (97, 98):
    byid[eid]['content'] = first_chimera

prompt = card['data']['extensions']['depth_prompt']['prompt']
old = '2. 晨间/强制剧情优先；第6天起床前小神低语和赛哈姆活骸化及希罗介入不得跳；第6天首入中央城区演出赛斯。随后再排首轮主线、角色剧情、地区与自由行动。'
new = '2. 晨间/强制剧情优先。第6天08:00的0节点锁定段固定为：小神醒前自语→安拍门叫醒并带你赶往事故现场→赛哈姆活骸化→安迎战不敌→希罗带罗纳克、奥露西娅介入→按原作说明活骸化（神器使体内存在幻力；过高和过低的幻力都会使神器使暴走成为活骸；活骸化一旦开始不能恢复；中央庭会在其丧失神志、更加恶化前消灭；希罗认为赛哈姆刚开始活骸化，继续研究或许能找到治疗方法）→希罗要求保密→指挥使固定拒绝→希罗遗憾并实际带走赛哈姆。赛哈姆实际离场后立刻结束08:00时间锁并交回行动权。下一次行动强制回中央庭报告安托涅瓦，此行动按常规消耗1节点（08:00→09:20），并听取十几年前第一活骸事故及安托涅瓦双腿残废的亲历。报告后才恢复普通第6天行动；第6天首入中央城区再演出赛斯。'
assert old in prompt
card['data']['extensions']['depth_prompt']['prompt'] = prompt.replace(old, new)

guard = next(s for s in card['data']['extensions']['tavern_helper']['scripts'] if '__F7D_MVU_GUARD__' in s.get('content', ''))
js = guard['content']
marker = "  const day6DecisionMade=user=>{"
assert marker in js
insert = r'''  const hasDay6LockedResolution=text=>{
    const t=String(text||'');
    return hasSaihamDeparture(t)
      ||/(?:希罗|罗纳克|奥露西娅|几人|三人|一行人)[\s\S]{0,360}(?:带着|抱起|抬着|推着|护送着|将)[\s\S]{0,240}赛哈姆[\s\S]{0,320}(?:离开(?:了)?现场|带离(?:了)?现场|离开(?:了)?事发地|撤离(?:了)?(?:现场|事发地|废墟|警戒区)|消失在[^。\n]{0,120}(?:警戒线|出口|通道|道路|雾气)之外|身影[^。\n]{0,120}(?:消失|远去))/.test(t)
      ||/赛哈姆[\s\S]{0,280}(?:被带离(?:了)?现场|被带走[^。\n]{0,120}(?:离开|现场)|随(?:着)?希罗[^。\n]{0,160}(?:离开(?:了)?现场|离去|撤离))/.test(t);
  };
'''
js = js.replace(marker, insert + marker, 1)

old = "    if(prior.day===6&&day6DecisionMade(user)&&hasMorningVoice(transcript)&&hasSaihamDeparture(transcript))addFlag('day6_saiham');"
new = "    if(prior.day===6&&hasMorningVoice(transcript)&&hasDay6LockedResolution(transcript))addFlag('day6_saiham');"
assert old in js
js = js.replace(old, new, 1)

old = "      if(path==='morning_flags.day6_saiham'&&next===true)invalid||=!day6DecisionMade(user)||!enteringDay6||get(prior,'morning_flags.day6_monologue')!==true&&!commands.some(c=>String(c.args?.[0]||'').includes('day6_monologue'))&&!hasMorningVoice(transcript)||!hasSaihamDeparture(transcript);"
new = "      if(path==='morning_flags.day6_saiham'&&next===true)invalid||=prior.day!==6||get(prior,'morning_flags.day6_monologue')!==true&&!commands.some(c=>String(c.args?.[0]||'').includes('day6_monologue'))&&!hasMorningVoice(transcript)||!hasDay6LockedResolution(transcript);"
assert old in js
guard['content'] = js.replace(old, new, 1)

rule = byid[91]['content']
old = '晨间完成标记仅在整段事件及其必要交谈实际结束、行动权交回玩家后登记；停在邀请、要求保密或等待回答时不算结束。'
new = '晨间完成标记仅在对应0节点锁定段真实结束、行动权交回玩家后登记。第6天例外地以“希罗一方已经实际带着赛哈姆离开现场”为08:00晨间锁结束点：此时立即登记day6_saiham=true并解除时间锁；回中央庭报告安托涅瓦属于下一次正常计时行动，消耗1节点。'
assert old in rule
byid[91]['content'] = rule.replace(old, new, 1)

blob = json.dumps(card, ensure_ascii=False)
assert '05｜世界历史时间锚' in blob
assert '十几年前' in byid[11]['content']
assert '罗纳克' in byid[11]['content'] and '奥露西娅' in byid[11]['content']
assert '幻力过高或过低' in byid[11]['content']
assert '玩家可答应、拒绝、质疑或沉默' not in byid[11]['content']
assert '08:00→09:20' in byid[11]['content']
assert '双腿在那场事故中残废' in byid[97]['content']
assert '黑门早在多年前' not in blob

dst.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'node2 canon-timing candidate ready: {dst} sha256={hashlib.sha256(dst.read_bytes()).hexdigest()}')
