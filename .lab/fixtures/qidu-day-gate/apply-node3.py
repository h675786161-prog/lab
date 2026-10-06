import json, pathlib, hashlib, subprocess, copy

root = pathlib.Path('.lab/fixtures/qidu-day-gate')
subprocess.run(['python3', str(root / 'apply-node2.py')], check=True)

src = root / 'Qidu-v0.4.48-node2-day6-canon-timing.json'
dst = root / 'Qidu-v0.4.49-node3-day6-second-region.json'
card = json.loads(src.read_text(encoding='utf-8'))

card['character_version'] = '0.4.49-node3-day6-second-region'
card['data']['character_version'] = '0.4.49-node3-day6-second-region'

entries = card['data']['character_book']['entries']
byid = {e.get('id'): e for e in entries}

node3_lore = '''【第6天后续｜第二地区六次巡查硬链】
前置：第6天赛哈姆事件已经结束、{{user}}已经回中央庭向安托涅瓦报告，intel_flags.first_chimera_incident_known=true。从此处开始恢复正常80分钟节点。

【目标地区只看已提交先后顺序】
- route_flags.first_second_region='east'：东方古街已是前一日优先解放地区，第6天后续固定转去中央城区；不要重复古街主线。
- route_flags.first_second_region='central'：中央城区已是前一日优先解放地区，第6天后续固定转去东方古街；不要重复城区主线。
- first_second_region记录“先解放的是哪一地区”，第二地区完成后也不得改写或互换。
- 从中央庭跨区前往第二地区本身是独立行动，先消耗1节点=80分钟；这一步只负责抵达、现场接触/接引，不计入后面的六次巡查。抵达后再由六次真实巡查逐步完成地区主线，每次巡查各消耗1节点=80分钟、最多推进一个阶段。短问答、查看终端、讨论下一步不算巡查，不扣时间，也不得推进地区阶段。
- 前五次巡查不得在正文宣称“整区已解放/核心危机已经彻底解决”，也不得提前把对应regions.*.liberated写成true；第六次才允许完成区域核心冲突并解放。
- 六次巡查只处理区域解放，黑核净化另算。第六次结束后可以提示黑核尚待处理，但不得顺手净化黑核。

【分支A｜东方古街先 → 第6天中央城区】
跨区抵达中央城区：必须真实遇见赛斯，由他以中央庭神官身份参与眼前的居民疏散/治安与怪物问题并完成接引；同轮登记morning_flags.day6_seth=true。这次抵达消耗1节点，但不算六次巡查。赛斯不能只作为任务名单里的名字，也不能一进城就跳到莱奥斯或黑核。
1. 第一次巡查继续处理城区居民、治安与怪物问题，赛斯保持实际参与或提供现场线索。
2. 第二次巡查推进莱奥斯相关异常/战斗；莱奥斯是有自主行动逻辑的机械伙伴，不写成无情机器人。
3. 第三次巡查让丽与莱奥斯关系进入主视野；丽对资源与安全的敏感来自经历，不写成只认钱的大小姐。
4. 第四次巡查继续居民/治安线。妮维最迟必须在这一阶段通过现场位置、巡警身份与自然会合过程正式登场；她使用双枪与三头犬，不得凭空加入队伍或改成双刀/长枪。赛斯从抵达接引后不能被剧情吞掉，至少再次参与/提供城区线索，并保留“不正经外表下认真处理小事”的核心。
5. 第五次敌方干扰逼近。达尔维拉/希罗侧痕迹必须通过现场证据逐步确认，不能因后台设定让{{user}}隔空实名识别。
6. 第六次正面解决中央城区核心冲突，必须真实击败/解除利维坦造成的当前核心威胁后才可登记regions.central.liberated=true。这一步不净化中央城区黑核。
结算：保持first_second_region='east'、oldstreet_delayed=false；不得回头制造“雯梓因延误受伤”。若前一日古街已经正常解放并有wenzi_joined=true，不得在城区线无故改回false。

【分支B｜中央城区先 → 第6天东方古街延误线】
前置硬状态：中央城区已经先解放，应保持first_second_region='central'和oldstreet_delayed=true。若旧状态漏写oldstreet_delayed，但“中央城区先解放”已成立，第6天进入本线时应补正为true。
跨区抵达东方古街：确认居民避难、当地自治与五行阵异常，并与雯梓建立现场联系。这次抵达消耗1节点，但不算六次巡查。
1. 第一次巡查继续确认居民防线与五行阵当前状态，不跳过古街自身的处理方式。
2. 第二次巡查继续确认阵势与黑门后果；钟函谷可以出现，但有自己的判断与交易逻辑，不主动一次性交底。
3. 第三次巡查必须兑现“延误”的现实后果：达尔维拉已经介入并扰乱/破坏五行阵，雯梓本人在这次冲突中明确负伤。正文、人物实名和状态必须同轮一致，登记route_flags.wenzi_injured=true。伤势必须影响她后续行动，不能下一幕无事巡街。
4. 第四次巡查：围绕居民、棋馆/万葬亭、五行阵与敌方痕迹继续调查；若达尔维拉此前还没有可靠身份来源，必须通过证据/在场称呼等逐步确认。
5. 第五次巡查：五行阵危机进入核心阶段，重点是守阵、人员状态和取舍，不把雯梓的伤势当装饰。
6. 第六次巡查：解决古街核心冲突并登记regions.east.liberated=true。古街仍与中央庭合作，但本阶段固定保持wenzi_injured=true, wenzi_joined=false，不得立即生成雯梓自由个人剧情或把她当正常可调度队员。
结算：保持first_second_region='central'与oldstreet_delayed=true；不得因为古街最终解放就把延误与伤势回滚。古街黑核的两次额外处理不包含在这六次巡查内。

【第6天计时验收】
- 若安托涅瓦报告结束时为09:20（560），先跨区移动1次到10:40（640）；随后六次地区巡查逐次到12:00、13:20、14:40、16:00、17:20、18:40（1120）。跨区移动不能算作第一轮巡查。
- 单次巡查不能一次跳160分钟或更多；一次回复写了多段战斗也仍只对应玩家这一次实际行动。
- 时间与区域状态以stat_data为准，正文不要报后台数字；战术终端可按玩家已知事实自然显示当前时刻、地区状态与任务信息。'''

