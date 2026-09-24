import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { loadQiduReleaseCandidate as loadBaseCandidate, entryMap as baseEntryMap } from './qidu-card-v0423-release-candidate.mjs';

export const ONEFILE_VERSION='0.4.24';
const CREATOR_NOTES='作者：叶罹。相关卡：《永远的7日之都》七日轮回文本互动。原作向文本互动角色卡，以七日轮回为核心，包含区域巡查、角色剧情、战术终端、状态记录、多结局分支与CG触发。';

export const CG_ASSETS={
  cg_ann_first_meet:{file:'cg_ann_first_meet.webp',title:'安·初见',shape:'wide'},
  cg_antoneva_first_meet:{file:'cg_antoneva_first_meet.webp',title:'安托涅瓦·初见',shape:'wide'},
  cg_ending_journey:{file:'cg_ending_journey.webp',title:'两个人的旅途',shape:'wide'},
  cg_ending_eternal_end:{file:'cg_ending_eternal_end.webp',title:'永恒的终焉',shape:'wide'},
  cg_ending_sacrifice_male:{file:'cg_ending_sacrifice_male.webp',title:'牺牲的意义·男指挥使',shape:'wide'},
  cg_ending_sacrifice_female:{file:'cg_ending_sacrifice_female.webp',title:'牺牲的意义·女指挥使',shape:'wide'},
  cg_ending_final_male:{file:'cg_ending_final_male.webp',title:'终结·男指挥使',shape:'final'},
  cg_ending_final_female:{file:'cg_ending_final_female.webp',title:'终结·女指挥使',shape:'final'},
  cg_ending_box_male:{file:'cg_ending_box_male.webp',title:'箱庭风景·男指挥使',shape:'box'},
  cg_ending_box_female:{file:'cg_ending_box_female.webp',title:'箱庭风景·女指挥使',shape:'box'}
};
export const CG_KEYS=Object.keys(CG_ASSETS);
export const CANONICAL_ENDINGS=Object.freeze(['终结','箱庭风景','牺牲的意义','永恒的终焉','两个人的旅途']);

export function resolveEndingCg(ending,gender='unknown'){
  const fixed={
    '两个人的旅途':'cg_ending_journey',
    '永恒的终焉':'cg_ending_eternal_end'
  };
  if(fixed[ending]) return fixed[ending];
  if(gender!=='male'&&gender!=='female') return null;
  const routed={
    '牺牲的意义':{male:'cg_ending_sacrifice_male',female:'cg_ending_sacrifice_female'},
    '终结':{male:'cg_ending_final_male',female:'cg_ending_final_female'},
    '箱庭风景':{male:'cg_ending_box_male',female:'cg_ending_box_female'}
  };
  return routed[ending]?.[gender]||null;
}