if 104 not in byid:
    base = copy.deepcopy(byid[103])
    base.update({
        'id': 104,
        'name': '104｜第6天：第二地区六次巡查硬链',
        'comment': '[F7D_GATE:{"day":6}] 104｜第6天第二地区六次巡查',
        'keys': [],
        'secondary_keys': [],
        'content': node3_lore,
        'enabled': True,
        'constant': False,
        'insertion_order': 105,
        'priority': 100,
    })
    base['extensions']['display_index'] = 104
    entries.append(base)
else:
    byid[104]['content'] = node3_lore

byid = {e.get('id'): e for e in entries}

byid[31]['content'] += '''

【第6天作为第二地区时｜中央城区先后的延误线补强】
若当前day=6且first_second_region='central'，东方古街就是本日必须处理的第二地区：
- 必须六次真实巡查，一次只推进一个区域阶段；第1—5次禁止提前解放。
- 从中央庭跨区抵达古街先独立消耗1节点但不计入六次巡查；第3次巡查必须真实演出达尔维拉干扰五行阵、雯梓本人负伤，并同步wenzi_injured=true。
- 第6次才可解放东方古街；解放后仍固定wenzi_injured=true, wenzi_joined=false。
- 不得把黑核的“居民洽谈 + 五行阵定位净化”两次额外行动塞进这六次区域解放巡查。'''

byid[32]['content'] += '''

【第6天作为第二地区时｜东方古街先后的城区线补强】
若当前day=6且first_second_region='east'，中央城区就是本日必须处理的第二地区：
- 必须六次真实巡查，一次只推进一个区域阶段；第1—5次禁止提前解放。
- 从中央庭跨区抵达城区时必须真实演出赛斯现场接引/协助并登记day6_seth=true，这次移动独立消耗1节点但不计入六次巡查；第1次巡查从抵达后的城区现场开始。
- 第6次必须真实解决利维坦相关核心威胁后才可解放中央城区。
- 该分支不得反向写oldstreet_delayed=true或制造雯梓延误负伤；中央城区黑核也不能在第6次顺手净化。'''

prompt = card['data']['extensions']['depth_prompt']['prompt']
needle = '第6天首入中央城区再演出赛斯。'
replacement = '第6天首入中央城区再演出赛斯。第6天安托涅瓦报告结束后，按first_second_region去处理另一地区：先从中央庭跨区移动1次，独立消耗80分钟且不计入六次巡查；抵达后再严格六次巡查。east→中央城区，抵达时赛斯接引、第6次解决利维坦并解放；central→东方古街，抵达时与雯梓建立联系、第3次巡查达尔维拉扰阵造成雯梓负伤、第6次解放但雯梓不加入。每次巡查只耗80分钟且最多推进一阶段，前五次不得提前解放。'
assert needle in prompt
card['data']['extensions']['depth_prompt']['prompt'] = prompt.replace(needle, replacement, 1)

guard = next(s for s in card['data']['extensions']['tavern_helper']['scripts'] if '__F7D_MVU_GUARD__' in s.get('content', ''))
js = guard['content']

anchor = "  const endpoints=new Set(['终结','箱庭风景','牺牲的意义','永恒的终焉','两个人的旅途']);"
assert anchor in js
helper = r'''  const day6SecondZone=prior=>prior?.route_flags?.first_second_region==='east'?'central':prior?.route_flags?.first_second_region==='central'?'east':null;
  const zoneName=zone=>zone==='east'?'东方古街':zone==='central'?'中央城区':'';
  const patrolIntentText=t=>{const s=String(t||'');return !/(?:先|暂时|现在)?不(?:开始|继续|进行)?(?:这一轮|下一轮|本轮)?巡查|只(?:问|询问|聊|交谈|查看|确认)/.test(s)&&/(?:巡查|深入|继续推进|继续调查|调查现场|清理|救援|追踪|战斗|处理(?:现场|危机|异常))/.test(s)&&!/^(?:先)?(?:问|询问|听|查看|看看|聊|交谈)/.test(s);};
  const day6SecondRegionTravelIntent=(user,prior)=>{
    const zone=day6SecondZone(prior),name=zoneName(zone),t=String(user||'');
    return !!zone&&!String(prior?.location||'').startsWith(name)
      &&/(?:出发|前往|赶往|进入|移动到|去往)/.test(t)
      &&(!/(东方古街|中央城区)/.test(t)||t.includes(name));
  };
  const regionActionIntent=(user,prior)=>{
    const zone=day6SecondZone(prior),name=zoneName(zone);
    return !!zone&&String(prior?.location||'').startsWith(name)&&patrolIntentText(user);
  };
  const day6RegionActionCount=(zone,current,prior)=>{
    const chat=host.SillyTavern?.getContext?.()?.chat||[],name=zoneName(zone);
    let count=0;
    for(let i=0;i<chat.length;i++){
      const m=chat[i];if(!m?.is_user)continue;
      const a=chat[i+1];if(!a||a.is_user||a.is_system)continue;
      const saved=a.variables?.[a.swipe_id??0]?.stat_data;
      if(saved?.day!==6||!String(saved?.location||'').startsWith(name))continue;
      if(patrolIntentText(m.mes))count++;
    }
    if(prior?.day===6&&String(prior?.location||'').startsWith(name)&&patrolIntentText(latestPlayer()))count++;
    return count;
  };
  const delayedWenziInjury=text=>/达尔维拉/.test(text)&&/五行阵/.test(text)&&/雯梓[\s\S]{0,500}(?:受伤|负伤|伤势|被击中|受创|吐血|流血)/.test(text);
  const stateBeforeLatestPlayer=()=>{
    const chat=host.SillyTavern?.getContext?.()?.chat||[];
    let userIndex=-1;
    for(let i=chat.length-1;i>=0;i--){if(chat[i]?.is_user){userIndex=i;break;}}
    for(let i=userIndex-1;i>=0;i--){
      const m=chat[i];if(!m||m.is_user||m.is_system)continue;
      const s=m.variables?.[m.swipe_id??0]?.stat_data;
      if(s)return s;
    }
    return null;
  };
'''
js = js.replace(anchor, helper + anchor, 1)

loc_anchor = "    const rules=["
assert loc_anchor in js
js = js.replace(loc_anchor, """    const rules=[
      ['东方古街',/(?:你|你们)[^。\\n]{0,100}(?:来到|进入|走进|抵达|赶到|前往)[^。\\n]{0,70}东方古街/g],
      ['中央城区',/(?:你|你们)[^。\\n]{0,100}(?:来到|进入|走进|抵达|赶到|前往)[^。\\n]{0,70}中央城区/g],""", 1)