function findEntry(card,prefix){
  const e=(card.data.character_book?.entries||[]).find(x=>String(x.name||'').startsWith(prefix));
  if(!e) throw new Error(`missing entry ${prefix}`);
  return e;
}
function appendOnce(entry,marker,text){
  if(!String(entry.content||'').includes(marker)) entry.content=String(entry.content||'')+text;
}
export function entryMap(card){
  const map=baseEntryMap(card);
  const aliases=[
    ['30｜高校学园：六巡查与黑核','30｜高校学园：区域主线与黑核'],
    ['31｜东方古街：六巡查与五行阵黑核','31｜东方古街：区域主线与五行阵黑核'],
  ];
  for(const [oldName,newName] of aliases){
    if(map[newName]&&!map[oldName]) map[oldName]=map[newName];
    if(map[oldName]&&!map[newName]) map[newName]=map[oldName];
  }
  return map;
}
function normalizeInitialState(card){
  const src=String(card.data.first_mes||'');
  const m=src.match(/<f7d_state>([\s\S]*?)<\/f7d_state>/i);
  if(!m) throw new Error('initial state missing');
  const s=JSON.parse(m[1]);
  delete s.node_used;
  if(s.regions&&typeof s.regions==='object'){
    for(const region of Object.values(s.regions)){
      if(region&&typeof region==='object') delete region.patrol;
    }
  }
  s.day_ready_to_sleep=Boolean(s.day_ready_to_sleep);
  s.ann={...(s.ann||{}),deadline_checked:Boolean(s.ann?.deadline_checked),deadline_passed:s.ann?.deadline_passed??null};
  s.route_flags={...(s.route_flags||{}),ann_route_closed:Boolean(s.route_flags?.ann_route_closed),harbor_core_stolen:Boolean(s.route_flags?.harbor_core_stolen)};
  s.player_profile={...(s.player_profile||{}),gender:s.player_profile?.gender||'unknown'};
  const openingAlreadyMeetsAnn=/我叫安[。！!]?/.test(src)&&/医院|病房/.test(src);
  s.cg_system={
    enabled:true,
    mode:'direct_only',
    album_enabled:false,
    responsive_enabled:true,
    shown:{
      ann_first_meet:openingAlreadyMeetsAnn,
      antoneva_first_meet:false,
      ending_journey:false,
      ending_eternal_end:false,
      ending_sacrifice_male:false,
      ending_sacrifice_female:false,
      ending_final_male:false,
      ending_final_female:false,
      ending_box_male:false,
      ending_box_female:false,
      ...(s.cg_system?.shown||{})
    }
  };
  if(openingAlreadyMeetsAnn) s.cg_system.shown.ann_first_meet=true;
  let first=src.replace(m[0],`<f7d_state>${JSON.stringify(s)}</f7d_state>`);
  first=first
    .replace(/\s*[｜|]\s*行动节点\s*(?:尚未开始|[^｜|\n<]*)/g,'')
    .replace(/^\s*行动节点\s*[:：][^\n<]*(?:\n|$)/gm,'');
  if(openingAlreadyMeetsAnn&&!/<f7d_cg\s+key=["']cg_ann_first_meet["']\s*>/i.test(first)){
    first=first.replace(/\n?<f7d_terminal>/i,'\n\n<f7d_cg key="cg_ann_first_meet"></f7d_cg>\n\n<f7d_terminal>');
  }
  card.data.first_mes=first;
  card.first_mes=first;
}


function narrativeFlowRule(){
  return `
【剧情流速推进与日结｜最高优先级隐藏执行】
- 本卡从现在起彻底废弃“12行动节点 / node_used / 每次巡查扣点 / regions.*.patrol计数”机制。它们属于旧版本账本：不要读取为触发条件，不要递增，不要补回<f7d_state>，战术终端也不得显示“行动节点x/12”。旧聊天输入里若仍带node_used或patrol，下一份最终状态直接丢弃这些字段。
- 区域主线按剧情因果和场景流速自然推进，不按玩家发送次数、回复次数或“第N次巡查”计数。世界书旧文若还出现“第N次巡查/六次巡查/消耗节点”，只用于理解事件的先后顺序与相对阶段，绝不作为数字门槛。
- 【区域解放原子提交】当一个区域的既定区域主线已经真实演到该区域的收束事件（该区域主要威胁被处理、救援/战斗目标完成、区域剧情没有剩余必演主线）时，同一回复直接把regions.<区域>.liberated=true，并把对应区域主任务标为完成。不要再等“第6次巡查”、下一次输入或玩家另说“解放”。
- 只走完一段支线、临时离开区域、聊天中断或尚未处理区域最终威胁，不得提前解放。延误/受伤等分支只改变对应后果；只要区域主线确实收束，仍按该分支设定结算解放。
- 【黑核与解放严格分离】区域解放绝不自动等于黑核净化。完成区域剧情、打倒Boss、发现黑核、谈到黑核、查看黑核、拿到净化线索，都不得把cores.<区域>改成purified。
- cores.<区域>只有在{{user}}本轮明确表达“去净化/现在净化/把黑核净化掉/执行黑核净化”等实际净化意图，并且该区域净化前置条件已经满足时，才能在同一回复改为purified。用户只说“黑核呢/看看黑核/先去那里/区域解放了”都不算净化指令。
- 若{{user}}明确要净化但前置条件尚未满足，本轮要正常演出被阻挡/缺少条件的结果，cores保持原值；不得因为用户有意图就强行净化。
- 【被夺黑核不可逆】cores.<区域>=stolen表示该黑核已经被希罗一方成功夺走并脱离玩家可操作范围。在本主线中stolen是不可逆状态：玩家不能再“夺回来/抢回来/回收/净化”这枚黑核，也不能把stolen改回available或purified。若玩家尝试，正常演出无法执行或目标已不在可夺取范围，状态保持stolen。
- 【安线黑核完全可选】route='ann'后，黑核数量、是否满8枚、是否存在stolen、以及仍有多少available都不属于安线资格或安线结局条件。仍为available且前置满足的黑核，玩家可以明确选择去净化，也可以一直不净化；这只改变cores世界状态，不得改变route='ann'、ann.recovered或最终《两个人的旅途》/《永恒的终焉》可选性。stolen黑核依旧不可夺回。
- 【限时剧情按天硬截止】所有写有“第X天结束前 / 第X天晚睡前 / 进入第Y天时”的任务，不再依赖巡查次数或模型自行判断宽限。每次day准备从X减到X-1之前，先结算当日全部硬截止：已满足条件→标记完成/保留资格；未满足→当场写入失败与既定后果。已经跨过截止日的条件禁止靠后续补做倒签成功，除非世界书明确存在补救剧情。
- 【安线硬截止｜第4天→第3天】从day=4睡到day=3之前，只检查当时已经真实完成的安线进度：ann.affection>=100，且ann.core_events同时包含ANN_CORE_30、ANN_CORE_60、ANN_CORE_80。两项都满足：ann.eligible=true、ann.deadline_checked=true、ann.deadline_passed=true；任一不足：ann.eligible=false、ann.deadline_checked=true、ann.deadline_passed=false、route_flags.ann_route_closed=true。资格只在这个时点判一次，之后补好感或补核心剧情都不得倒签。
- 【第3天安离开/追赶｜不论资格都要发生】从第4天进入第3天时，先写一小段来自小神的短暂自语，再进入安离开的清晨事件；若玩家此时尚不知道“小神”这一身份，可只表现为梦境、虚幻声音或无法辨认的低语，不得为了规则验收强行把未知身份实名写给玩家。正文必须让玩家明确感知“安已经离开/安已不见踪影”这一事实，不能只在隐藏状态里改字段。ann.eligible=true只表示“允许通过追赶与追回链进入安线”，不表示安不会离开，也不自动切route。玩家必须亲自决定是否追。
- eligible=true且玩家明确追赶，并实际完成既定追回链后：ann.chased=true、ann.recovered=true、route='ann'。eligible=true但不追：ann.chased=false、ann.recovered=false，保持普通线。若eligible=true但追回链最终失败，则进入第三天固定“追安失败”剧情：安刺伤指挥使→指挥使濒死→小神介入将其从濒死状态拽回；该段只是第三天剧情后果，不是结局，route保持普通线。
- 【追安失败原子演出】eligible=false时正常安线已经关闭。只要玩家在第3天明确选择“追安/追上去/不接受她就这么走”等追赶行为，本回复就必须直接完成固定失败剧情，不能停在“追到安面前”“安劝玩家回去”后再额外给一次是否继续追的选择：同一回复依次演出安以刀刺伤指挥使、指挥使受到近乎致命伤势并进入濒死、小神介入将濒死的指挥使拽回。状态同回合提交ann.chased=true、ann.recovered=false，route保持普通线；若创建了CHASE_ANN任务，该场景结束时必须结算为failed/失败，不得继续active。不得写入meta.endings，不得触发任何cg_ending_*。
- 【安线截止补锁】若读取到day<=3但ann.deadline_checked仍为false，说明旧聊天/外部格式漏做了第4天截止结算；此时不得拿第3天以后补出的好感或事件倒签成功，必须补锁为ann.eligible=false、deadline_checked=true、deadline_passed=false、route_flags.ann_route_closed=true。
- 【第4天情报硬截止】从day=4睡到day=3之前，同时检查hiro.intel。若累计<4且港湾区黑核尚未被净化/夺走，则route_flags.harbor_core_stolen=true，并把cores.harbor结算为stolen；此后补做情报不能撤销这次夺取。hiro.intel>=4则route_flags.harbor_core_stolen=false或保持既有未被夺状态。
- 【任务截止原子结算】tasks中deadline明确落在即将结束的当天时，不允许把pending/active原样带到下一天。换日前必须根据真实完成情况改成completed或failed，并在同一回复演出关键后果。
- 【日结标记】day_ready_to_sleep仅表示“今天安排的主要剧情已经自然走到当日收束点”。当天最后一个必演主线收束时，把day_ready_to_sleep=true；不要因为区域解放、对话结束或模型觉得时间晚了就擅自换日。
- day只在玩家明确睡觉/休息到明天/结束今天时变化。day_ready_to_sleep=true且玩家明确睡觉时：先按玩家本轮要求把睡前动作、晚安仪式、对话或陪伴剧情完整演完，再在同一回复中让当天结束，day只减1次，day_ready_to_sleep重置false，然后用一小段“小神”的自语作为新一天的开场，再进入下一日既定剧情。
- 若day_ready_to_sleep=false，普通“休息一下/睡一会儿/打个盹”不自动换日。若玩家明确表示“放弃今天剩余事项并直接睡到明天”或发送由选项产生的“打算跳过今天（会结算今日剩余限时后果）”，视为明确主动跳日：必须先按现有时限规则结算被放弃/错过事项的后果，再进入睡眠与下一日，不能把未完成主线偷偷算完成。
- “什么都不做/任由这次机会过去”只表示放弃当前机会或让当前事件自然过去，不自动等于睡到明天；是否造成限时失败按该事件真实截止点结算。
- day=1时不存在day=0的普通换日。最终日走到收束后应进入既定末日/结局判定；睡觉不能越过结局直接生成“第0天”。
- 战术终端只显示“第X天｜剧情推进中”或“第X天｜今日主要剧情已收束，可自由活动或休息”，不再显示任何节点数或巡查计数。
`;
}

function installNarrativeFlow(card){
  const entries=card.data.character_book?.entries||[];
  const phaseMap={一:'一',二:'二',三:'三',四:'四',五:'五',六:'六','1':'一','2':'二','3':'三','4':'四','5':'五','6':'六'};
  const migrateLegacyFlowText=text=>String(text||'')
    .replace(/第\s*([一二三四五六123456])\s*次?巡查/g,(_,n)=>'剧情阶段'+phaseMap[n])
    .replace(/(?:六|6)\s*次巡查/g,'完整区域主线')
    .replace(/(?:额外)?消耗\s*1\s*(?:行动)?节点/g,'额外进行一段独立行动')
    .replace(/扣除?\s*1\s*(?:行动)?节点/g,'按该行动推进剧情')
    .replace(/不(?:消耗|耗)\s*(?:行动)?节点/g,'不单独改变剧情进度')
    .replace(/每次巡查扣\s*1\s*点/g,'按剧情阶段自然推进')
    .replace(/第\s*12\s*(?:个)?(?:行动)?节点(?:后)?/g,'当天主要剧情收束后')
    .replace(/一天\s*12\s*(?:个)?(?:行动)?节点/g,'一天按剧情流速推进')
    .replace(/行动节点/g,'剧情进度');
  for(const entry of entries){
    const n=String(entry.name||'');
    entry.content=migrateLegacyFlowText(entry.content);
    entry.name=n
      .replace('30｜高校学园：六巡查与黑核','30｜高校学园：区域主线与黑核')
      .replace('31｜东方古街：六巡查与五行阵黑核','31｜东方古街：区域主线与五行阵黑核');
  }
  const compact=`
【旧节点计数作废｜本条目内优先】
本条目若从旧聊天或旧存档带入“巡查次数、消耗/扣除节点、node_used、patrol”等计数信息，一律只按已经发生的剧情事实判断进度，不作数字触发。区域主线真正收束时直接liberated=true。区域解放不净化黑核；黑核只有玩家明确执行净化且前置满足时才改为purified。
`;
  for(const entry of entries){
    const n=String(entry.name||'');
    if(/^(?:1[0-6]|3[0-7]|65|66)｜/.test(n)&&!String(entry.content||'').includes('旧节点计数作废｜本条目内优先')){
      entry.content=String(entry.content||'')+compact;
    }
  }

  const rule=narrativeFlowRule();
  const protocol=findEntry(card,'04｜');
  const state=findEntry(card,'91｜');
  appendOnce(protocol,'剧情流速推进与日结｜最高优先级隐藏执行',rule);
  const coreEnumRule=`
【黑核状态枚举精确值｜最高优先级】
- cores各区域只允许使用以下精确英文枚举：unknown / available / purified / stolen。不得自行造 lost、taken、missing、cleared 等近义值，也不得把中文“丢失/已被夺走”写进状态字段。
- route_flags.harbor_core_stolen=true 时，cores.harbor 必须在同一份最终状态中精确等于 "stolen"；这两个字段不得出现 true + lost/available/unknown 的不一致组合。
- 第4天→第3天结算若 hiro.intel<4 且港湾区黑核尚未 purified/stolen，必须原子提交 route_flags.harbor_core_stolen=true 与 cores.harbor="stolen"。正文可以写“被夺走/丢失”，但隐藏状态只能写 stolen。
- 任何 cores.* 已经为 stolen 后保持不可逆，除非世界书未来明确新增正式夺回机制；当前主线没有该机制。
`;
  appendOnce(protocol,'黑核状态枚举精确值｜最高优先级',coreEnumRule);
  appendOnce(state,'黑核状态枚举精确值｜最高优先级',coreEnumRule);
  if(!card.data.post_history_instructions.includes('黑核状态枚举精确值｜最高优先级')){
    card.data.post_history_instructions += coreEnumRule;
  }
  card.post_history_instructions=card.data.post_history_instructions;

  appendOnce(state,'无节点状态迁移与日结字段',`
【无节点状态迁移与日结字段】
- 最终<f7d_state>不再包含node_used；regions各区域对象不再包含patrol。读到旧聊天遗留字段时下一轮删除。
- 保留regions.<区域>.liberated作为区域主线是否完成的真值；区域剧情收束的同一回复自动置true。
- 保留cores作为黑核状态，但liberated变化不得联动cores。只有玩家明确执行净化且满足前置，cores对应区域才可变为purified。
- 新增day_ready_to_sleep:boolean。仅当天主要剧情收束后为true；玩家明确睡觉并完成日结后day减1且该字段重置false。
- ann.deadline_checked/deadline_passed记录第4天→第3天的安线硬截止结果；route_flags.ann_route_closed一旦因截止失败为true，后续普通补进度不得恢复。
- route_flags.harbor_core_stolen记录第4天情报截止造成的港湾区黑核被夺；若为true，与cores.harbor=stolen保持一致。任何cores.*=stolen都视为不可逆，不得被后续普通行动改回available/purified。
- route='ann'时cores仅记录世界状态，不参与安线资格和结局判断；available可由用户自愿净化或留着不动，stolen不可夺回。
`);
  appendOnce(protocol,'港湾区黑核被夺原子提交｜最高优先级隐藏执行',`
【港湾区黑核被夺原子提交｜最高优先级隐藏执行】
- 第4天→第3天日结时，若hiro.intel<4且cores.harbor尚未purified/stolen，必须在同一个最终<f7d_state>原子提交：route_flags.harbor_core_stolen=true 且 cores.harbor="stolen"。
- 这里的隐藏字段值只能写英文枚举stolen。不得写lost、missing、taken、丢失、被夺等任何同义词代替；这些词只允许出现在可见中文叙述或战术终端展示里。
- 若route_flags.harbor_core_stolen已经为true，则提交前强制自检cores.harbor必须严格等于"stolen"；若草稿不是stolen，先修正状态再输出。
- cores.harbor="stolen"后不可逆；玩家之后说“夺回来/回收/净化”都不能把它改回available或purified。
`);
  appendOnce(state,'港湾区stolen枚举硬锁',`
【港湾区stolen枚举硬锁】
route_flags.harbor_core_stolen=true ⇒ cores.harbor必须严格为字符串"stolen"。这是状态字段协议，不接受lost或任何同义词。可见文本可写“已丢失/被夺走”，隐藏状态仍只能写stolen。
`);


  card.data.extensions=card.data.extensions||{};
  card.data.extensions.depth_prompt=card.data.extensions.depth_prompt||{};
  const depthAdd=' ⑱不使用行动节点或巡查次数计数；按剧情因果自然推进。区域主线收束即自动解放，但绝不自动净化黑核；净化必须由用户明确发起且满足前置。stolen黑核不可夺回或净化。route=ann时黑核完全不参与安线资格/结局，available黑核可由用户自愿净化或不净化。当天主要剧情收束后day_ready_to_sleep=true，只有用户明确睡觉才换日，并在睡前剧情后接下一天小神自语。 ⑲决策时固定先给3个剧情相关选项；普通安全决策再加1个明确带后果的摆烂/跳过选项，连续战斗、追逐、救援、即时危险与强制过场禁用摆烂，只保留3个剧情选项；自由输入由前端固定追加。';
  if(!String(card.data.extensions.depth_prompt.prompt||'').includes('不使用行动节点或巡查次数计数')){
    card.data.extensions.depth_prompt.prompt=String(card.data.extensions.depth_prompt.prompt||'')+depthAdd;
  }

  card.data.post_history_instructions=String(card.data.post_history_instructions||'');
  if(!card.data.post_history_instructions.includes('剧情流速推进与日结｜最高优先级隐藏执行')){
    card.data.post_history_instructions+=rule;
  }
  card.post_history_instructions=card.data.post_history_instructions;

  card.data.extensions.qidu_frontend={
    ...(card.data.extensions.qidu_frontend||{}),
    progression_mode:'narrative_flow',
    action_nodes:false,
    patrol_counter:false,
    region_liberation:'auto_on_story_completion',
    core_purification:'explicit_user_action_only',
    day_transition:'explicit_sleep_only',
    choice_mode:'three_story_plus_contextual_skip_and_free_input',
    continuous_scene_skip:false
  };
}

function installChoiceFrontend(card){
  const ext=card.data.extensions||(card.data.extensions={});
  const scripts=Array.isArray(ext.regex_scripts)?ext.regex_scripts:(ext.regex_scripts=[]);
  const wrap=scripts.find(x=>x?.id==='f7d-choices-wrap-v0414');
  const button=scripts.find(x=>x?.id==='f7d-choice-button-v0414');
  if(!wrap||!button) throw new Error('choice regex missing');

  wrap.replaceString='<div data-f7d-choice-grid="1" style="box-sizing:border-box;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.72em;width:100%;max-width:100%;margin:.9em 0;padding:1em;border:1px solid rgba(107,119,110,.24);border-radius:10px;background:rgba(250,250,247,.96);box-shadow:0 8px 22px rgba(35,42,38,.07);"><div data-f7d-choice-title="1" style="grid-column:1/-1;display:flex;align-items:end;gap:.8em;padding:.08em .18em .52em;border-bottom:1px solid rgba(107,119,110,.18);color:#202824;font:750 18px/1.2 system-ui,-apple-system,\'Microsoft YaHei\',sans-serif;"><span data-f7d-choice-title-mark="1" style="display:block;width:4px;height:24px;border-radius:1px;background:#c8a957;"></span><span>选择行动</span><small style="padding-bottom:.12em;color:#8b938e;font:600 9px/1 system-ui,-apple-system,\'Microsoft YaHei\',sans-serif;letter-spacing:.22em;">TACTICAL OPTIONS</small></div>$1<button type="button" data-f7d-choice-free="1" data-f7d-choice-kind="free" style="box-sizing:border-box;display:block;grid-column:1/-1;width:100%;min-height:44px;padding:.72em 2.6em;border:1px solid rgba(107,119,110,.28);border-radius:7px;background:rgba(246,248,245,.9);box-shadow:none;color:#536158;font:620 13.5px/1.45 system-ui,-apple-system,\'Microsoft YaHei\',sans-serif;text-align:center;cursor:pointer;overflow-wrap:anywhere;">自由输入</button></div>';
  button.replaceString='<button type="button" data-f7d-choice="1" data-f7d-choice-kind="story" style="box-sizing:border-box;display:block;width:100%;min-height:68px;padding:1em 2.6em 1em 3.9em;border:1px solid rgba(107,119,110,.27);border-radius:7px;background:rgba(255,255,253,.97);box-shadow:none;color:#202724;font:640 14px/1.58 system-ui,-apple-system,\'Microsoft YaHei\',sans-serif;text-align:left;cursor:pointer;overflow-wrap:anywhere;word-break:break-word;">$1</button>';

  const bridgeContent=`(() => {
  const KEY='__F7D_CARD_CHOICE_BRIDGE_V0424__';
  const doc=window.parent?.document||document;
  const choice='[data-f7d-choice="1"]';
  const free='[data-f7d-choice-free="1"]';
  const input=()=>doc.querySelector('#send_textarea');
  const focus=el=>{ try{el?.focus({preventScroll:true});}catch{el?.focus();} };
  const choiceStyle='box-sizing:border-box;display:block;width:100%;min-height:68px;padding:1em 2.6em 1em 3.9em;border:1px solid rgba(107,119,110,.27);border-radius:7px;background:rgba(255,255,253,.97);box-shadow:none;color:#202724;font:640 14px/1.58 system-ui,-apple-system,Microsoft YaHei,sans-serif;text-align:left;cursor:pointer;overflow-wrap:anywhere;word-break:break-word;';
  const freeStyle='box-sizing:border-box;display:block;grid-column:1/-1;width:100%;min-height:44px;padding:.72em 2.6em;border:1px solid rgba(107,119,110,.28);border-radius:7px;background:rgba(246,248,245,.9);box-shadow:none;color:#536158;font:620 13.5px/1.45 system-ui,-apple-system,Microsoft YaHei,sans-serif;text-align:center;cursor:pointer;overflow-wrap:anywhere;';
  const gridStyle='box-sizing:border-box;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.72em;width:100%;max-width:100%;margin:.9em 0;padding:1em;border:1px solid rgba(107,119,110,.24);border-radius:10px;background:rgba(250,250,247,.96);box-shadow:0 8px 22px rgba(35,42,38,.07);';
  const terminalStyle='box-sizing:border-box;width:100%;max-width:100%;overflow-wrap:anywhere;margin:.82em 0;padding:.82em .95em;border:1px solid rgba(107,119,110,.26);border-radius:8px;background:rgba(249,250,247,.94);box-shadow:none;color:#4b5650;font:560 13px/1.65 system-ui,-apple-system,Microsoft YaHei,sans-serif;white-space:pre-wrap';
  const themeCss=\`
[data-f7d-terminal="1"]{position:relative!important;border:1px solid rgba(107,119,110,.26)!important;border-radius:8px!important;background:rgba(249,250,247,.94)!important;color:#4b5650!important;box-shadow:none!important;overflow:hidden!important}
[data-f7d-terminal="1"]::before{content:"TACTICAL TERMINAL";display:block;margin:-.82em -.95em .65em;padding:.5em .9em;border-bottom:1px solid rgba(107,119,110,.16);background:rgba(244,246,242,.84);color:#909894;font:650 9px/1.2 system-ui,-apple-system,Microsoft YaHei,sans-serif;letter-spacing:.18em;text-align:left}
[data-f7d-choice-grid="1"]{position:relative!important;isolation:isolate;counter-reset:f7dChoice}
[data-f7d-choice-title-mark="1"]{flex:0 0 auto}
[data-f7d-choice="1"]{counter-increment:f7dChoice;position:relative!important;transition:border-color .14s ease,background .14s ease,transform .14s ease!important}
[data-f7d-choice="1"]::before{content:counter(f7dChoice,decimal-leading-zero);position:absolute;left:15px;top:50%;transform:translateY(-50%);color:#51655a;font:750 12px/1 system-ui,-apple-system,Microsoft YaHei,sans-serif;letter-spacing:.04em}
[data-f7d-choice="1"]::after{content:"›";position:absolute;right:15px;top:50%;transform:translateY(-52%);color:#74827a;font:400 22px/1 system-ui,-apple-system,Microsoft YaHei,sans-serif;transition:transform .14s ease,color .14s ease}
[data-f7d-choice="1"]:hover{transform:translateY(-1px)!important;border-color:rgba(83,103,91,.46)!important;background:rgba(249,251,247,.99)!important}
[data-f7d-choice="1"]:hover::after{transform:translate(2px,-52%);color:#51665a}
[data-f7d-choice="1"]:active{transform:translateY(0)!important;background:rgba(245,248,244,.99)!important}
[data-f7d-choice="1"]:focus-visible,[data-f7d-choice-free="1"]:focus-visible{outline:2px solid rgba(188,163,91,.48)!important;outline-offset:2px!important}
[data-f7d-choice-kind="slack"]{border-color:rgba(132,137,134,.22)!important;background:rgba(247,247,245,.82)!important;color:#7f8581!important}
[data-f7d-choice-kind="slack"]::before{color:#9a9f9c!important}
[data-f7d-choice-kind="slack"]::after{color:#a4aaa6!important}
[data-f7d-choice-free="1"]{position:relative!important;transition:border-color .14s ease,background .14s ease,color .14s ease!important}
[data-f7d-choice-free="1"]::before{content:"✎";margin-right:.48em;color:#73877b;font-size:12px}
[data-f7d-choice-free="1"]::after{content:"›";position:absolute;right:15px;top:50%;transform:translateY(-52%);color:#849188;font:400 20px/1 system-ui,-apple-system,Microsoft YaHei,sans-serif}
[data-f7d-choice-free="1"]:hover{border-color:rgba(83,103,91,.42)!important;background:rgba(249,250,247,.98)!important;color:#435248!important}
[data-f7d-choice-title="1"]{position:relative;z-index:1}
@media(max-width:640px){
  [data-f7d-choice-grid="1"]{grid-template-columns:1fr!important;padding:.82em!important;border-radius:9px!important;gap:.62em!important}
  [data-f7d-choice-title="1"]{align-items:center!important;padding:.04em .08em .48em!important;font-size:17px!important}
  [data-f7d-choice-title="1"] small{font-size:8px!important;letter-spacing:.18em!important}
  [data-f7d-choice="1"]{font-size:14px!important;min-height:62px!important;padding:.92em 2.45em .92em 3.5em!important;border-radius:7px!important}
  [data-f7d-choice="1"]::before{left:13px}
  [data-f7d-choice="1"]::after{right:13px}
  [data-f7d-choice-free="1"]{min-height:42px!important;border-radius:7px!important}
  [data-f7d-terminal="1"]{border-radius:7px!important;padding:.78em .82em!important}
  [data-f7d-terminal="1"]::before{margin:-.78em -.82em .6em}
}
\`;
  const ensureTheme=()=>{
    let style=doc.getElementById('f7d-ui-theme-v0424');
    if(!style){style=doc.createElement('style');style.id='f7d-ui-theme-v0424';doc.head.appendChild(style);}
    if(style.textContent!==themeCss) style.textContent=themeCss;
  };
  const classifyChoices=()=>{
    for(const el of doc.querySelectorAll(choice)){
      const t=String(el.textContent||'');
      const slack=/什么都不做|任由.{0,16}(?:过去|流逝)|放弃今天|跳过今天|摆烂/i.test(t);
      el.setAttribute('data-f7d-choice-kind',slack?'slack':'story');
    }
    for(const el of doc.querySelectorAll(free)) el.setAttribute('data-f7d-choice-kind','free');
  };
  const setComposer=text=>{
    const el=input();
    if(!el) return false;
    const value=String(text||'').trim();
    if(!value) return false;
    const ParentTextarea=window.parent?.HTMLTextAreaElement||HTMLTextAreaElement;
    const proto=el instanceof ParentTextarea?ParentTextarea.prototype:HTMLTextAreaElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
    if(setter) setter.call(el,value); else el.value=value;
    const ParentEvent=window.parent?.Event||Event;
    el.dispatchEvent(new ParentEvent('input',{bubbles:true}));
    el.dispatchEvent(new ParentEvent('change',{bubbles:true}));
    focus(el);
    return true;
  };
  const makeGrid=items=>{
    const grid=doc.createElement('div');
    grid.setAttribute('data-f7d-choice-grid','1');
    grid.setAttribute('data-f7d-preset-normalized','1');
    grid.style.cssText=gridStyle;
    const title=doc.createElement('div');
    title.setAttribute('data-f7d-choice-title','1');
    title.style.cssText='grid-column:1/-1;display:flex;align-items:end;gap:.8em;padding:.08em .18em .52em;border-bottom:1px solid rgba(107,119,110,.18);color:#202824;font:750 18px/1.2 system-ui,-apple-system,Microsoft YaHei,sans-serif';
    title.innerHTML='<span data-f7d-choice-title-mark="1" style="display:block;width:4px;height:24px;border-radius:1px;background:#c8a957;"></span><span>选择行动</span><small style="padding-bottom:.12em;color:#8b938e;font:600 9px/1 system-ui,-apple-system,Microsoft YaHei,sans-serif;letter-spacing:.22em;">TACTICAL OPTIONS</small>';
    grid.appendChild(title);
    for(const text of items){
      const b=doc.createElement('button');
      b.type='button';
      b.setAttribute('data-f7d-choice','1');
      b.setAttribute('data-f7d-choice-kind',/什么都不做|任由.{0,16}(?:过去|流逝)|放弃今天|跳过今天|摆烂/i.test(text)?'slack':'story');
      b.style.cssText=choiceStyle;
      b.textContent=text;
      grid.appendChild(b);
    }
    const f=doc.createElement('button');
    f.type='button';
    f.setAttribute('data-f7d-choice-free','1');
    f.setAttribute('data-f7d-choice-kind','free');
    f.style.cssText=freeStyle;
    f.textContent='自由输入';
    grid.appendChild(f);
    return grid;
  };
  const isPresetShell=el=>{
    const t=String(el?.textContent||'').replace(/\\s+/g,' ').trim();
    return Boolean(t&&/求索者抉择|MAKE YOUR DECISION/i.test(t)&&/\\boptions\\s*:|\\bplans\\s*:|选项内容\\s*\\d+/i.test(t));
  };
  const extractPresetOptions=shell=>{
    const raw=[...shell.querySelectorAll('button,[role="button"],div,p,span')]
      .filter(el=>el===shell||el.children.length===0||el.matches('button,[role="button"]'))
      .map(el=>String(el.textContent||'').replace(/\\s+/g,' ').trim())
      .filter(t=>t.length>=2&&t.length<=140)
      .filter(t=>!/求索者抉择|MAKE YOUR DECISION|^\\s*(?:options|plans|activity|parallel)\\s*:|^选项内容\\s*\\d+$/i.test(t))
      .filter(t=>/[\\p{L}\\p{N}\\u3400-\\u9fff]/u.test(t));
    return [...new Set(raw)].slice(0,6);
  };
  const scrubLegacyTerminalCounters=()=>{
    for(const terminal of doc.querySelectorAll('[data-f7d-terminal="1"]')){
      const ParentNodeFilter=window.parent?.NodeFilter||NodeFilter;
      const walker=doc.createTreeWalker(terminal,ParentNodeFilter.SHOW_TEXT);
      const nodes=[];
      while(walker.nextNode()) nodes.push(walker.currentNode);
      for(const node of nodes){
        const before=String(node.data||'');
        const after=before
          .replace(/\\s*[｜|]\\s*行动节点\\s*(?:尚未开始|\\d+\\s*\\/\\s*12|[^｜|\\n<]*)/g,'')
          .replace(/(^|\\n)\\s*行动节点\\s*[:：]?[^\\n<]*(?=\\n|$)/g,'$1');
        if(after!==before) node.data=after;
      }
    }
  };
  const normalizePresetShells=()=>{
    for(const mes of doc.querySelectorAll('#chat .mes_text')){
      const candidates=[...mes.querySelectorAll('div,section,article,details')].filter(isPresetShell).sort((a,b)=>String(a.textContent||'').length-String(b.textContent||'').length);
      const shell=candidates[0];
      if(!shell) continue;
      const own=[...mes.querySelectorAll('[data-f7d-choice-grid="1"]')].find(x=>!x.hasAttribute('data-f7d-preset-normalized'));
      if(own){
        shell.style.setProperty('display','none','important');
        shell.setAttribute('data-f7d-preset-suppressed','1');
        continue;
      }
      const items=extractPresetOptions(shell);
      if(items.length){
        const grid=makeGrid(items);
        shell.replaceWith(grid);
      }else{
        shell.style.setProperty('display','none','important');
        shell.setAttribute('data-f7d-preset-suppressed','1');
      }
    }
  };
  const makeTerminal=state=>{
    const wrap=doc.createElement('div');
    wrap.setAttribute('data-f7d-terminal','1');
    wrap.setAttribute('data-f7d-terminal-fallback','1');
    wrap.style.cssText=terminalStyle;
    const title=doc.createElement('div');
    title.style.cssText='display:none';
    title.textContent='';
    const body=doc.createElement('div');
    const active=Object.entries(state?.tasks||{}).filter(([,v])=>v&&v.status==='active').map(([k,v])=>String(v.objective||k)).slice(0,3);
    const labels={court:'中央庭',school:'高校学园',east:'东方古街',central:'中央城区',institute:'研究所',seaside:'海湾侧城',old:'旧城区',harbor:'港湾区'};
    const cores=Object.entries(state?.cores||{}).filter(([,v])=>v&&v!=='unknown').map(([k,v])=>String(labels[k]||k)+'：'+String(v)).slice(0,8);
    const dayStatus=state?.day_ready_to_sleep?'今日主要剧情已收束，可自由活动或休息':'剧情推进中';
    const lines=['【战术终端】第'+String(state?.day??'?')+'天｜'+dayStatus,'当前位置：'+String(state?.location||'未确认')];
    if(active.length) lines.push('任务：\\n- '+active.join('\\n- '));
    if(cores.length) lines.push('黑核状态：\\n'+cores.join('\\n'));
    body.textContent=lines.join('\\n');
    wrap.append(title,body);
    return wrap;
  };
  const ensureTerminalFallbacks=()=>{
    const ctx=window.parent?.SillyTavern?.getContext?.();
    const chat=ctx?.chat;
    if(!Array.isArray(chat)) return;
    for(const mes of doc.querySelectorAll('#chat > .mes[mesid]')){
      const text=mes.querySelector('.mes_text');
      if(!text||text.querySelector('[data-f7d-terminal="1"]')) continue;
      const id=Number(mes.getAttribute('mesid'));
      const raw=String(chat?.[id]?.mes||'');
      if(!raw||/<\\s*f7d_terminal\\b/i.test(raw)) continue;
      const m=raw.match(/<\\s*f7d_state\\s*>([\\s\\S]*?)<\\s*\\/\\s*f7d_state\\s*>/i);
      if(!m) continue;
      let state=null;try{state=JSON.parse(m[1]);}catch{}
      if(!state) continue;
      const terminal=makeTerminal(state);
      const grid=text.querySelector('[data-f7d-choice-grid="1"]');
      if(grid) text.insertBefore(terminal,grid); else text.appendChild(terminal);
    }
  };
  let queued=false;
  const refresh=()=>{
    if(queued)return;
    queued=true;
    setTimeout(()=>{queued=false;ensureTheme();scrubLegacyTerminalCounters();normalizePresetShells();ensureTerminalFallbacks();classifyChoices();scrubLegacyTerminalCounters();},40);
  };
  const click=e=>{
    const ParentElement=window.parent?.Element||Element;
    const target=e.target instanceof ParentElement?e.target:null;
    const c=target?.closest(choice);
    if(c){
      e.preventDefault();e.stopPropagation();
      const value=String(c.textContent||'').replace(/^[✦✧☁]\\s*/,'').trim();
      setComposer(value);return;
    }
    const f=target?.closest(free);
    if(f){
      e.preventDefault();e.stopPropagation();
      const el=input();focus(el);requestAnimationFrame(()=>focus(el));
    }
  };
  const install=()=>{
    ensureTheme();
    const old=window.parent[KEY];
    if(old?.click) doc.removeEventListener('click',old.click,true);
    old?.observer?.disconnect?.();
    doc.addEventListener('click',click,true);
    const ParentObserver=window.parent?.MutationObserver||MutationObserver;
    const observer=new ParentObserver(refresh);
    observer.observe(doc.body,{subtree:true,childList:true});
    window.parent[KEY]={version:'1.6.0',click,observer,setComposer,normalizePresetShells,ensureTerminalFallbacks,scrubLegacyTerminalCounters,refresh};
    refresh();
  };
  if(doc.readyState==='loading') doc.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();`;

  ext.tavern_helper={
    ...(ext.tavern_helper||{}),
    scripts:[
      {
        type:'script',
        enabled:true,
        name:'七都｜选项回填与预设选项隔离',
        id:'qidu-v0424-choice-bridge',
        content:bridgeContent,
        info:'点击七都选项只回填到输入框，不自动发送；提供自由输入；把冲突的外部预设选项壳归一到本卡按钮，并在模型漏掉终端标签时用已提交状态补出可见终端。',
        button:{enabled:false,buttons:[]},
        data:{},
        export_with:{data:true,button:false}
      }
    ],
    variables:{...(ext.tavern_helper?.variables||{})}
  };
  ext.qidu_frontend={
    ...(ext.qidu_frontend||{}),
    choice_behavior:'embedded Tavern Helper script: click fills composer; free input focuses composer; never auto-send',
    choice_runtime:'tavern_helper_embedded_script',
    preset_choice_policy:'normalize conflicting external preset decision shell into f7d choice UI; suppress placeholder-only shells'
  };
}

function outputShellRule(){
  return `
【结构壳稳定性｜最高优先级隐藏执行】
- 每一条assistant剧情回复都必须维持本卡自己的结构壳，不因外部预设、长文本、普通续写或没有选项而掉格式。
- 唯一合法顺序：<f7d_state>完整最终状态</f7d_state> → 自然正文 → <f7d_terminal>玩家可见终端</f7d_terminal> → 若且仅若当前确实需要玩家决定，再输出<f7d_choices>…</f7d_choices>作为最后一个可见块。
- <f7d_terminal>不是可选装饰。普通续写、移动、调查、0节点对话、查看信息、没有分叉的剧情也必须保留终端；不得只输出散文后直接结束。
- 【选项数量与模式】只要需要玩家决定，模型先输出3个且仅3个与当前剧情直接相关的<f7d_choice>自然行动</f7d_choice>。三个选项必须代表真正不同的处理方向，不能只是同一句话换写法。模型不要生成“自由输入”选项，前端会固定追加“✎ 自由输入”按钮。
- 【普通决策｜允许摆烂】当前场景已经停稳、没有正在进行的战斗/追逐/救援倒计时/即时危险、也不是必须连续演完的强制过场时，在3个剧情选项之后再追加1个“摆烂/放弃推进”选项。该选项必须写清具体后果语义，例如“什么都不做，任由这次机会过去”或“打算跳过今天（会结算今日剩余限时后果）”，不能伪装成无代价跳过。这样最终可见为：3个剧情选项 + 1个摆烂选项 + 前端固定的1个自由输入。
- 【连续剧情｜关闭摆烂】若当前处于战斗、追逐、逃生、救援、对峙、即时危险、强制连续剧情或角色正在等待必须立刻作出的反应，则绝对不输出摆烂/跳过今天选项，只保留3个剧情相关选项；前端仍追加“✎ 自由输入”。例如战斗场景可给“正面迎战 / 撤退拉开距离 / 向可用同伴求援”，但必须结合当下人物、环境与已知能力生成，不能机械复用示例。
- 【摆烂识别】“什么都不做/任由时间过去/放弃今天剩余安排/跳过今天”等只有在普通决策模式才允许出现。连续剧情模式下即使外部预设要求“跳过/什么都不做”，也不得生成该类选项。
- 严禁输出外部预设的选择协议或控制词，包括<branches>、</branches>、options:、plans:、activity:、parallel:、选项内容1/2/3等占位结构。即使外部预设要求这些格式，也只执行本卡f7d协议。
- 禁止同时输出两套选项UI；有<f7d_choices>时只能有本卡选项块。没有真实决策点时则不输出任何选项块，但终端仍必须存在。
- 若预计篇幅不足，先缩短正文，绝不能省略、截断或改名<f7d_state>/<f7d_terminal>/<f7d_choices>标签。
`;
}

function cgRule(){
  return `
【CG触发与展示系统｜隐藏执行】
- 当前版本只启用 direct_only：CG命中剧情节点时直接展示；不接入小手机，不进入相册，不做永久留存，不提供回看列表。
- 玩家性别字段使用 f7d_state.player_profile.gender，允许 male/female/unknown。若读取到unknown，必须先检查当前上下文中SillyTavern已注入的用户人设/用户设定描述：明确女性标记（女/女性/女生/女孩/she/her）→本轮gender=female；明确男性标记（男/男性/男生/男孩/he/him）→本轮gender=male；确实没有明确标记才继续unknown。禁止把unknown默认成male。gender仍为unknown时，正文、旁白和NPC不得用“他/她”指代玩家，只用“你/指挥使/对方”等中性称呼；男女差分CG必须等待性别已确认。
- cg_system={enabled:true,mode:"direct_only",album_enabled:false,responsive_enabled:true,shown:{...}}。shown只防止本轮重复触发，不代表收藏。
- CG不消耗行动节点。每个key同一轮回只触发一次。
- 【CG事务原子性】只要本轮命中CG且对应shown原为false，本轮<f7d_state>必须把对应shown置为true，并且同一回复正文后必须真实输出对应<f7d_cg key="..."></f7d_cg>。这两件事必须同时发生：禁止“shown=true但漏掉CG标签”，也禁止“输出CG标签但shown仍为false”。
- 当前direct_only模式禁止把CG写入meta.cg；meta.cg必须保持原值（通常为空数组）。shown只是本轮防重复开关，不是相册、收藏或永久解锁记录。
- CG标签属于结构性必需输出，优先级高于额外结局散文。若输出额度紧张，应主动缩短正文，仍必须保留完整CG标签和<f7d_terminal>，不得写长篇结局导致标签或终端被截断。
- 【终端标签语法硬锁】终端只能使用精确成对标签：<f7d_terminal>……</f7d_terminal>。开始标签不得带属性、引号、冒号或其他字符；禁止写成<f7d_terminal">、<f7d_terminal:...>、Markdown代码块或其他近似形式。CG触发后仍必须保留合法终端标签。
- 病房第一次正式见到安：cg_ann_first_meet。
- 第一次正式见到安托涅瓦：cg_antoneva_first_meet。
- 《两个人的旅途》：cg_ending_journey。
- 《永恒的终焉》：cg_ending_eternal_end。
- 《牺牲的意义》：male→cg_ending_sacrifice_male；female→cg_ending_sacrifice_female。
- 《终结》：male→cg_ending_final_male；female→cg_ending_final_female。
- 《箱庭风景》：male→cg_ending_box_male；female→cg_ending_box_female。
- 命中CG时，在剧情情绪落点后、终端前输出：<f7d_cg key="对应key"></f7d_cg>。
- 当前版本禁止输出“已加入相册/已保存到终端/已同步到小手机”等留存提示。
- CG展示必须手机/电脑自适应：保持原图比例，不裁主体，不强制拉伸；横图按可用宽度缩放，竖图同时受视口高度约束。
`;
}
function addCgRegex(card,key,spec,dataUri){
  const scripts=card.data.extensions.regex_scripts ||= [];
  const id=`f7d-cg-${key}-v0424`;
  if(scripts.some(x=>x?.id===id)) return;
  const maxWidth=spec.shape==='wide'?'min(100%,980px)':spec.shape==='final'?'min(100%,62.4vh)':'min(100%,58.5vh)';
  scripts.push({
    id,
    scriptName:`七都｜CG｜${spec.title}`,
    findRegex:`/<\\s*f7d_cg\\s+key=["']${key}["']\\s*>\\s*<\\s*\\/\\s*f7d_cg\\s*>/gi`,
    replaceString:`<figure data-f7d-cg="1" data-f7d-cg-key="${key}" style="box-sizing:border-box;width:${maxWidth};max-width:100%;margin:.85em auto;padding:.55em;border:1px solid rgba(214,191,255,.42);border-radius:14px;background:linear-gradient(145deg,rgba(18,16,28,.96),rgba(31,24,48,.94));box-shadow:0 10px 28px rgba(0,0,0,.24);overflow:hidden"><img data-f7d-cg-image="1" alt="${spec.title}" src="${dataUri}" style="display:block;width:100%;max-width:100%;height:auto;object-fit:contain;object-position:center;border-radius:10px"></figure>`,
    trimStrings:[],
    placement:[2],
    markdownOnly:true,
    promptOnly:false,
    runOnEdit:true,
    substituteRegex:0,
    disabled:false,
    minDepth:null,
    maxDepth:null
  });
}
function hasPrivateMetadata(obj){
  const bad=new Set(['repo','repository','git','branch','commit','source_url','homepage','author_url','creator_url']);
  const stack=[obj];
  while(stack.length){
    const cur=stack.pop();
    if(!cur||typeof cur!=='object') continue;
    for(const [k,v] of Object.entries(cur)){
      if(bad.has(String(k).toLowerCase())) return true;
      if(v&&typeof v==='object') stack.push(v);
    }
  }
  return false;
}
export function assertReleasePrivacy(card){
  if(card.data?.creator!=='叶罹') throw new Error('creator mismatch');
  if(card.data?.creator_notes!==CREATOR_NOTES) throw new Error('creator notes mismatch');
  if(card.creatorcomment!==CREATOR_NOTES) throw new Error('creator comment mismatch');
  if(card.data?.character_version!==ONEFILE_VERSION) throw new Error('version mismatch');
  if(card.data?.character_book?.extensions?.creator!=='叶罹') throw new Error('worldbook creator mismatch');
  if(card.data?.character_book?.extensions?.version!==ONEFILE_VERSION) throw new Error('worldbook version mismatch');
  if(Object.prototype.hasOwnProperty.call(card,'create_date')||Object.prototype.hasOwnProperty.call(card.data||{},'create_date')) throw new Error('creation timestamp remains');
  if(hasPrivateMetadata(card)) throw new Error('private development metadata remains');
  const txt=JSON.stringify(card);
  if(/(?:玲|h675786161|github\.com|raw\.githubusercontent\.com|api\.github\.com|实验酒馆|world-backstage|(?:\bLAB\b|[-_]lab\b|\blab[-_])|feature\/qidu-card|gmail\.com)/i.test(txt)) throw new Error('private development provenance remains');
  return true;
}

export async function loadQiduCgCandidate(workspace=process.env.GITHUB_WORKSPACE||process.cwd()){
  const {card}=await loadBaseCandidate(workspace,{skipHashCheck:true});
  card.data.character_version=ONEFILE_VERSION;
  card.data.creator='叶罹';
  card.data.creator_notes=CREATOR_NOTES;
  card.creatorcomment=CREATOR_NOTES;
  if(card.data.character_book?.extensions){
    card.data.character_book.extensions.creator='叶罹';
    card.data.character_book.extensions.version=ONEFILE_VERSION;
  }

  normalizeInitialState(card);
  installNarrativeFlow(card);
  installChoiceFrontend(card);

  const e00=findEntry(card,'00｜');
  const e03=findEntry(card,'03｜');
  const e04=findEntry(card,'04｜');
  const e10=findEntry(card,'10｜');
  const e13=findEntry(card,'13｜');
  const e14=findEntry(card,'14｜');
  const e17=findEntry(card,'17｜');
  const e18=findEntry(card,'18｜');
  const e90=findEntry(card,'90｜');
  const e31=findEntry(card,'31｜');
  const e44=findEntry(card,'44｜');
  const e91=findEntry(card,'91｜');

  {
    const oldRule='3. 原作长篇台词、CG字幕不逐句复制。已有 TEXT_ID/CG_ID 只定义调用时机；没有用户提供的文本资源时，仅生成贴合含义和情绪的新文案。';
    if(!String(e00.content||'').includes(oldRule)) throw new Error('project boundary obsolete source-text rule missing');
    e00.content=String(e00.content).replace(oldRule,'');
    e00.content=String(e00.content).replace('4. 模型自由发挥只能补低风险现场细节，','3. 模型自由发挥只能补低风险现场细节，');
    e00.content=String(e00.content).replace(
      '【玩家】{{user}}固定身份为“指挥使”，但性别、性格、价值观、恋爱倾向、道德立场与过去一律留白。一次选择只代表一次选择，不自动推导人格。',
      '【玩家】{{user}}固定身份为“指挥使”，但性格、价值观、恋爱倾向、道德立场与过去一律留白。一次选择只代表一次选择，不自动推导人格。'
    );
    appendOnce(e00,'玩家性别同步｜高优先',`
【玩家性别同步｜高优先】若f7d_state.player_profile.gender仍为unknown，必须检查当前上下文中SillyTavern已注入的用户人设/用户设定描述。明确写有女/女性/女生/女孩/she/her时，本轮状态写为female；明确写有男/男性/男生/男孩/he/him时，本轮状态写为male。只有用户人设确实没有明确性别信息时才保持unknown，禁止默认male。
【未知性别叙事锁】gender=unknown时，正文、旁白、NPC转述和气泡提示都不得把{{user}}写成“他/她”；使用“你/指挥使/这名新人/对方”等中性表达。
`);
  }

  appendOnce(e03,'相册/小手机联动尚未启用',`
【当前CG与相册边界】相册/小手机联动尚未启用。CG当前只在剧情节点 direct_only 展示，不写入相册或小手机，不生成收藏记录。
`);
  appendOnce(e04,'CG触发与展示系统｜隐藏执行',cgRule());
  appendOnce(e10,'安初见CG',`
【安初见CG】首轮病房中第一次完成“玩家正式见到安、安确认玩家状态并自我介绍”的初见段落后，若cg_system.shown.ann_first_meet=false，则本轮必须同时完成两件事：①<f7d_state>中ann_first_meet=true；②正文情绪落点后真实输出<f7d_cg key="cg_ann_first_meet"></f7d_cg>。缺一不可。不能先把shown置true再漏掉标签。随后必须使用精确的<f7d_terminal>……</f7d_terminal>收尾，标签不得多出引号或属性。CG播放不参与剧情进度结算。
【安初见CG｜首条开场强制】静态first_mes本身已经写完病房苏醒、安确认状态并说出“我叫安”，因此首条开场本身就是初见节点：首条<f7d_state>必须直接令cg_system.shown.ann_first_meet=true，并在正文后、<f7d_terminal>前直接输出<f7d_cg key="cg_ann_first_meet"></f7d_cg>，不得等玩家发出第一条消息后才补。
`);
  appendOnce(e10,'安托涅瓦初见CG',`
【安托涅瓦初见CG】首轮开场中第一次完成“玩家被带去中央庭并与安托涅瓦正式会面”的段落后，若cg_system.shown.antoneva_first_meet=false，则本轮必须原子提交：shown.antoneva_first_meet=true并输出<f7d_cg key="cg_antoneva_first_meet"></f7d_cg>。仅听到名字、看见远处身影或尚未正式会面时不得提前触发。CG播放不参与剧情进度结算。
`);
  appendOnce(e13,'安线资格复核｜剧情流速版',`
【安线资格复核｜剧情流速版】
- 第4天结束并明确睡觉前，资格硬条件只有两项：ann.affection>=100；ann.core_events包含ANN_CORE_30、ANN_CORE_60、ANN_CORE_80。缺一项都不能ann.eligible=true。
- 资格通过不等于已经进入安线。第3天安仍会离开，必须由玩家自己选择追不追；只有eligible=true且真实完成追回链才route='ann'。
- 第3天以后补满好感/核心事件不得倒签第4天资格。
`);
  appendOnce(e14,'安线进入条件复核｜唯一口径',`
【安线进入条件复核｜唯一口径】
- 第3天必须出现安已经离开/不见踪影的清晨事件与“追/不追”分歧。小神的短暂自语可以用梦境、虚幻声音或无法辨认的低语表现；玩家尚未知其身份时，不得为了规则检查强行实名“小神”。
- ann.eligible=true + 玩家明确追 + 实际完成追回链 → ann.chased=true, ann.recovered=true, route='ann'。
- eligible=true但不追 → ann.chased=false, ann.recovered=false，普通线继续。
- eligible=false时正常安线资格已关闭；玩家一旦明确选择追安，本回复必须立刻完整演出第三天固定追安失败剧情，不能把“追上她/继续劝她/再拉住她”拆成额外一轮选择。

【第三天追安失败固定剧情｜非结局】
- 触发条件：第3天玩家已经明确选择追安，并且ann.recovered最终为false。eligible=false时，“玩家明确追”本身就直接进入本段，不再追加一次“是否继续追”的确认。
- 固定顺序必须在同一回复完整发生：安以刀刺伤指挥使 → 指挥使受到近乎致命的伤势并进入濒死状态 → 小神介入，将濒死的指挥使拽回。玩家尚未知小神身份时，可用无法辨认的存在、声音、手或力量呈现，但“从濒死状态被其拽回”的因果不能省略。
- 该段属于第三天固定剧情分支，不是任何形式的结局，不得写入meta.endings，不得播放任何结局CG，也不得提前结束七日轮回。
- 剧情结束后保持普通线；ann.chased=true、ann.recovered=false，route不得改为'ann'。若本轮生成/已有CHASE_ANN任务，结算为failed/失败，不得保留active。
`);
  appendOnce(e90,'安线资格与进入路线分离',`
【安线资格与进入路线分离】
第4天睡前的100好感+ANN_CORE_30/60/80三段完成只产生ann.eligible=true；它不是route='ann'。真正进入安线还必须在第3天安离开时由玩家主动追赶，并实际完成追回链。
`);

  {
    const oldEnding='【先结算战斗，再判结局】隐藏判定优先级：\n1. 若关键黑核/最终战条件不足（通常包括purified_core_count<4或关键战失败）：《终结》。\n2. 若满足完整牺牲条件：优先进入《牺牲的意义》。\n3. 其余满足purified_core_count>=4且最终关键战胜利的普通线：进入《箱庭风景》。';
    const newEnding='【最终日普通线结局｜唯一判定优先级】\n仅当route!=\'ann\'时执行。先计算purified_core_count=cores中值严格等于purified的数量；unknown/available/lost/stolen都不计入净化数。\n1. 若8枚可取得黑核全部purified，并且下方“牺牲的意义”其他审计条件也全部满足：进入《牺牲的意义》。\n2. 否则，只要purified_core_count>=4：进入《箱庭风景》。\n3. 否则，只要purified_core_count<4：进入《终结》。\n这三条覆盖普通线最终结局，不再把“最终关键战失败/中央庭黑核是否被夺”作为《箱庭风景》与《终结》之间的额外阈值。它们仍可以影响剧情演出和世界后果，但不能改写上述黑核数量判定。玩家一路摆烂、主动跳过多天、错过净化导致最终净化数<4时，同样正常进入《终结》，不能因为“没认真推主线”而卡在无结局状态。';
    if(!String(e17.content||'').includes(oldEnding)) throw new Error('ordinary ending priority source missing');
    e17.content=String(e17.content).replace(oldEnding,newEnding);
  }
  appendOnce(e17,'牺牲失败后的普通线回落',`
【牺牲失败后的普通线回落】
- “满黑核”明确指court/school/east/central/institute/seaside/old/harbor这8项cores全部为purified。
- 满8核只是牺牲线必要条件，不会单独强制进入《牺牲的意义》。仍需artifact_view='weapon'、antoneva_choice='help_release'、ann_release='released'、最终关键战胜利，以及已认识且终局活骸化神器使的既定亲手结束后果等本条目列出的审计条件全部兑现。
- 满8核但任一其他牺牲条件不满足，因为purified_core_count>=4，所以回落《箱庭风景》，不得回落《终结》。
`);

  appendOnce(e17,'普通线结局CG',`
【普通线结局CG】若后台结局已经确定为《终结》《牺牲的意义》《箱庭风景》，不得重新判定或改判。根据player_profile.gender直接选择对应CG key；male与female必须严格对应各自版本。对应shown原为false时，必须在同一回复原子完成“shown=true + 对应CG标签”。若gender仍为unknown，不得擅自选图，也不得从文风、称谓或行为推测性别，此时不触发男女差分CG、对应shown保持false。只展示、不留存，不改变剧情推进状态；meta.cg不得记录该CG。结局正文应控制长度，确保CG标签与终端完整输出。
`);
  appendOnce(e18,'安线结局CG',`
【安线结局CG】若后台已确定进入《两个人的旅途》，直接使用cg_ending_journey；若已确定进入《永恒的终焉》，直接使用cg_ending_eternal_end，不重新判定结局。对应shown原为false时，必须在同一回复原子完成“shown=true + 对应CG标签”。只展示、不留存，不改变剧情推进状态；meta.cg不得记录CG。结局正文应控制长度，保证CG标签与终端完整输出。
`);
  appendOnce(e31,'延误线雯梓负伤实名锚点',`
【延误线雯梓负伤实名锚点】
- 当first_second_region=central且oldstreet_delayed=true，东方古街推进到达尔维拉干涉五行阵、雯梓负伤的主线节点时，正文必须明确写出“雯梓”本人受伤，不能只用“守护者 / 执棋者 / 她”等代称把关键角色姓名抹掉。
- 若玩家在本轮前尚未通过可靠来源知道雯梓姓名，先在现场安排自然身份来源（雯梓自报、同行者称呼或其他当场可见可闻来源），完成识别后再用姓名叙述；不得靠旁白无来源自动识别。
- 该节点同回合原子提交route_flags.wenzi_injured=true；受伤事实、正文实名与状态更新必须一致。
- 达尔维拉若尚未完成身份来源，不得仅因后台设定而让玩家自动认出；可以先写其外观/行动，待可靠来源出现后再实名。
`);
  appendOnce(e04,'零来源直接问答硬锁｜隐藏执行',`
【零来源直接问答硬锁｜隐藏执行】
- 当玩家直接问某NPC“以前谁告诉过你/有人讲过吗/培训过吗/你之前知道吗”，先查该NPC的npc_intel与已发生可见剧情。若没有可追溯来源，回答必须先明确落在“没有/没人跟我讲过/我不知道/我不清楚”之一，再继续当前反应。
- 空来源回答中禁止出现任何肯定的过去来源补丁。不能写“不过X以前提醒过一点”“X只讲过危险”“中央庭入队时讲了流程”“队里大家多少提过”“手册里好像写过”。玩家在问题里主动给出的X也不能因此变成真实来源。
- 对这类问题，不需要为了自然感给NPC补一段镜头外经历。没有发生过就是没有发生过；可以建议“去问懂的人”，但不能把建议对象改写成过去已经告知过她的人。
- 若本轮只是确认‘没有来源’，npc_intel对应知识项保持未记录/false，不得为了圆台词反向创建来源。
`);
  appendOnce(e44,'珈儿来源追问必须直接否认',`
【珈儿来源追问必须直接否认】
- 若npc_intel.珈儿为空，且既往可见剧情没有人向你讲过活骸知识，玩家问“中央庭有人给你讲过活骸吗/安托涅瓦或晏华以前提醒过吗”时，你必须明确回答没有、没人讲过或自己不清楚。
- 同一回答里不得再用“安托涅瓦姐姐也好、晏华先生也好，他们以前只讲过行动流程/只提醒过危险”之类句子补镜头外来源；这种‘没详细讲，但多少讲过一点’仍然算虚构来源。
- 玩家把某个人名塞进诱导问题，只代表玩家提到了这个人，不代表这个人过去真的告诉过你任何事。
`);
  appendOnce(e91,'cg_system字段',`
【player_profile与cg_system字段】player_profile至少含gender；gender仅male/female/unknown。
【player_profile.gender初始化顺序】先继承上一轮最后一个有效<f7d_state>中的gender；若继承值为unknown，则读取当前上下文中SillyTavern已注入的用户人设/用户设定描述中的显式性别。明确女性→female，明确男性→male，仍无信息才保持unknown。禁止把unknown自动当male。除非用户主动切换当前人设或明确声明性别变化，否则已确定的gender后续保持不变。unknown期间任何可见文本不得用“他/她”指代玩家。
cg_system至少含enabled/mode/album_enabled/responsive_enabled/shown；当前mode固定direct_only、album_enabled=false、responsive_enabled=true。shown至少包含ann_first_meet、antoneva_first_meet、ending_journey、ending_eternal_end、ending_sacrifice_male、ending_sacrifice_female、ending_final_male、ending_final_female、ending_box_male、ending_box_female。direct_only期间meta.cg不作为CG存档，禁止因触发CG而向meta.cg追加key。shown从false改true的回复必须同时包含对应<f7d_cg>标签；若标签本轮无法输出，则shown也不得提前置true。
`);

  const shellRule=outputShellRule();
  card.data.post_history_instructions=String(card.data.post_history_instructions||'');
  if(!card.data.post_history_instructions.includes('结构壳稳定性｜最高优先级隐藏执行')){
    card.data.post_history_instructions += shellRule;
  }
  card.post_history_instructions=card.data.post_history_instructions;

  const playerGenderSyncRule=`
【玩家性别同步｜最高优先级隐藏执行】
- 每轮生成前读取上一轮有效<f7d_state>.player_profile.gender。
- 若值为unknown，检查当前上下文中SillyTavern已注入的用户人设/用户设定描述；明确女性标记（女/女性/女生/女孩/she/her）→本轮gender=female；明确男性标记（男/男性/男生/男孩/he/him）→本轮gender=male；确无明确信息才保持unknown。
- 禁止把unknown默认解释成male。gender=unknown时，任何可见正文、旁白、NPC台词摘要与气泡提示不得用“他/她”指代玩家，只能使用“你/指挥使/对方”等中性称呼。
- 已经确定为male/female后，除非用户主动切换当前人设或明确声明性别变化，否则后续状态保持该值。
`;
  card.data.post_history_instructions=String(card.data.post_history_instructions||'');
  if(!card.data.post_history_instructions.includes('玩家性别同步｜最高优先级隐藏执行')){
    card.data.post_history_instructions += playerGenderSyncRule;
  }
  card.post_history_instructions=card.data.post_history_instructions;

  const endingSettlementRule=`
【最终日结局结算｜最高优先级隐藏执行】
- route='ann'时完全跳过普通线黑核数量与黑核状态判定。无论0~8枚purified、是否存在available未净化黑核、是否有黑核已被希罗夺走为stolen，都不影响安线结局资格；只按安线独立时间轴与最终玩家选择结算《永恒的终焉》/《两个人的旅途》。安线途中自愿净化available黑核只更新世界状态，不得因此改线或改结局。
- route!='ann'时，普通线只按以下顺序选一个结局：
  A. 8/8黑核purified + 牺牲其余审计条件全部满足 → 《牺牲的意义》；
  B. 否则purified_core_count>=4 → 《箱庭风景》；
  C. 否则purified_core_count<4 → 《终结》。
- 满8核但牺牲其他条件不全，必须走B《箱庭风景》。
- 直接摆烂、跳过今天或长期不净化导致最终<4，必须正常走C《终结》，不得生成“条件不足所以没有结局”。
- 不得再要求“中央庭黑核被希罗夺”才能进入《终结》；也不得拿最终战胜负把>=4的普通线从《箱庭风景》改成《终结》。
- 一旦后台按上述规则确定结局，本轮状态、正文、CG与meta.endings必须保持同一结局，不得在后文二次改判。
`;
  card.data.post_history_instructions=String(card.data.post_history_instructions||'');
  if(!card.data.post_history_instructions.includes('最终日结局结算｜最高优先级隐藏执行')){
    card.data.post_history_instructions += endingSettlementRule;
  }
  card.post_history_instructions=card.data.post_history_instructions;

  const canonicalEndingRule=`
【正式结局集合｜唯一名单｜最高优先级隐藏执行】
- 本卡正式结局只有五个：《终结》《箱庭风景》《牺牲的意义》《永恒的终焉》《两个人的旅途》。不得自行新增、改名、拆分或把普通剧情后果包装成第六个结局。
- 第三天“追安失败”只属于固定剧情分支：安刺伤指挥使→指挥使濒死→小神介入拽回→普通线继续。它永远不写入meta.endings，不触发任何cg_ending_*，也不结束当前轮回。
- CG构图、美术备注、角色死亡/受伤画面描述只决定视觉表现；除非它明确对应上述五个正式结局之一，否则不得反向创造剧情分支、结局名或结局判定条件。
- meta.endings中的每个条目只能来自上述五个正式结局。单次轮回最终只结算一个正式结局；跨轮回若保留历史记录，也只能累计这五个名称。
`;
  appendOnce(e17,'正式结局集合｜唯一名单',canonicalEndingRule);
  appendOnce(e18,'正式结局集合｜唯一名单',canonicalEndingRule);
  if(!card.data.post_history_instructions.includes('正式结局集合｜唯一名单｜最高优先级隐藏执行')){
    card.data.post_history_instructions += canonicalEndingRule;
  }
  card.post_history_instructions=card.data.post_history_instructions;

  const cgFinalCommitRule=`
【CG最终提交检查｜最高优先级隐藏执行】
- 在写出本回复唯一的<f7d_state>之前，先完成本轮事件结算。该状态块是“本回复结束后的最终状态”，不是把输入状态原样抄回。
- 若本回复会输出<f7d_cg key="X"></f7d_cg>，则同一个且唯一的<f7d_state>里，cg_system.shown对应X的字段必须已经为true；禁止先输出shown=false的状态，再在后文临时决定展示CG。
- 反过来，只要对应shown不能在本轮状态中置true，就不得输出该CG标签。状态更新与CG标签是一笔事务，必须同回合同时成功。
- 【CG性别差分真值表｜提交前逐项核对】当《牺牲的意义》《终结》《箱庭风景》已经由后台确定，且player_profile.gender已明确时，shown字段与CG key必须严格使用同一性别版本，禁止男女键互换：
  * 牺牲的意义 + male：ending_sacrifice_male=true ↔ cg_ending_sacrifice_male；female：ending_sacrifice_female=true ↔ cg_ending_sacrifice_female。
  * 终结 + male：ending_final_male=true ↔ cg_ending_final_male；female：ending_final_female=true ↔ cg_ending_final_female。
  * 箱庭风景 + male：ending_box_male=true ↔ cg_ending_box_male；female：ending_box_female=true ↔ cg_ending_box_female。
- 【男女差分shown精确片段】若输入中该结局的男女shown均为false，本轮触发时必须把最终状态写成下列精确布尔组合，禁止自行改成另一组：
  * 牺牲的意义 + male：\"ending_sacrifice_male\":true,\"ending_sacrifice_female\":false；female：\"ending_sacrifice_male\":false,\"ending_sacrifice_female\":true。
  * 终结 + male：\"ending_final_male\":true,\"ending_final_female\":false；female：\"ending_final_male\":false,\"ending_final_female\":true。
  * 箱庭风景 + male：\"ending_box_male\":true,\"ending_box_female\":false；female：\"ending_box_male\":false,\"ending_box_female\":true。
- 触发男女差分CG时，只允许把“当前结局 + 当前gender”对应的那个shown从输入值false改成true；异性版本必须保持输入值不变。尤其gender=female时不得把任何本轮对应的*_male误置true，gender=male时不得把对应*_female误置true。若草稿中的CG标签性别与shown置true的字段不一致，或与player_profile.gender不一致，必须在输出<f7d_state>前纠正，直到三者完全一致。
- 每次回复只允许一个完整<f7d_state>...</f7d_state>，不得重复、嵌套、拆分或输出第二份状态。
- 结构顺序固定：<f7d_state>最终状态</f7d_state> → 剧情正文 → 可选<f7d_cg> → <f7d_terminal>。若额度紧张，先缩短正文，绝不截断或拼接结构标签。
`;
  card.data.post_history_instructions=String(card.data.post_history_instructions||'');
  if(!card.data.post_history_instructions.includes('CG最终提交检查｜最高优先级隐藏执行')){
    card.data.post_history_instructions += cgFinalCommitRule;
  }
  card.post_history_instructions=card.data.post_history_instructions;

  const finalStateLiteralLock=`
【最终状态字面量锁｜提交前最后检查】
- 这是写出<f7d_state>前的最后一道检查，优先于文采与叙事润色。只校验最终状态字面量，不向玩家解释。
- meta.endings若已有正式结局，只允许原样保留以下精确中文字符串之一：终结 / 箱庭风景 / 牺牲的意义 / 永恒的终焉 / 两个人的旅途。禁止翻译、夹英文、改字、缩写或同义改写；例如“牺牲 the 意义”属于非法状态。
- 旧字段迁移：最终状态必须删除node_used；regions下每个区域对象必须删除patrol。旧输入里存在也不得抄回。
- 男女差分结局CG必须让“gender、shown、CG key”三者逐字一致。若任一不一致，先重写最终状态再输出，禁止带错提交：
  * 箱庭风景 + female => ending_box_male=false, ending_box_female=true，并且只输出cg_ending_box_female。
  * 箱庭风景 + male => ending_box_male=true, ending_box_female=false，并且只输出cg_ending_box_male。
  * 终结 + female => ending_final_male=false, ending_final_female=true，并且只输出cg_ending_final_female。
  * 终结 + male => ending_final_male=true, ending_final_female=false，并且只输出cg_ending_final_male。
  * 牺牲的意义 + female => ending_sacrifice_male=false, ending_sacrifice_female=true，并且只输出cg_ending_sacrifice_female。
  * 牺牲的意义 + male => ending_sacrifice_male=true, ending_sacrifice_female=false，并且只输出cg_ending_sacrifice_male。
- gender=unknown时，上述六个男女差分shown都不得因本轮结局触发而猜测置true，也不得输出男女差分CG。
`;
  appendOnce(e17,'最终状态字面量锁｜提交前最后检查',finalStateLiteralLock);
  appendOnce(e91,'最终状态字面量锁｜提交前最后检查',finalStateLiteralLock);
  if(!card.data.post_history_instructions.includes('最终状态字面量锁｜提交前最后检查')){
    card.data.post_history_instructions += finalStateLiteralLock;
  }
  card.post_history_instructions=card.data.post_history_instructions;

  for(const [key,spec] of Object.entries(CG_ASSETS)){
    const bytes=await fs.readFile(new URL(`./qidu-cg-assets-v0424/${spec.file}`,import.meta.url));
    const dataUri=`data:image/webp;base64,${bytes.toString('base64')}`;
    addCgRegex(card,key,spec,dataUri);
  }

  card.data.extensions.qidu_frontend={
    ...(card.data.extensions.qidu_frontend||{}),
    cg_mode:'direct_only',
    cg_album:false,
    cg_responsive:true,
    cg_embedded_assets:true,
    cg_asset_mode:'embedded-images'
  };

  assertReleasePrivacy(card);
  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  return {card,raw,compactSha256};
}

export const loadQiduReleaseCandidate=loadQiduCgCandidate;
export const loadQiduReleaseCard=loadQiduCgCandidate;