protect_anchor = "    const midnight=commands.some(c=>String(c.args?.[0]||'').replace(/^['\"]|['\"]$/g,'')==='clock_minutes'&&parse(c.args?.at(-1))===1440);"
assert protect_anchor in js
auto = r'''
    const secondZone=day6SecondZone(prior);
    if(prior.day===6&&prior.regions?.central?.liberated===true&&prior.route_flags?.first_second_region==='central'&&prior.route_flags?.oldstreet_delayed===false&&!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='route_flags.oldstreet_delayed'))
      commands.push({type:'set',args:['route_flags.oldstreet_delayed','false','true'],reason:'中央城区已先解放，东方古街进入延误分支'});
    if(prior.day===6&&prior.route_flags?.first_second_region==='central'&&prior.route_flags?.oldstreet_delayed===true&&prior.route_flags?.wenzi_injured===false&&delayedWenziInjury(story)&&!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='route_flags.wenzi_injured'))
      commands.push({type:'set',args:['route_flags.wenzi_injured','false','true'],reason:'正文已演出达尔维拉扰阵并造成雯梓负伤'});
    if(prior.day===6&&secondZone==='central'&&prior.morning_flags?.day6_seth===false&&/中央城区/.test(story)&&/赛斯/.test(story)&&!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='morning_flags.day6_seth'))
      commands.push({type:'set',args:['morning_flags.day6_seth','false','true'],reason:'第6天首次中央城区巡查已真实演出赛斯'});
    const secondRegionTravel=prior.day===6&&prior.intel_flags?.first_chimera_incident_known===true&&secondZone&&!prior.regions?.[secondZone]?.liberated&&day6SecondRegionTravelIntent(user,prior);
    const secondRegionAction=prior.day===6&&prior.intel_flags?.first_chimera_incident_known===true&&secondZone&&!prior.regions?.[secondZone]?.liberated&&regionActionIntent(user,prior);
    const beforePlayer=stateBeforeLatestPlayer();
    const alreadyChargedSecondRegion=!!(beforePlayer&&(secondRegionTravel||secondRegionAction)&&prior.clock_minutes===beforePlayer.clock_minutes+80);
    if(alreadyChargedSecondRegion){
      for(let i=commands.length-1;i>=0;i--){
        const path=String(commands[i]?.args?.[0]||'').replace(/^['"]|['"]$/g,'');
        if(path==='clock_minutes')commands.splice(i,1);
      }
      if(variables.display_data&&typeof variables.display_data==='object')variables.display_data.clock_minutes=prior.clock_minutes;
      if(variables.delta_data&&typeof variables.delta_data==='object'&&Object.prototype.hasOwnProperty.call(variables.delta_data,'clock_minutes'))delete variables.delta_data.clock_minutes;
      commands.push({type:'set',args:['clock_minutes',String(prior.clock_minutes),String(prior.clock_minutes)],reason:'本次玩家行动已在消息节点扣时，显式同步当前时刻，禁止回复再次扣时'});
    }else if((secondRegionTravel||secondRegionAction)&&prior.clock_minutes<1440&&!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='clock_minutes')){
      commands.push({type:'set',args:['clock_minutes',String(prior.clock_minutes),String(Math.min(1440,prior.clock_minutes+80))],reason:secondRegionTravel?'第6天跨区前往第二地区消耗1节点':'第6天第二地区一次实际巡查消耗1节点'});
    }
    const regionCountNow=secondZone?day6RegionActionCount(secondZone,story,prior):0;
    const secondZoneSolved=secondZone==='central'
      ? /利维坦/.test(story)&&/(?:中央城区|城区)[^。\n]{0,80}(?:解放|危机解除)|(?:解放|危机解除)[^。\n]{0,80}(?:中央城区|城区)/.test(story)
      : secondZone==='east'
        ? /(东方古街|古街)[^。\n]{0,80}(?:解放|危机解除)|(?:解放|危机解除)[^。\n]{0,80}(?:东方古街|古街)/.test(story)
        : false;
    const injuryReady=prior.route_flags?.wenzi_injured===true||commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='route_flags.wenzi_injured'&&parse(c.args?.at(-1))===true);
    if(secondRegionAction&&regionCountNow>=6&&secondZoneSolved&&(secondZone!=='east'||injuryReady)&&!commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='regions.'+secondZone+'.liberated'))
      commands.push({type:'set',args:['regions.'+secondZone+'.liberated','false','true'],reason:'第6天第二地区第六次实际巡查已收束核心危机'});
'''
js = js.replace(protect_anchor, protect_anchor + auto, 1)

short_line = "      const shortExchange=/(?:听.{0,12}(?:说明|讲|解释)|询问|问清|了解|交谈|聊|请.{0,10}(?:介绍|讲清|说明))/.test(user)&&!/(?:前往|赶往|出发|巡查|战斗|救援|清理|深入|调查现场|进入(?:[一-龥]{2,8}区)|动手处理)/.test(user);"
short_new = "      const explicitNoAction=/(?:先|暂时|现在)?不(?:开始|继续|进行)?(?:这一轮|下一轮|本轮)?巡查|只(?:问|询问|聊|交谈|查看|确认)/.test(user);\n      const shortExchange=explicitNoAction||/(?:听.{0,12}(?:说明|讲|解释)|询问|问清|了解|交谈|聊|请.{0,10}(?:介绍|讲清|说明))/.test(user)&&!/(?:前往|赶往|出发|巡查|战斗|救援|清理|深入|调查现场|进入(?:[一-龥]{2,8}区)|动手处理)/.test(user);"
assert short_line in js
js = js.replace(short_line, short_new, 1)

clock_anchor = "      if(path==='clock_minutes'&&next>old)invalid||=!morningReady(prior);"
assert clock_anchor in js
js = js.replace(clock_anchor, clock_anchor + "\n      if(path==='clock_minutes'&&next>old&&(secondRegionTravel||secondRegionAction)&&!alreadyChargedSecondRegion)invalid||=next-old!==80;", 1)

lib_old = """      if((path==='regions.east.liberated'||path==='regions.central.liberated')&&next===true){
        const zone=path.split('.')[1],name=zone==='east'?'东方古街':'中央城区';
        invalid||=old!==false||!String(prior.location||'').startsWith(name)||shortExchange||!/(?:区域|街区|古街|城区).{0,25}(?:解放|危机解除)|(?:解放|危机解除).{0,25}(?:区域|街区|古街|城区)/.test(story);
      }"""
lib_new = """      if((path==='regions.east.liberated'||path==='regions.central.liberated')&&next===true){
        const zone=path.split('.')[1],name=zone==='east'?'东方古街':'中央城区';
        invalid||=old!==false||!String(prior.location||'').startsWith(name)||shortExchange||!/(?:区域|街区|古街|城区).{0,25}(?:解放|危机解除)|(?:解放|危机解除).{0,25}(?:区域|街区|古街|城区)/.test(story);
        if(prior.day===6&&day6SecondZone(prior)===zone)invalid||=day6RegionActionCount(zone,story,prior)<6;
        if(prior.day===6&&zone==='central'&&prior.route_flags?.first_second_region==='east')invalid||=!/利维坦/.test(story);
        if(prior.day===6&&zone==='east'&&prior.route_flags?.first_second_region==='central')invalid||=!(prior.route_flags?.wenzi_injured===true||commands.some(c=>String(c.args?.[0]||'').replace(/^['"]|['"]$/g,'')==='route_flags.wenzi_injured'&&parse(c.args?.at(-1))===true));
      }"""
assert lib_old in js
js = js.replace(lib_old, lib_new, 1)

route_loop_anchor = "      if(path==='route_flags.oldstreet_delayed'&&next===true&&!completed('central'))commands.splice(i,1);"
assert route_loop_anchor in js
route_extra = r"""
      if(path==='route_flags.oldstreet_delayed'&&prior.route_flags?.oldstreet_delayed===true&&next===false)commands.splice(i,1);
      if(path==='route_flags.wenzi_injured'&&prior.route_flags?.wenzi_injured===true&&next===false)commands.splice(i,1);
      if(path==='route_flags.wenzi_joined'&&next===true&&(prior.route_flags?.first_second_region==='central'||prior.route_flags?.oldstreet_delayed===true||prior.route_flags?.wenzi_injured===true))commands.splice(i,1);
"""
js = js.replace(route_loop_anchor, route_loop_anchor + route_extra, 1)

guard['content'] = js

blob = json.dumps(card, ensure_ascii=False)
assert '104｜第6天：第二地区六次巡查硬链' in blob
assert '第六次正面解决中央城区核心冲突' in byid[104]['content']
assert '第三次巡查必须兑现“延误”的现实后果' in byid[104]['content']
assert 'day6RegionActionCount' in guard['content']
assert 'next-old!==80' in guard['content']
assert 'day6SecondRegionTravelIntent' in guard['content']
assert 'alreadyChargedSecondRegion' in guard['content']
assert '显式同步当前时刻' in guard['content']
assert 'variables.display_data.clock_minutes' in guard['content']
assert 'explicitNoAction' in guard['content']
assert '跨区移动1次到10:40' in byid[104]['content']
assert 'wenzi_injured' in guard['content']

dst.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'node3 candidate ready: {dst} sha256={hashlib.sha256(dst.read_bytes()).hexdigest()}')
